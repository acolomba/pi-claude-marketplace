# Bridges — MCP — adversarial re-review

**Scope:** all 9 modules in `extensions/pi-claude-marketplace/bridges/mcp/` and all 9 in `tests/bridges/mcp/`, read in full; plus the three production call sites of `prepareStageMcpServers`, `getAgentDir`'s SDK implementation, and the repo-wide `withHermeticHome` / `import test` / `__proto__` / `isPlainObject` conventions used as comparison baselines.
**First-pass file:** `unit-test-findings/bridges-mcp.md`
**Clean files attacked:** 12 (6 test, 6 production)
**Existing findings graded:** 10

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 3 |
| New WARNING (missed by first pass) | 14 |
| Existing CONFIRMED | 7 |
| Existing UNDERSTATED | 2 |
| Existing OVERSTATED | 0 |
| Existing REFUTED | 1 |
| Existing DUPLICATE-OF | 0 |

The first pass's picture of this area is broadly right about *quality of assertion*
and badly wrong about *hermeticity*. It called this "one of the stronger areas"
and listed `stage.test.ts` as having only assertion gaps. In fact ~17 of its cases
read the developer's real `~/.config/mcp/mcp.json` and `~/.pi/agent/mcp.json`
through an unpinned `homedir()`, and it passes today only because those files
happen not to exist on this machine. It also missed that the shipping bug it found
has a *third* and *fourth* untested sibling in the same file (the two WR-01
`safeSet` call sites), and that the whole defect class has one type-level root
cause in the module it declared clean.

## New findings — from the clean lists

### `tests/bridges/mcp/stage.test.ts` (not on the clean list, but its hermeticity was unexamined)

- **[BLOCKER] ~17 cases read the developer's real home MCP configuration** —
  `lines 40–934`, every case whose `servers` map is non-empty (representative:
  `line 67`, `line 394`, `line 435`, `line 525`, `line 669`).
  `prepareStageMcpServers` → `assertNoMcpCollisions` (`stage.ts:134`) →
  `loadEffectiveServerNames` → `MCP_COLLISION_SLOTS` (`collision-slots.ts:31–38`),
  which calls `homedir()` and `getAgentDir()`. `stage.test.ts` never sets `HOME`,
  and sets `PI_CODING_AGENT_DIR` in exactly one case (`line 487`). Verified:
  `os.homedir()` returns `process.env.HOME` on POSIX (checked directly), and
  `getAgentDir()` in `@earendil-works/pi-coding-agent/dist/config.js:412` returns
  `PI_CODING_AGENT_DIR` or `join(homedir(), ".pi", "agent")`. So slot [0]
  `~/.config/mcp/mcp.json` is read by every one of these cases and slot [1]
  `~/.pi/agent/mcp.json` by all but one.
  Concretely: a developer whose `~/.config/mcp/mcp.json` declares a server named
  `server`, `current`, `owned`, `local`, or `duplicate` gets an unexpected
  `McpServerCollisionError` and red tests; and `test('rejects a server declared in
  an earlier collision slot')` (line 435) asserts `owningPath === <cwd>/.mcp.json`
  (slot 2), which is wrong the moment slot 0 or 1 also declares `duplicate`.
  `~/.pi/agent/mcp.json` is *the file this very extension writes for a user-scope
  install*, so any developer who has ever dogfooded `/claude:plugin install` has it
  populated. There is no global `--import` setup file (`package.json:82`), so
  nothing pins this outside the case.
  Fix: adopt the repo's existing `withHermeticHome` convention — 10 test files
  already hand-roll it, e.g. `tests/orchestrators/plugin/install.test.ts:306`
  ("so the test never reads or writes the developer's real ~/.pi/"). Extend
  `createProjectScope` (line 18) to also mkdtemp a home root, set `process.env.HOME`
  and `process.env.PI_CODING_AGENT_DIR` to it, and restore both with `t.after()`
  before any `prepareStageMcpServers` call, exactly as
  `collision-slots.test.ts:33–50` already does per case.

- **[BLOCKER] Both WR-01 `safeSet` call sites in `stage.ts` are uncovered; the
  mutation to `out[key] = value` leaves the whole file green** — `stage.ts:116`
  (`safeSet(theirs, name, value)`) and `stage.ts:194`
  (`safeSet(stamped, name, {...})`). Grepped: `__proto__` appears in
  `tests/bridges/mcp/{safe-set,substitute,unstage}.test.ts` and nowhere else in
  `tests/` that reaches this bridge — **no case anywhere stages a server named
  `__proto__` through `prepareStageMcpServers`**. Mutating either line to plain
  bracket assignment passes all 21 cases in `stage.test.ts`, yet the production
  comments at `stage.ts:113–115` and `191–193` state exactly what breaks: a foreign
  server named `__proto__` is silently dropped from the user's `mcp.json`, and an
  own server named `__proto__` is dropped from disk while still being reported in
  `stagedNames`/`recorded`, diverging `state.json` from disk.
  The sibling call sites are covered: `unstage.ts:89` by
  `unstage.test.ts:53` and `unstage.test.ts:369`, and `substitute.ts:67` by
  `substitute.test.ts:147`. Two of four WR-01 sites proven, two not, both in one file.
  Fix: add one case to `describe('prepareStageMcpServers')` modelled on
  `unstage.test.ts:369` ("removes owned prototype-named servers and keeps foreign
  inherited names"): seed the scoped doc with a foreign `"__proto__"` entry and a
  foreign `"constructor"` entry, stage a plugin server also named `"__proto__"`,
  then `assert.deepStrictEqual(prepared._nextDoc, …)` plus
  `assert.strictEqual(Object.getPrototypeOf(prepared._nextDoc.mcpServers), Object.prototype)`
  and `assert.deepStrictEqual(Object.keys(prepared._nextDoc.mcpServers), [...])`.

- **[WARNING] Multi-entry `recorded` and `stagedNames` order is never asserted —
  a `.reverse()` mutation survives** — `stage.ts:277–287`. Only two cases assert
  `result.recorded` (`line 124`, `line 573`) and both stage exactly one server. The
  one case with four servers (`line 237`) asserts `warnings` and `_nextDoc` but
  neither `recorded` nor `stagedNames`. `types.ts:73–74` states "Order matches
  stagedNames" as a contract; mutating `newNames.map(...)` to
  `[...newNames].reverse().map(...)`, or `Object.freeze([...newNames])` to
  `Object.freeze([...newNames].sort())`, leaves every case green.
  Fix: add `assert.deepStrictEqual(prepared.result.stagedNames, ['malformedEnv',
  'urlWithScalarEnv', 'scalar', 'nil'])` and the matching four-row `recorded`
  literal to the case at line 237.

- **[WARNING] Warning concatenation order is unproven — swapping the two arrays
  survives** — `stage.ts:288` (`Object.freeze([...docWarnings, ...stampWarnings])`).
  `test('reports malformed stored JSON before replacing it')` (line 167) produces
  only doc warnings; `test('normalizes malformed server values with complete
  ordered warnings')` (line 237) produces only stamp warnings. No case produces
  both, so `[...stampWarnings, ...docWarnings]` passes.
  Fix: give the line-237 case a pre-existing malformed scoped doc (write `"{"` to
  `locations.mcpJsonPath` in its arrange block) and extend its expected `warnings`
  array with the malformed-doc line **first**.

- **[WARNING] The staged branch's frozen arrays are never asserted, only the noop
  branch's** — `line 61–63` checks `Object.isFrozen` on all three noop arrays;
  no staged-branch case checks any. Removing `Object.freeze` at `stage.ts:277`,
  `286`, `287`, or `288` leaves the file green (the declared `readonly` types are
  erased at runtime). Fix: add the same three `Object.isFrozen` assertions to
  `test('replaces owned servers and preserves complete foreign content')`
  (line 67), matching the noop case's shape.

- **[WARNING] `rollbackMcpReplacement`'s unknown-handle throw is untested while
  `finalizeMcpReplacement`'s is** — `stage.ts:350`
  (`requireMcpReplacementInternals(replacement)`) versus `stage.ts:375`. Only the
  finalize route has a case (`line 899`, "rejects an unknown replacement handle").
  Replacing line 350 with `mcpReplacementInternals.get(replacement) ?? { oldText: undefined }`
  leaves the file green — and would silently `rm` the user's `mcp.json` instead of
  refusing an unrecognised handle. Fix: add a sibling case in
  `describe('rollbackMcpReplacement')` that builds the same cloned handle the
  line-899 case builds and `await assert.rejects(() => rollbackMcpReplacement(unknownReplacement), …)`
  against `{ name: 'Error', message: 'Unknown MCP replacement handle.' }`.

- **[WARNING] Unexplained production call in a lifecycle hook** — `line 913`,
  `t.after(() => finalizeMcpReplacement(replacement));`. This is not cleanup: it
  runs a production function whose return value is discarded, with no assertion and
  no comment, inside a case about an *unknown* handle. Either it is load-bearing
  (keeping a strong reference alive so the `WeakMap` entry cannot be collected), in
  which case it needs a `//` comment saying so, or it is vestigial and should be
  deleted. Fix: decide which, and either comment it in one line or remove it — the
  case-structure rule allows a comment only where setup is not obvious, and this
  qualifies.

### `tests/bridges/mcp/types.test.ts` (declared clean)

- **[BLOCKER] `RawMcpDoc.mcpServers?: Record<string, unknown>` is the enabling
  cause of both confirmed crashes, and line 141 pins the lie in place** —
  `types.ts:18`, `types.test.ts:141`.
  Both crash sites read this field off a value that came straight from
  `JSON.parse` and was cast: `stage.ts:89` (`parsed as RawMcpDoc`) and
  `unstage.ts:69` (`parsed as RawMcpDoc`). At runtime `mcpServers` is `unknown`;
  the interface declares it `Record<string, unknown> | undefined`. That declaration
  is why `if (m === undefined || Array.isArray(m))` at `stage.ts:95` *reads as
  exhaustive* and why `const existing = existingValue` at `unstage.ts:78` compiles.
  Meanwhile `types.test.ts:141` — `// @ts-expect-error wrapped MCP documents
  require a server record` — asserts as intended behavior that a non-record
  `mcpServers` cannot exist, which is exactly the false premise.
  Fix, in this order: (1) change `types.ts:18` to `readonly mcpServers?: unknown;`
  — this turns both bugs into compile errors, because `getMcpServers` can no longer
  `return m` and `unstage.ts` can no longer `Object.entries(existing)` without
  narrowing; (2) narrow at both sites with the shared plain-object guard (see the
  duplication finding below); (3) replace the `@ts-expect-error` at line 141 with
  positive `satisfies` cases proving `{ mcpServers: null }`, `{ mcpServers: "ref" }`
  and `{ mcpServers: ["a"] }` are all *accepted* by the raw-document type, since
  they are all valid JSON that reaches this code.

- **[WARNING] Four `undefined!` non-null assertions fabricate `ScopedLocations`
  with no comment** — `lines 53, 92, 124, 155`. `!` requires an obvious or
  commented reason; here it also silently defeats the `ScopedLocations` unique-symbol
  brand that `persistence/locations.ts` exists to enforce. Fix: add a one-line
  comment above the first occurrence stating that the branded type cannot be
  constructed in a type-only test and that the value is never dereferenced — or
  build the four literals from a single `const locations = undefined! as ScopedLocations`
  binding carrying that comment once.

### `tests/bridges/mcp/marker.test.ts` (declared clean)

- **[WARNING] `readMarker`'s projection is unproven and `ClaudeMarketplaceMarker`
  gets none of the type-level negatives its 15 sibling types get** — `marker.ts:16`,
  `marker.ts:51`. Mutating `return { plugin: obj.plugin, marketplace: obj.marketplace }`
  to `return marker as ClaudeMarketplaceMarker` survives every case: no marker
  fixture in the file carries an extra field, so the "returns a *projection*, not
  the stored subobject" behavior is never discriminated. Separately,
  `ClaudeMarketplaceMarker` is the only exported type in this directory with no
  `satisfies`/`@ts-expect-error` coverage — `types.test.ts` gives all 15 types in
  `types.ts` readonly-mutation negatives, and this one lives in `marker.ts` and was
  missed. Fix: add one case asserting
  `assert.deepStrictEqual(readMarker({ _piClaudeMarketplace: { plugin: 'p', marketplace: 'm', extra: 1 } }), { plugin: 'p', marketplace: 'm' })`,
  and add `// @ts-expect-error` readonly-write negatives for
  `ClaudeMarketplaceMarker.plugin` / `.marketplace` at the top of the file, in the
  `types.test.ts:229–246` style.

### `tests/bridges/mcp/substitute.test.ts` (declared clean)

- **[WARNING] The `declared = isPlainObject(env) ? env : {}` branch is owned by
  another module's test file** — `substitute.ts:119`. The only proof that a
  non-object declared `env` on a stdio entry does not get spread into the injected
  env lives in `stage.test.ts:252` + `274–278`. `substitute.test.ts`'s four
  `substituteAndInject` cases all pass an object `env` or no `env`. Test ownership
  says the branch belongs to the module's own test. Fix: add a case to
  `describe('substituteAndInject')` with
  `{ command: 'node', env: ['invalid'] }` asserting
  `{ command: 'node', env: { CLAUDE_PLUGIN_ROOT: …, CLAUDE_PLUGIN_DATA: … } }` —
  i.e. the array contributes nothing and no numeric keys leak in.

### `tests/bridges/mcp/collision-slots.test.ts`

- **[WARNING] The 18-line HOME/PI_CODING_AGENT_DIR save-set-restore block is
  copy-pasted into all 7 cases** — `lines 33–50, 71–88, 128–145, 158–175, 189–206,
  231–248, 270–287, 312–329`. Identical bodies, only the surrounding case differs.
  Fix: move the env pinning into `allocateCollisionPaths(t)` (line 18) — it already
  takes `t` and already registers `t.after()` cleanup — so each case's arrange block
  is one call. This is also the helper `stage.test.ts` needs (see the hermeticity
  BLOCKER above), so extract it once as a shared function used by both files.

### `tests/bridges/mcp/unstage.test.ts`

- **[WARNING] The two preservation tables have byte-identical bodies** —
  `lines 278–311` and `lines 333–366`. Thirty lines each, differing only in the
  mkdtemp prefix string. Fix: extract
  `async function assertDocumentPreserved(t: TestContext, prefix: string, storedBytes: string): Promise<void>`
  holding the shared arrange/act/assert, and have both loops call it; keep the two
  tables separate so the titles still distinguish the top-level-non-object branch
  (`unstage.ts:62`) from the nothing-removed branch (`unstage.ts:93`).

### `extensions/pi-claude-marketplace/bridges/mcp/unstage.ts`

- **[WARNING] `EMPTY_RESULT` is one module-level object handed to every caller** —
  `lines 31–34`. Six return paths hand out the same object identity. Its arrays are
  frozen but the object is not, so a single caller mutating it corrupts every future
  noop for the process lifetime. The sibling in `stage.ts:235–239` builds a fresh
  `noopResult` per call. Fix: either wrap it in `Object.freeze({...})` or,
  preferably, build it per call the way `stage.ts` does, and add
  `assert.notStrictEqual(firstUnstage, secondUnstage)` to
  `test('leaves the first rewritten document unchanged on a second unstage')`
  (line 409), which today calls unstage twice and never notices it gets one object.

### `extensions/pi-claude-marketplace/bridges/mcp/` (whole directory)

- **[WARNING] The plain-object guard is written out 10 times in this one directory,
  and the two sites that omit it are the two shipping bugs** — named copies at
  `stage.ts:151` and `substitute.ts:92`; inline conjunctions at `marker.ts:28`,
  `marker.ts:37`, `parse.ts:41`, `parse.ts:50`, `parse.ts:114`,
  `collision-slots.ts:92`, `stage.ts:85`, `unstage.ts:62`. Two further copies of
  the named form live in `orchestrators/import/{marketplaces,settings}.ts`. The
  omissions at `stage.ts:95` and `unstage.ts:74` are precisely the crashes the first
  pass found. Fix: export one `isPlainObject` (a `shared/` leaf, or a
  `bridges/mcp/is-plain-object.ts` with its own paired test) and route all 10 sites
  through it, so the guard cannot drift again. This is the structural reason the
  bug exists and the reason a point-fix at two sites will not hold.

- **[WARNING] Four exports have no production consumer outside their own module** —
  `marker.ts:27 readMarker` (used only by `isOwnedBy` in the same file),
  `parse.ts:29 parseMcpServers` (used only at `parse.ts:80/87/131`),
  `substitute.ts:52 deepSubstitute` (used only at `substitute.ts:108`),
  `collision-slots.ts:31 MCP_COLLISION_SLOTS` (used only at `collision-slots.ts:52`).
  Verified by grep across `extensions/`. Every one is imported by its test file and
  nothing else. `MCP_COLLISION_SLOTS` is the honest case: its module header
  (`collision-slots.ts:5–6`) states outright that "the slot constant is hoisted to a
  named export so snapshot tests can lock the user-contract order" — a doc comment
  admitting a test-only export. `fallow dead-code` cannot see this because
  `.fallowrc.json` sets `production: false`, so test imports count as consumers.
  Fix: for each, decide deliberately — keep the export and document it as part of
  the bridge's public surface, or drop the `export` and let the caller's cases cover
  it. Do not decide by default. `MCP_COLLISION_SLOTS` is the one to keep (the slot
  order genuinely is a user contract worth a snapshot); the other three are
  candidates for un-exporting.

### `extensions/pi-claude-marketplace/bridges/mcp/collision-slots.ts`

- **[WARNING] `MCP_COLLISION_SLOTS` is a function named in `CONSTANT_CASE`** —
  `line 31`. The naming table reserves `CONSTANT_CASE` for module-level constants
  and requires `lowerCamelCase` for functions; this one takes `cwd` and computes a
  fresh frozen array per call. Its own doc comment ("The slot constant is hoisted")
  reflects a shape it no longer has. Fix: rename to `mcpCollisionSlots(cwd)`,
  updating `collision-slots.ts:52` and `collision-slots.test.ts:8/29/59`.

### `extensions/pi-claude-marketplace/bridges/mcp/parse.ts`

- **[WARNING] A string `mcpServers` in a standalone `.mcp.json` produces exactly
  the misleading message the MCPR-01 guard exists to prevent** — `lines 121–131`.
  `parseMcpServers` opens with a dedicated `TypeError` (line 35) so a string
  `mcpServers` is never "mislabeled as a malformed shape". But the standalone
  branch's wrapped/unwrapped detection sends `{ "mcpServers": "./servers.json" }`
  down the *unwrapped* arm, so the whole document is treated as a server map and the
  user gets `server "mcpServers" must be an object.` —
  `parse.test.ts:574` codifies this as intended. Fix: check for a string wrapper
  before the wrapped/unwrapped fork and route it to the same MCPR-01 `TypeError`
  with the standalone path in the label; update the three-row table at
  `parse.test.ts:569–604` so the `"a string"` row expects the MCPR-01 message and
  `null`/array keep the current one.

## Export ownership census

Every export in this area has an owning case. No unowned exports found.

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `stage.ts` | `prepareStageMcpServers` | `stage.test.ts:41`, `:67`, `:137`, `:167`, `:203`, `:237`, `:296`, `:332`, `:355`, `:394`, `:435`, `:473` | owned |
| `stage.ts` | `commitPreparedMcp` | `stage.test.ts:525`, `:581` | owned |
| `stage.ts` | `abortPreparedMcp` | `stage.test.ts:604`, `:625` | owned (weakly — see Branch census) |
| `stage.ts` | `replacePreparedMcp` | `stage.test.ts:648`, `:669`, `:718` | owned |
| `stage.ts` | `rollbackMcpReplacement` | `stage.test.ts:759`, `:781`, `:804`, `:832` | owned |
| `stage.ts` | `finalizeMcpReplacement` | `stage.test.ts:864`, `:899` | owned |
| `unstage.ts` | `unstageMcpServers` | `unstage.test.ts:17` + 10 more | owned |
| `parse.ts` | `parseMcpServers` | `parse.test.ts:19`–`:205` (16 cases) | owned; no production consumer outside `parse.ts` |
| `parse.ts` | `resolvePluginMcpServers` | `parse.test.ts:209`–`:681` (18 cases) | owned |
| `marker.ts` | `CLAUDE_MARKETPLACE_MARKER_KEY` | `marker.test.ts:12` | owned |
| `marker.ts` | `ClaudeMarketplaceMarker` (type) | — | incidental only (structurally via `buildMarker`'s return); no type-level negatives |
| `marker.ts` | `readMarker` | `marker.test.ts:43`–`:148` | owned; no production consumer outside `marker.ts` |
| `marker.ts` | `buildMarker` | `marker.test.ts:25` | owned |
| `marker.ts` | `isOwnedBy` | `marker.test.ts:152`–`:288` | owned |
| `safe-set.ts` | `safeSet` | `safe-set.test.ts:6`, `:32` | owned |
| `substitute.ts` | `McpSubstitutionContext` (type) | `substitute.test.ts:219`, `:267`, `:297`, `:321` (`satisfies`) | owned |
| `substitute.ts` | `deepSubstitute` | `substitute.test.ts:11`–`:169` | owned; no production consumer outside `substitute.ts` |
| `substitute.ts` | `substituteAndInject` | `substitute.test.ts:173`–`:336` | owned; one branch owned by `stage.test.ts` instead |
| `collision-slots.ts` | `MCP_COLLISION_SLOTS` | `collision-slots.test.ts:30` | owned; no production consumer outside `collision-slots.ts`; doc comment admits test-only motivation |
| `collision-slots.ts` | `loadEffectiveServerNames` | `collision-slots.test.ts:68`–`:338` | owned |
| `types.ts` | 15 exported types | `types.test.ts:19`–`:259` | all owned |
| `index.ts` | 8 runtime re-exports | `index.test.ts:50`–`:136` (one case each) | all owned |
| `index.ts` | `McpReplacement`, `PreparedMcpStaging` (type re-exports) | `index.test.ts:40–47` (`Same<>` identity checks) | owned |

One gap in `index.test.ts`'s shape: it proves every *listed* re-export is the same
binding, but nothing proves the barrel does not grow an *extra* export. A dropped
re-export is caught by the compiler; an added one is not. Low value — noted, not
filed as a finding.

## Branch census

**Reachable and untested (findings):**

- `stage.ts:95` — `getMcpServers` with `mcpServers === null` or a string. Crash /
  silent corruption. (First-pass BLOCKER, confirmed.)
- `unstage.ts:74` — `mcpServers === null`. Crash. (First-pass BLOCKER, confirmed.)
  Note `mcpServers` as a *number* or *boolean* also reaches `Object.entries`, which
  returns `[]` for both, so those two shapes are accidentally safe. Only `null`
  crashes and only a string corrupts.
- `stage.ts:116` and `stage.ts:194` — the `safeSet` `__proto__` arms. New BLOCKER above.
- `stage.ts:350` — `requireMcpReplacementInternals` reached from
  `rollbackMcpReplacement`. New WARNING above.
- `stage.ts:288` — the two-source warning concatenation with both sources non-empty.
- `substitute.ts:119` — the non-plain-object `env` arm, covered only from
  `stage.test.ts`.

**Unreachable by real input (production dead code):**

- `stage.ts:276` — `input.sourcePath ?? \`${pluginName}#mcpServers\``. All three
  production call sites pass `sourcePath` explicitly:
  `orchestrators/plugin/install.ts:1126`, `update.ts:1363`, `reinstall.ts:1245`,
  each with `` `${pluginRoot}#mcpServers` ``. The fallback arm is executed only by
  tests. See the grading of the first-pass BLOCKER below for the fix.

**Compiler-forced and not removable (D-116-01a):**

- None found in this area. Every guard here is a real runtime guard over
  `JSON.parse` output, not a TypeScript-appeasing arm.

**Covered branches worth naming (so the fixing pass does not re-derive them):**
`readScopedDoc`'s ENOENT / ENOTDIR / other-errno / parse-error / non-object arms
(`stage.test.ts:41, 332, 355, 167, 296`); `assertNoMcpCollisions`'s empty-names,
`ours.has`, cross-slot, and same-path-then-`theirs` arms (`stage.test.ts:137, 67,
435, 394`); `readOptionalText`'s both arms (`stage.test.ts:781, 718`);
`loadEffectiveServerNames`'s missing / malformed / wrapped / unwrapped /
first-declarer-wins / propagate arms (`collision-slots.test.ts:68–338`);
`resolvePluginMcpServers`'s full precedence chain and every error arm
(`parse.test.ts:209–681`).

## Grading of first-pass findings

### `tests/bridges/mcp/stage.test.ts`

- **UNDERSTATED** — *`sourcePath` fallback branch executed but never asserted*.
  The five cases and the unasserted-branch diagnosis are exactly right, but the
  prescribed fix is the wrong one. All three production call sites pass `sourcePath`
  (`install.ts:1126`, `update.ts:1363`, `reinstall.ts:1245`), so the fallback is
  unreachable production code kept alive solely by these tests — adding an
  assertion would freeze dead code into the contract. Correct fix: make
  `sourcePath` required in `StageMcpInput` (`types.ts:52`), delete the `??` at
  `stage.ts:276`, remove the now-invalid `@ts-expect-error` at `types.test.ts:163`,
  and pass an explicit `sourcePath` in the five cases. Severity stays BLOCKER; the
  category changes from "missing assertion" to "unreachable branch".
- **CONFIRMED** — *No case for a scoped `mcpServers` field that is `null` or a bare
  string*. Verified: `Object.entries(null)` throws and `Object.entries("s")`
  enumerates characters; `readScopedDoc` reports `malformed: false` for
  `{"mcpServers":"s"}` because the top level is an object, so the corruption is
  emitted with no warning at all.

### `tests/bridges/mcp/unstage.test.ts`

- **CONFIRMED** — *No case for a scoped `mcpServers` field that is `null`*. The
  data table at lines 314–332 does omit it, and the file's own string row passes
  only because no single character can satisfy `isOwnedBy`, exactly as recorded.
- **CONFIRMED** — *Helper lacks a return-type annotation* (`line 10`). ESLint's
  `explicit-module-boundary-types` only covers exported functions, so nothing gates
  this; the three named siblings do annotate.
- **REFUTED** — *Default import of `test` instead of the named import used
  everywhere else* (`line 5`). Repo-wide the default form is used by **112** unit
  test files against 131 named-form files, and within `tests/bridges/` **23** files
  use it — including this file's three direct namesakes
  `bridges/agents/unstage.test.ts`, `bridges/skills/unstage.test.ts`, and
  `bridges/commands/unstage.test.ts`. The claim "every other file in this suite"
  holds only inside `tests/bridges/mcp/` and inverts the actual cross-bridge
  convention. Not a finding.

### `tests/bridges/mcp/collision-slots.test.ts`

- **CONFIRMED** — *Weaker error assertion than every sibling case*
  (`lines 333–338`). `assert.rejects(p, { code: 'EISDIR' })` checks neither the
  class nor `syscall`; `parse.test.ts:453` and `stage.test.ts:355` both project
  `{ name, code, syscall }` through a validator callback. The suggested replacement
  in the first-pass file is correct as written.

### `extensions/pi-claude-marketplace/bridges/mcp/stage.ts`

- **CONFIRMED** — *`getMcpServers` does not guard against `null` or a
  non-object-non-array `mcpServers` value* (`lines 92–100`). Trace and consequences
  as recorded. The recorded fix is right but incomplete: apply it together with the
  `RawMcpDoc.mcpServers?: unknown` change (new BLOCKER above), or the same omission
  can recur at the next site that reads the field.
- **CONFIRMED** — *Three exported functions have no doc comment* (`lines 327, 343,
  370`). `replacePreparedMcp`, `rollbackMcpReplacement` and `finalizeMcpReplacement`
  are undocumented while their three siblings in the same file carry full JSDoc.
  The `mcpReplacementInternals` `WeakMap` and the meaning of a non-empty
  `rollbackMcpReplacement` return in particular are not inferable from the names.

### `extensions/pi-claude-marketplace/bridges/mcp/unstage.ts`

- **CONFIRMED** — *Missing `mcpServers: null` guard crashes `unstageMcpServers`*
  (`lines 71–78`). Same class as the `stage.ts` defect, and the uninstall path makes
  it the more damaging of the two.

### `extensions/pi-claude-marketplace/bridges/mcp/collision-slots.ts`

- **UNDERSTATED** — *`MCP_COLLISION_SLOTS` reads two live boundaries inline*
  (`lines 31–38`). Recorded as WARNING with "this is not causing flakiness today,
  the test suite works around it correctly". That is true of
  `collision-slots.test.ts` and false of the module's real second consumer:
  `stage.ts:134` calls `loadEffectiveServerNames` inside `prepareStageMcpServers`,
  and `stage.test.ts` pins neither `HOME` nor (in 16 of 17 cases)
  `PI_CODING_AGENT_DIR`. The hidden dependency therefore propagates into ~17 cases
  that read the developer's real `~/.config/mcp/mcp.json` and `~/.pi/agent/mcp.json`
  — the latter being a file this extension itself writes. Severity should rise to
  **BLOCKER**: this is a production testability defect with a demonstrated
  hermeticity consequence, not a signature-clarity nit. The recorded fix
  (`homeDir`/`agentDir` as explicit parameters, wired at the composition site, no
  live defaults) is the right one and now also fixes the `stage.test.ts` break.

## Still clean after attack

- `tests/bridges/mcp/safe-set.test.ts` — genuinely clean. Catches: swapping the
  `__proto__` and ordinary branches (test at line 32 fails on prototype identity
  and on empty `Object.entries`); flipping `enumerable`, `writable`, or
  `configurable` (both cases compare the whole property descriptor); reparenting
  the accumulator (`Object.getPrototypeOf` asserted in both). Two cases, two
  branches, no surviving mutation found.
- `tests/bridges/mcp/index.test.ts` — clean. All 8 runtime re-exports get an
  identity assertion, and the two type re-exports get bidirectional `Same<>`
  checks; re-pointing any re-export at a different function fails immediately.
  Only an *added* export would slip through.
- `tests/bridges/mcp/marker.test.ts` — strong apart from the projection mutation
  filed above. Catches: swapping `plugin`/`marketplace` in either `buildMarker` or
  `readMarker` (distinct literal values plus `deepStrictEqual`); changing `&&` to
  `||` in `isOwnedBy` (the "a different plugin" row fails); dropping any of the
  four `Object.hasOwn` guards (four dedicated inherited-property cases, which is
  more than most files in this repo bother with); accepting a non-string
  `plugin`/`marketplace`.
- `tests/bridges/mcp/parse.test.ts` — clean. Catches: cloning instead of returning
  the input map (`assert.strictEqual(parsedServers, servers)` at line 50);
  reordering the MC-1 precedence chain (three dedicated precedence cases, each with
  a decoy at the lower-precedence sources); falling through on a malformed matched
  source (lines 606, 644); losing the `cause` chain on malformed JSON (line 487
  compares the projected cause); swapping `Error` for `TypeError` on the MCPR-01
  string path (`constructorName` is projected on both sides). Error assertions here
  are the best form in the area and should be the template for the
  `collision-slots.test.ts` fix.
- `tests/bridges/mcp/substitute.test.ts` — strong apart from the missing
  non-object-`env` case. Catches: mutating the input (original-object comparison
  plus three `notStrictEqual` identity checks); re-expanding a substituted value
  (line 96 row); dropping any of the three variables from `VAR_RE`; injecting
  `CLAUDE_PROJECT_DIR` into a user-scope entry (line 255); injecting env into a
  url-type entry (line 286); reversing the injected/declared spread order (line 189
  declares `CLAUDE_PLUGIN_ROOT` and expects the declared value to win); regex
  replacement-pattern expansion of `$1`/`$&` (line 105 row).
- `tests/bridges/mcp/types.test.ts` — the type-only pattern is applied correctly:
  15 types, positive `satisfies` plus `@ts-expect-error` negatives for missing
  fields, wrong discriminants, cross-arm narrowing, readonly writes, and readonly
  arrays via `IsMutableArray`. Widening any `readonly T[]` to `T[]` fails through
  the unused-directive error. The finding above is about *what* it pins, not how.
- `tests/bridges/mcp/unstage.test.ts` — apart from the missing `null` row and the
  duplicated table body, this is the strongest file in the area. Catches: any key
  reordering or whitespace change in the written document (byte-exact
  `expectedBytes` in three cases); any rewrite on a noop (`ino`/`size`/`mtimeNs`/
  `ctimeNs` compared in 10 cases); dropping the WR-01 `safeSet` at `unstage.ts:89`
  (`__proto__` and `constructor` fixtures, plus a global-prototype-untouched check
  at line 145); relaxing owner matching to plugin-only or marketplace-only (two
  decoy entries at lines 31 and 41); losing the error `cause` (line 226).
- `extensions/pi-claude-marketplace/bridges/mcp/{safe-set,marker,index}.ts` — no
  production findings. `safe-set.ts` is a correct, minimal, well-documented guard;
  `marker.ts` validates every level with `Object.hasOwn` and never throws;
  `index.ts` deliberately withholds `_nextDoc` from the public surface and says why.

## Not covered

- No test, lint, typecheck, or coverage command was run, per the diagnostic
  restriction. All mutation verdicts are from reading the source and tracing call
  graphs, not from executing a mutated build. The two runtime facts I depended on
  were checked with throwaway `node -e` snippets that touched no repository file:
  `os.homedir()` returns `process.env.HOME` on this platform, and
  `~/.config/mcp/mcp.json` / `~/.pi/agent/mcp.json` do not exist on this machine
  (which is why the hermeticity break is currently invisible).
- Per-pair coverage was not measured. My branch census is derived by reading, and
  the still-outstanding `npm run test:coverage:direct` run could surface arms I
  judged covered.
- I did not review how `tests/integration/`, `tests/e2e/`, or `tests/live-uat/`
  exercise this bridge; if any of them stage a `__proto__`-named server or a
  `null` `mcpServers`, my "no case anywhere" claims narrow to the unit suite. The
  greps I ran covered all of `tests/`, so I believe they hold, but the integration
  files were not read.
- `orchestrators/plugin/{install,update,reinstall}.ts` were read only at their
  `prepareStageMcpServers` call sites, to settle the `sourcePath` reachability
  question. Their own test coverage is another area's.

## Meta-findings impact

### New cross-cutting evidence

**1. `withHermeticHome` is a convention with no home, and at least one consumer of
the unpinned boundary was missed.** Ten test files hand-roll their own
`withHermeticHome` (`tests/orchestrators/plugin/{install,list,update,uninstall,reinstall,enable-disable,info}.test.ts`,
`tests/orchestrators/marketplace/{list,info,autoupdate,update}.test.ts`,
`tests/architecture/cross-op-convergence.test.ts`,
`tests/integration/transaction-lifecycle-cascade.test.ts`) with at least three
different signatures. There is no shared implementation. That matters beyond
duplication: a file that does not *know* it reaches `homedir()` never adopts it, and
`tests/bridges/mcp/stage.test.ts` is exactly that case — it reaches `homedir()`
three call-frames deep through `loadEffectiveServerNames`. **Other areas should be
checked the same way: grep for every transitive path to `homedir()`,
`getAgentDir()`, `os.tmpdir()`-adjacent real paths, and `process.env` reads, then
check whether the *test file at the top of that path* pins them.** The bridges
(`agents`, `skills`, `commands`, `hooks`) and `persistence/locations.test.ts` are
the first places to look, since `getAgentDir()` is what `locationsFor('user', …)`
resolves through. META-FINDINGS' "Gates that do not gate" section has a sibling
here: *hermetic helpers that do not hermeticize*, because they are applied by file
rather than by dependency.

**2. A guard copy-pasted N times will be omitted at site N+1, and the type system
was the thing that could have stopped it.** The `mcp.json` null/string bug that
META-FINDINGS ranks first in sequencing is not two independent oversights: the
plain-object guard is written out **10 times inside `bridges/mcp/` alone** (2 as a
named `isPlainObject`, 8 inline) plus twice more in `orchestrators/import/`, and the
two sites that omitted it are precisely the two bugs. The enabling cause is
`types.ts:18` declaring `mcpServers?: Record<string, unknown>` on a type built by
casting raw `JSON.parse` output — so the omission *type-checked*. **Recommend the
sequencing item be widened from "fix the two guards" to "type every
`JSON.parse`-derived field as `unknown` and route every plain-object check through
one shared predicate", and that other areas be swept for the same shape: an
interface whose fields describe what the JSON *should* contain, reached through an
`as` cast from `JSON.parse`.** `persistence/state-io.ts`, `persistence/config-io.ts`,
`domain/manifest.ts`, and `bridges/hooks`'s config parsing are the obvious
candidates. This is the same silent-omission family META-FINDINGS already names
under "Restore exhaustiveness on closed-union switches", one level down: the
compiler could enforce it and was told not to.

**3. `fallow production: false` makes test-only exports invisible to the dead-code
gate, and this area has four.** `readMarker`, `parseMcpServers`, `deepSubstitute`,
and `MCP_COLLISION_SLOTS` are each imported by exactly one test file and by nothing
in `extensions/` outside their own module. None can ever be reported by
`fallow dead-code` while `production: false` holds. This is adjacent to
META-FINDINGS item 2 ("Replace test-only hooks over module-global state") but is a
distinct and much cheaper class — no state, no reset hook, just export widening —
and it is systematically un-gated repo-wide. **Recommend a one-off sweep:
`fallow dead-code --production` (a probe only; the operator owns the
`production: false` decision) or a scripted "exported symbol whose only non-local
importer is under `tests/`" query, run across all areas.** Expect this to be a
large, low-severity, high-count cluster.

**4. `MCP_COLLISION_SLOTS`'s doc comment is a third data point for META-FINDINGS'
"doc comments cut both ways" note** — and it is the *honest* kind:
`collision-slots.ts:5–6` states plainly that the export exists "so snapshot tests
can lock the user-contract order". That makes three known instances
(`completion-cache.ts` honest, `routing-state.ts` false, `collision-slots.ts`
honest). The pattern holds: the doc comment is a *lead*, never evidence — but a
comment that admits test-only motivation has been right 2 for 2 so far.

### Corrections to META-FINDINGS.md

- **"`bridges/mcp/stage.ts` `getMcpServers`, and the parallel check in `unstage.ts`
  — … Traced end-to-end and confirmed … **This is a shipping bug; fix it ahead of
  any test work.**"** — the bug is confirmed, but the framing as *two sites* is
  wrong and will produce an incomplete fix. Evidence: `types.ts:18` types the field
  as `Record<string, unknown>` while both readers reach it via
  `parsed as RawMcpDoc` (`stage.ts:89`, `unstage.ts:69`), and the guard those two
  sites omitted exists in 10 other places in the same directory. Correction: the
  sequencing item is "change `RawMcpDoc.mcpServers` to `unknown`, extract one shared
  plain-object predicate, and let the compiler locate every site" — the two-site
  patch leaves the mechanism that produced the bug fully intact.

- **"Confidence: findings are reliable; clean verdicts are not."** — this area
  shows the failure mode is not confined to `### Clean files`. The first pass
  reviewed `stage.test.ts` closely enough to enumerate five cases by line number and
  still declared the area "one of the stronger areas of the suite: real `mkdtemp`
  filesystem fixtures per case, … no doubles misuse", while ~17 of that file's cases
  read the developer's real home directory. Correction: an *examined* file's
  unexamined *axis* is as unfalsified as an unexamined file. Hermeticity in
  particular was assessed by looking for `mkdtemp` and cleanup, which is only half
  of it — the other half is what the production code reads that the test never
  named.

- **"Patterns to propagate" table** — `tests/bridges/mcp/unstage.test.ts` deserves a
  row: *proving quiet-on-noop by comparing `ino`/`size`/`mtimeNs`/`ctimeNs` across
  the call* (`unstage.test.ts:297–310`, applied in 10 cases). It is a stronger proof
  than "assert the file is unchanged" and directly discriminates the D-04 /
  PRD §5.7 contract that a noop must not rewrite. Nothing else in the sweep summary
  names it, and several other bridges make the same quiet-on-noop promise.

### Confirmations

- **"Real defects found outside the test layer … `bridges/mcp/stage.ts`
  `getMcpServers`, and the parallel check in `unstage.ts`"** — independently
  confirmed by re-tracing both call chains: `getMcpServers` (`stage.ts:93–100`)
  returns `null` unguarded into `partitionExistingServers` (`stage.ts:109`,
  `Object.entries(null)` throws), and returns a string into the same loop, where
  `safeSet(theirs, "0", "s")` per character then merges into
  `{ ...theirs, ...stamped }` at `stage.ts:270` and is atomically written — with
  `readScopedDoc` reporting `malformed: false`, so no warning is emitted.
  `unstage.ts:74–82` has the identical null hole. Both are real and the string case
  is silent.

- **"The dominant shape: sibling drift"** — confirmed four more times in this one
  area, each with a named in-repo target: two WR-01 `safeSet` call sites uncovered
  while their two siblings are covered; `Object.isFrozen` asserted on the noop
  branch and not the staged one in the same file; `rollbackMcpReplacement`'s
  unknown-handle throw untested while `finalizeMcpReplacement`'s is; a weak
  `assert.rejects` shape in `collision-slots.test.ts:337` beside two full
  projections in `parse.test.ts:453` and `stage.test.ts:355`.

- **"Per-area severity is not globally calibrated"** — confirmed from the other
  direction. This area's first pass rated a production hidden-dependency
  (`homedir()`/`getAgentDir()` read inline) a WARNING on the strength of "the test
  suite already works around it correctly" — which was true of the file in front of
  the reviewer and false of the module's other consumer. Severity assigned from
  one file's vantage under-rates any defect whose consequence lands in a different
  file, which is the same mechanism behind the 6-BLOCKERs-vs-1-WARNING split
  recorded for the injection seam.
