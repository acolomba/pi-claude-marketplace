# Domain — resolver (slice B) — adversarial re-review

**Scope:** `tests/domain/resolver.test.ts` lines 2000–3949 (72 `test()` cases: the
`SEV-02`/`SURF-05`/`PHOOK-01` hook-drop block, the ten `gitCtx` PURL cases, the
`COMP-01` custom-path fixtures, the `rowClaimsInstallDisabled` row loops, the whole
loose-mode `MM-6`/`MM-7`/`DFEN-02`/`D-101-08` block, the `RES-01` exact-shape block,
and the NFR-7 compile-time proof block at 3829–3949), plus the arms of
`extensions/pi-claude-marketplace/domain/resolver.ts` those cases exercise
(`deriveSourcePluginRoot`, `classifySourceSupport`, `applyLooseMcp`,
`collectLooseComponentKind`, `applyMcpValue`, `resolveDefaultEnabled`,
`decideResolution`, `requireInstallable`, `requirePartialInstallable`, and the
three arm schemas / `MaterializablePlugin`).
**First-pass file:** `unit-test-findings/domain-resolver.md`
**Clean files attacked:** 0 files were listed clean — the first pass recorded
`(none beyond the findings above)` for both sections. In place of a clean list I ran
the mutation catalogue against the parts the first pass implicitly blessed: the ~11
"exemplary" whole-object cases it named as the fix template, the NFR-7 proof block,
and the structural claims in its Summary ("no hand-rolled doubles standing in for
`strong-mock`", "the production module is genuinely pure").
**Existing findings graded:** 6 (4 unit-test, 2 production)

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 5 |
| New WARNING (missed by first pass) | 10 |
| Existing CONFIRMED | 5 |
| Existing UNDERSTATED | 0 |
| Existing OVERSTATED | 1 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 0 |

The first pass's picture held up on everything it looked at. What it missed is a
different class from what it found: it graded *assertion strength* case by case and
never asked what the module's one injected collaborator is promised to receive, nor
whether the compile-time proof block actually pins the asserts clauses it advertises.
Both gaps sit exactly where the assignment predicted the stakes were highest.

## New findings — from the (empty) clean lists

### `tests/domain/resolver.test.ts`

- **[BLOCKER] The resolver's only injected collaborator is never asserted — arguments,
  call count, or non-invocation** — `lines 2183–2193`, consumed by ten cases at
  2197, 2223, 2253, 2278, 2321, 2341, 2359, 2376, 2396, 2425
  The `gitCtx` helper installs `resolveGitPluginRoot(): Promise<GitPluginRootResult>`
  — **a zero-parameter function that discards whatever it is handed**. Every one of
  these mutations to `resolver.ts:815` (`const r = await ctx.resolveGitPluginRoot(parsedSource)`)
  leaves all ten cases green:
  (a) pass `entry.source` (the raw untrusted value) instead of the `parsePluginSource`
  output — the clone-cache would then key on an unnormalised source;
  (b) pass a hard-coded `{ source: "github", repo: "x/y" }`;
  (c) call the callback twice (double device-flow prompt / double clone);
  (d) call it for a `path` source too (`resolver.ts:790` guard removed) — at 2321 the
  escape check still fires first, so the extra call is invisible.
  Only (d) is partially caught, and only by luck. Nothing anywhere else in `tests/`
  covers this: `tests/orchestrators/plugin/clone-cache.test.ts` tests the *callback's*
  implementation (`resolveGitPluginRootWithSubdir`), never the resolver's forwarding.
  Fix: replace the hand-rolled callback with the repo's sanctioned interaction mock —
  `const resolveGitPluginRoot = mock<NonNullable<ResolveContext["resolveGitPluginRoot"]>>({ exactParams: true, name: "resolveGitPluginRoot" })`,
  `when(() => resolveGitPluginRoot({ source: "git-subdir", url: "https://gitlab.com/o/p", path: "packages/plug" })).thenResolve({ kind: "materialized", pluginRoot: subRoot, resolvedSha: "…" })`,
  `verify(resolveGitPluginRoot)` last in the case. For the two cases that must prove the
  port is *not* touched (2276 `npm`, 2317 `path` escape), pass the same mock with **zero**
  expectations and still `verify()` — the silence proof `tests/orchestrators/reconcile/notify.test.ts`
  already models and META-FINDINGS already names.

- **[BLOCKER] The `not-cached` arm's note is the one git arm nobody asserts — sibling
  drift inside a single `switch`** — `test('PURL-01: not-cached result -> unavailable (never carries pluginRoot)')`
  line 2374
  `resolver.ts:825-829` returns `unavailable(entry.name, [...partial.notes, "not installed"])`.
  The case asserts only `state === "unavailable"` and `!("pluginRoot" in resolvedPlugin)`.
  Its two siblings in the *same switch statement* — `escapes` (2338) and `missing-subdir`
  (2356) — both assert `notes.includes(detail)`. Mutating the literal to `"not cached"`,
  `"clone missing"`, or `[]` leaves 2374 green. The literal is a documented cross-module
  contract: `resolver.ts:777`, `orchestrators/plugin/list.ts:378`, and
  `orchestrators/plugin/git-source-probe.ts:241` all name `unavailable{not installed}` as
  the mapped outcome, and `orchestrators/plugin/reinstall.messaging.ts:397` **exact-matches
  the string** (`if (note === "not installed")`) to stamp `error` severity. `grep -n
  'not installed' tests/domain/resolver.test.ts` returns nothing.
  Fix: replace both assertions with the whole-verdict compare the file already uses at
  3386 — `assert.deepStrictEqual(resolvedPlugin, { state: "unavailable", installable: false, name: "p1", notes: ["not installed"] })`.
  That also subsumes the `in` check.

- **[BLOCKER] `applyMcpValue`'s `detail` parameter and its whole `else` branch can be
  deleted with the suite green** — `test('MM-7 entry.mcpServers malformed (non-object) in loose mode -> unavailable + malformed mcpServers note')`
  line 2992, plus 932, 1473, 1521, 1880
  `resolver.ts:1345-1366` emits `malformed mcpServers: <detail>` when `detail` is true
  and the bare `malformed mcpServers` when false; `applyLooseMcp` (`resolver.ts:1474`) is
  the sole `false` call site, and it is a deliberate strict/loose asymmetry. **All six
  assertion sites in the suite are `notes.some((n) => n.includes("malformed mcpServers"))`,
  which is true for both strings.** Delete the parameter and the `else` branch, always
  emit the detailed form: everything stays green. Nothing pins the strict form's detail
  suffix either.
  Fix: at 2992 assert the whole verdict —
  `assert.deepStrictEqual(resolvedPlugin, { state: "unavailable", installable: false, name: "p1", notes: ["malformed mcpServers"] })`
  — and at one strict-side site (919 or 1459, slice A) assert the exact detailed string
  the TypeBox validator produces. Two exact strings, one per branch, is the whole fix.

- **[BLOCKER] `requireInstallable`'s asserts clause has no compile-time proof at all** —
  `lines 3829–3949`
  The proof block builds five `@ts-expect-error` negatives and six `satisfies` positives,
  and pins `requirePartialInstallable` (3886, 3891) — but there is **no proof function
  for `requireInstallable`**, the strict gate every install path narrows through
  (`orchestrators/plugin/install.ts`). Mutating `resolver.ts:1695` from
  `asserts r is ResolvedPluginInstallable` to `asserts r is MaterializablePlugin` (or to
  `asserts r is ResolvedPlugin` with the body unchanged) compiles clean and passes every
  runtime case, because the four runtime cases (1975, 3500, 3527, 3808) only observe the
  thrown error, never the narrowed type. That silently lets an install path read a
  `partially-available` plugin through a holder typed `ResolvedPluginInstallable`.
  Fix: add, beside `gateNarrowsForce`, the positive that kills the widening —
  ```ts
  function strictGateNarrowsToInstallable(): ResolvedPluginInstallable {
    requireInstallable(resolvedPluginContract);
    return resolvedPluginContract;
  }
  ```
  and a `@ts-expect-error` negative asserting `const bad: ResolvedPluginPartiallyAvailable = resolvedPluginContract;`
  no longer type-checks after the call. Add both names to the `void` reference list at 3936.

- **[BLOCKER] `requirePartialInstallable`'s narrowing is under-constrained in the
  over-narrow direction** — `gateNarrowsForce` line 3886, `gateExcludesUnavailable` line 3891
  Mutate `resolver.ts:1743` from
  `asserts r is ResolvedPluginInstallable | ResolvedPluginPartiallyAvailable` to
  `asserts r is ResolvedPluginInstallable`. `gateNarrowsForce` still compiles
  (`pluginRoot` is on the installable arm). `gateExcludesUnavailable`'s `@ts-expect-error`
  still fires, because `ResolvedPluginInstallable` is no more assignable to
  `ResolvedPluginUnavailable` than the union was — **the negative passes for a reason
  that has nothing to do with the gate.** Every runtime call site survives too: at 3303
  and 2900 the value is already narrowed to the partially-available arm by the preceding
  `assert.strictEqual`, so the mutated assertion collapses it to `never`, and property
  access on `never` is legal. Result: the gate silently stops admitting the
  partially-available arm, which is the entire point of D-64-04 / `--partial`.
  Fix: add the negative that fires *only* in the over-narrow direction —
  ```ts
  function gateKeepsThePartialArm(): void {
    requirePartialInstallable(resolvedPluginContract);
    // @ts-expect-error -- the gate admits partially-available, so it must not narrow to installable alone.
    const tooNarrow: ResolvedPluginInstallable = resolvedPluginContract;
    void tooNarrow;
  }
  ```
  Keep `gateNarrowsForce` (it kills the no-narrowing direction) and add
  `gateKeepsThePartialArm` to the `void` list.

- **[WARNING] `.sort()` on the production result destroys the one ordering assertion in
  the file** — `test('MM-6 loose happy path: entry declares skills and commands -> installable with both supported')`
  line 3198
  `assert.deepStrictEqual(resolvedPlugin.supported.sort(), ["commands", "skills"])` both
  mutates the returned array in place and compares a sorted projection. `supported` is
  built in `runStructuralStages` by iterating `SUPPORTED_COMPONENT_PATH_KINDS`
  (`resolver.ts:1597`), so the real order is `["skills", "commands"]`. Reordering that
  tuple survives — this is the only multi-element `supported` assertion in the file
  (every other one is `.includes(...)` or a single-element literal at 3418), so nothing
  anywhere pins the order.
  Fix: `assert.deepStrictEqual(resolvedPlugin.supported, ["skills", "commands"])`. Drop
  the `.sort()`; never sort a value under test.

- **[WARNING] Standalone negative assertion on `state` in the D-101-08 metadata-conflict
  case** — `test('DFEN-02 manifest-only defaultEnabled with a silent entry -> resolves carrying false, not a conflict')`
  line 2781
  `assert.notStrictEqual(resolvedPlugin.state, "unavailable")` passes for both remaining
  arms. The case's own header (2760–2767) claims it is "the only thing that would notice
  if a later edit widened the conflict machinery" — true for the *conflict-note* widening
  it names, but a widening that routed a manifest-only `defaultEnabled` into
  `partial.unsupported` instead (state → `partially-available`, note → `contains …`)
  passes every assertion in the case.
  Fix: `assert.strictEqual(resolvedPlugin.state, "installable")` followed by the whole-verdict
  `assert.deepStrictEqual` in the 3338 template. Drop the two negative `assert.ok(!…)` checks;
  the literal comparison subsumes them.

- **[WARNING] `Object.keys(...)` where the whole map is the promise** —
  `test('MM-7 entry.mcpServers present + valid -> installable with mcpServers populated')`
  line 2968
  `assert.deepStrictEqual(Object.keys(resolvedPlugin.mcpServers), ["srv1"])` survives
  `partial.mcpServers = { srv1: {} }`. The strict sibling at 3754 already compares the
  full map (`mcpServers: { srv: { command: "node" } }`).
  Fix: `assert.deepStrictEqual(resolvedPlugin.mcpServers, { srv1: { command: "node" } })`.

- **[WARNING] `typeof x === "string"` where the sibling compares the value** —
  lines 3288 and 3304 (`RSTATE-04 loose` pair)
  Both assert only `assert.strictEqual(typeof resolvedPlugin.pluginRoot, "string")`, which
  survives `materializableFields` returning `pluginRoot: name`. The strict sibling at 3469
  does it right: `assert.deepStrictEqual([installablePlugin.pluginRoot, partiallyAvailablePlugin.pluginRoot], [localRoot, localRoot])`.
  Fix: compare against `pathUnderMarketplace("./local")` in both cases.

- **[WARNING] `Object.defineProperty` fixture diverges from the file's own
  invalid-value-smuggling pattern and creates a non-enumerable property** —
  `test('rowClaimsInstallDisabled treats an invalid entry default as silent')` line 2637
  `Object.defineProperty(entry, "defaultEnabled", { value: "false" })` defaults to
  `enumerable: false, writable: false, configurable: false`, so the fixture is not the
  shape a real marketplace author produces. It models "a non-boolean smuggled past
  `PLUGIN_ENTRY_VALIDATOR`" (`resolver.ts:678`), which would be an ordinary own enumerable
  property. Every other invalid-value case in this file uses the `pluginEntry({ … })`
  helper (`source: 42` at 2453, `mcpServers: 42` at 2998), which type-checks because
  `LooseEntry` is `Record<string, unknown>` and `PluginEntry`'s `defaultEnabled` is optional.
  Fix: `const entry = pluginEntry({ name: "alpha", source: "./alpha", defaultEnabled: "false" });`
  and delete the `Object.defineProperty` line.

- **[WARNING] The NFR-7 negative block proves only two of the seven fields D-64-05 omits** —
  `lines 3869–3932`
  `consumeUnavailable` (3869) and `unavailableHasNoDefaultEnabled` (3929) pin `pluginRoot`
  and `defaultEnabled`. Nothing pins `supported`, `unsupported`, `componentPaths`,
  `mcpServers`, `hooksConfigPath`, `orphanRewake`, or `droppedHooks`. Adding any of them
  to `ResolvedPluginUnavailableSchema` (`resolver.ts:226`) as `Type.Optional(...)` compiles
  clean — the `unavailable()` constructor at 446 still satisfies the widened type and the
  runtime output is byte-identical, so 3386's `deepStrictEqual` stays green — and a
  consumer can then read a component list off a structurally-broken plugin.
  Fix: propagate the technique **the production file already uses**. `resolver.ts:138`
  (`_DroppedHookArmKeysMatch`) is a tuple-wrapped two-directional `keyof` parity guard.
  Add its mirror to the test's proof block:
  ```ts
  type _UnavailableKeysExact = [keyof ResolvedPluginUnavailable] extends
    ["state" | "installable" | "name" | "notes"]
    ? ["state" | "installable" | "name" | "notes"] extends [keyof ResolvedPluginUnavailable]
      ? true
      : false
    : false;
  void (true satisfies _UnavailableKeysExact);
  ```
  One guard replaces seven `@ts-expect-error` lines and catches removals as well as additions.

- **[WARNING] Two exports of the paired module are owned by another module's test** —
  `SUPPORTED_COMPONENT_KINDS` / `UNSUPPORTED_COMPONENT_KINDS`
  Their closed-set cases live in `tests/architecture/hooks-foundation.test.ts:199` and `:207`,
  not in the pair. Per the pairing rule the paired test module owns the source module's
  exported behavior; an architecture test asserting `[...SUPPORTED_COMPONENT_KINDS]`
  equals a 4-tuple is a plain unit assertion about a `domain/resolver.ts` export.
  Fix: move the two closed-tuple cases into `tests/domain/resolver.test.ts`. Leave in
  `hooks-foundation.test.ts` only the genuinely cross-module claim (that `hooks` is in one
  tuple and not the other *and* that the bridge/renderer agree), which is what an
  architecture test is for.

- **[WARNING] `resolveContext` re-declares the exported `StatKind` shape instead of
  importing it** — `lines 44 and 57` (helper used by every case in this slice)
  `statKind(p: string): Promise<"file" | "dir" | null>` hand-repeats the `StatKind` alias
  the module exports at `resolver.ts:265`, and `readFileText` hand-repeats
  `(p: string) => Promise<string>`. A change to `StatKind` (e.g. adding `"symlink"`)
  leaves the fake silently stale. `GitPluginRootResult` is imported properly at line 14 —
  same file, same helper, inconsistent.
  Fix: `import { type StatKind, type StatKindReader, … }` and type the fake's members as
  `StatKindReader` / `NonNullable<ResolveContext["readFileText"]>`.

- **[WARNING] The `op: "update"` × partial-arm throw is pinned only on `shape.kind`** —
  `test('requireInstallable classifies an update of the partial true arm')` line 3808
  Its three neighbours (3489, 3515, 3541) each `deepStrictEqual` the whole `error.shape`.
  This one asserts `error.shape.kind` alone, so a mutation that emitted
  `partialable: false` or `unsupportedKinds: []` on the update path — suppressing the
  `--partial` hint on every update failure row — survives.
  Fix: `assert.deepStrictEqual(error.shape, { kind: "no-longer-installable", plugin: "p1", reasons: ["contains themes"], partialable: true, unsupportedKinds: ["themes"] })`.

- **[WARNING] Near-duplicate scenario, one strong copy and one weak copy** —
  `test('COMP-01 entry > manifest declared order; first-wins dedup across both')` line 2572
  vs. `test('resolveStrict preserves declared-first implicit-last ordering with first-wins deduplication')`
  line 3394. Same entry (`["entry-only", "shared"]`), same manifest (`["shared", "manifest-only"]`);
  3394 additionally has the conventional `skills/` dir on disk and compares the **whole**
  verdict, 2572 lacks the dir and compares one array.
  Fix: keep 3394; rewrite 2572 as the narrow "implicit dir absent → no implicit entry
  appended" case it uniquely covers, and give it the same whole-verdict compare. Do not
  simply delete it — the absent-convention path is not otherwise covered in strict mode.

- **[WARNING] Eighteen conditional assertion blocks are one edit away from silent vacuity** —
  2041, 2083, 2125, 2159, 2215, 2246, 2271, 2501, 2531, 2562, 2600, 2697, 2745, 2967,
  3056, 3095, 3194, 3229
  Each is `assert.strictEqual(resolvedPlugin.state, X)` followed by
  `if (resolvedPlugin.state === X) { …the real assertions… }`. **All eighteen are currently
  non-vacuous** — I checked every one. But `@typescript-eslint/no-unnecessary-condition` is
  switched off for `tests/**` (`eslint.config.js:313`), so neither an always-true guard nor
  an always-false one is reported: relax or delete the preceding `strictEqual` and the whole
  block turns into a no-op that still reports green.
  Fix: prefer the two forms this file already uses that cannot go vacuous — the whole-verdict
  `assert.deepStrictEqual` (3338) where the entire result is the promise, and the
  `requirePartialInstallable(resolvedPlugin)` narrowing call (3287, 2790) where only one arm's
  extra fields are. Neither leaves a conditional to skip.

## Export ownership census

`extensions/pi-claude-marketplace/domain/resolver.ts` — 19 exports.

| Export | Owning case | Status |
| --- | --- | --- |
| `resolveStrict` | `resolver.test.ts:3329`, 3352, 3378, 3394, 3431, + ~90 | owned |
| `resolveLoose` | `resolver.test.ts:2676`, 2704, 2727, 3034, 3172, + ~25 | owned |
| `requireInstallable` (runtime) | `resolver.test.ts:1975`, 3500, 3527, 3808 | owned |
| `requireInstallable` (asserts clause) | — | **NO CASE** — new BLOCKER above |
| `requirePartialInstallable` (runtime) | `resolver.test.ts:3307`, 3475, 3451 | owned (3307 weak — first-pass finding 2) |
| `requirePartialInstallable` (asserts clause) | `resolver.test.ts:3886`, 3891 | under-constrained — new BLOCKER above |
| `rowClaimsInstallDisabled` | `resolver.test.ts:2618`, 2634, 2651, 2664 (9 cases) | owned |
| `SUPPORTED_COMPONENT_KINDS` | `tests/architecture/hooks-foundation.test.ts:199` | **owned by another module's test** |
| `UNSUPPORTED_COMPONENT_KINDS` | `tests/architecture/hooks-foundation.test.ts:207` | **owned by another module's test** |
| `ResolveContext` | `resolver.test.ts:38`, 2183, 3576, 3702, 3773 | owned (all three optional fields exercised present + absent) |
| `GitPluginRootResult` | `resolver.test.ts:2184` — all four arms at 2197/2341/2359/2376 | owned |
| `MaterializablePlugin` | `resolver.test.ts:3905`, 3909, 3913, 3917, 3923 | owned (five-way, both directions) |
| `ResolvedPlugin` | `resolver.test.ts:3829`, 3857, 3874 | owned |
| `ResolvedPluginInstallable` | `resolver.test.ts:3830`, 3836, 3839, 3849 | owned |
| `ResolvedPluginPartiallyAvailable` | `resolver.test.ts:3831`, 3837, 3840, 3853 | owned |
| `ResolvedPluginUnavailable` | `resolver.test.ts:3832`, 3838, 3841, 3869, 3894, 3919, 3929 | owned (partially — see the key-parity WARNING) |
| `StatKind` | — | **NO CASE** — the fake at line 44 re-declares the literal union instead |
| `StatKindReader` | — | **NO CASE** — never imported by any test |
| `ResolvedPluginSchema` | — | **NO CASE** — never referenced by any test or any production module |
| `_DroppedHookDriftCheck` | — | compile-time self-proving (`_AssertTrue`) |
| `_DroppedHookArmKeysCheck` | — | compile-time self-proving (`_AssertTrue`) |

Two census notes the fixing pass should act on differently:

- `StatKind` / `StatKindReader` — fix by *using* them in the fake (WARNING above), not by
  adding cases. A type alias needs no runtime case.
- `ResolvedPluginSchema` — **do not add a runtime `Value.Check` case.** The three arm
  constructors (`unavailable` 446, `materializableFields` 460, `installable` 482,
  `partiallyAvailable` 496) all carry `Type.Static<…>` return annotations, so schema/constructor
  drift is already a compile error, and TypeBox `Type.Object` is permissive about excess
  properties so a `Check` would not catch the one drift the compiler misses either. This is
  the "don't test what a gate already guards" case; record it as deliberately uncovered.

## Branch census

Branches of the production arms this slice exercises, classified.

**Reachable and untested (findings):**

1. `resolver.ts:1361-1363` — `applyMcpValue`'s `detail === false` else-branch. Reachable
   (sole caller `applyLooseMcp:1474`), and deletable with the suite green. New BLOCKER above.
2. `resolver.ts:828` — the `not installed` note payload of the `not-cached` arm. The branch
   is entered (2374) but its only observable output is unasserted. New BLOCKER above.
3. `resolver.ts:1740-1756` — `requirePartialInstallable` with `op === "update"`. Covered
   only by the message-substring case at 1947 (slice A), which the first pass already
   flagged. No strong-set case exists for this op × this gate — confirmed by reading all of
   3475–3551 and 3808.
4. `resolver.ts:1430` — `collectLooseComponentKind`'s dirty-path (an entry-declared component
   path that fails validation in **loose** mode). Every invalid-component-path case in the file
   goes through `resolveStrict`. Same helper, so this is duplicate coverage rather than a hole;
   listed for completeness, not as a finding.

**Unreachable by real input (not findings, do not add cases):**

5. `resolver.ts:755` and `:759` — `resolveDefaultEnabled`'s two `typeof … === "boolean"`
   narrows failing on a **non-boolean**. The manifest side cannot reach it:
   `PLUGIN_MANIFEST_VALIDATOR` rejects a non-boolean first, which is exactly what
   `test('DFEN-01 non-boolean defaultEnabled in plugin.json …')` (line 1178, slice A) pins.
   The entry side is a documented caller-contract violation (`resolver.ts:741-749` says so
   explicitly: "defense-in-depth, not validation"). The `undefined` fall-through *is* covered
   (2839, 2853).
6. `resolver.ts:591-605` (`classifySourceSupport`) and `:816-830` (`switch (r.kind)`) —
   neither has a `default`/`assertNever` arm. **Compiler-forced, not a silent-omission
   hazard:** both return from every arm inside a value-returning function and
   `tsconfig.json:11` sets `noImplicitReturns: true`, so a new union member is TS7030 at the
   switch, not a silent fall-through. (This qualifies META-FINDINGS item 5 — see below.)

**Compiler-forced / D-116-01a category:**

7. `resolver.ts:620` and `:996` (`throw err` after the `PathContainmentError` narrow) — both
   are genuinely covered, by 3639 and 3656 respectively, with real ENOTDIR from a real
   temp-dir fixture. Not a finding; noted because they are the branches most likely to be
   mistaken for dead defensive code.

## Grading of first-pass findings

### `tests/domain/resolver.test.ts`

- **CONFIRMED** — *Pervasive partial-field assertions instead of whole-object `deepStrictEqual`*
  — my slice alone carries 37 `assert.ok(` and 19 `notes.some(` against 30 `deepStrictEqual`,
  and the named template block (3329–3449, 3553–3806) is exactly as strong as claimed.
  Amplification the fixing pass should know: executing this finding mechanically also fixes
  my new BLOCKERs 2 and 3 and my WARNINGs on 2781, 2968, 3288/3304 and 3198 — but it does
  **not** touch the collaborator-argument BLOCKER or either asserts-clause BLOCKER, because
  those are not partial-field assertions. Schedule them separately.
- **CONFIRMED** — *`requireInstallable`/`requirePartialInstallable` throw-assertions keyed on
  `error.message.includes(...)`* — the "upgrade, don't delete" advice is right and I can
  sharpen why: the strong set (3475, 3500, 3527, 3808) contains **no**
  `requirePartialInstallable(x, "update")` case at all, so 1947 is the sole coverage of that
  op branch and deleting it loses coverage outright. Note 3808 is itself weak (see my WARNING),
  so do not upgrade 1947 by pointing at 3808 as the template — use 3515.
- **OVERSTATED** — *Real `/dev/null` read instead of a case-owned temp fixture* (line 3574) —
  real fragility but not a rule violation under the skill's own hermeticity clause: it is a
  `stat` of a fixed host path, not a write to one, and needs no credentials or developer setup.
  Correct severity is a note, not a WARNING. Two corrections to the remedy: (a) **do not drop
  the case** — it is the only cover for `defaultStatKind`'s `return null` fall-through
  (`resolver.ts:321`), the neither-file-nor-directory arm; (b) `mkfifo` is not in Node core, so
  the case-owned replacement is a unix-domain socket
  (`net.createServer().listen(path.join(temporaryDirectory, "sock"))`, closed in `t.after()`),
  which buys case-ownership but the same POSIX-only portability the current form has.
- **CONFIRMED** — *Hooks fixtures live in the repo-wide `tests/fixtures/`* — and the first
  pass was right to decline an isolated fix. One correction to its forward-looking advice:
  moving the five JSON files "under the new hooks-concern test directory" would break two
  other modules, `tests/domain/components/hooks.test.ts` (4 reads at 253/317/336/362) and
  `tests/orchestrators/plugin/info.test.ts` (2 reads at 4078/4120). Any move must be a
  three-file change.

### `extensions/pi-claude-marketplace/domain/resolver.ts`

- **CONFIRMED** — *Hidden environment read inside `readStandaloneHooks`* (line 1226) — and the
  mechanism checks out end to end: `parseHooksConfig` with `skipIfMap: true` returns
  `new Map()` at `domain/components/hooks.ts:282` **without touching `ctx` or `compileIf` at
  all**, so `homedir()` and two `process.cwd()` calls run and are discarded on every hooks
  probe of every plugin on the `list`/`info` paths. WARNING is the right severity — the values
  are unused today, so this is dead work plus a latent hidden dependency, not a live defect.
  The first pass's "drop the computation entirely" branch is the cheaper of its two options.
- **CONFIRMED** — *`.bind` used where a plain arrow expresses the same intent* (line 1227) —
  and slightly stronger than recorded: `JSON.parse.bind(JSON, "null")` has type
  `(...args: any[]) => any`, so the `as () => null` is an unchecked assertion laundering an
  `any` past a boundary the style guide also gates ("`as` … only with an obvious or commented
  reason"). `const noopCompileIf = (): null => null;` removes the `bind` **and** the cast in
  one edit; `parseHooksConfig<P>` then infers `P = null` with no assertion.

## Still clean after attack

`tests/domain/resolver.test.ts` lines 2000–3949 — the structural claims in the first pass's
Summary all hold under attack: no `describe`, no `before`/`beforeEach`, no module-scope mutable
state, no `only`/`skip`/`todo`, no process-wide `mock` from `node:test`, no `t.mock.module()`,
no `any`, no double assertions, no unawaited `assert.rejects` (3632, 3646, 3665 are all
awaited), and all five `mkdtemp` cases (3555, 3592, 3625, 3641, 3658) clean up with
`testContext.after()`. Naming is clean throughout — `resolvedPlugin`, `claimedDisabled`,
`temporaryMarketplace`, `localRoot`; no `result`/`data`/`sut`/`mockX`. The two data-driven
blocks (2613/2646/2663 and 3100) use the correct one-`test()`-per-row form with an
interpolated title and no conditional in the loop body.

Mutations these cases genuinely kill, verified one by one:

- Swap the `state` literals on the two materializable arms → `proveExactDiscriminants` (3839)
  **and** 3338/3364.
- Add `pluginRoot` to `ResolvedPluginUnavailableSchema` → `consumeUnavailable` (3869) fails
  with TS2578 (unused `@ts-expect-error`).
- Widen `MaterializablePlugin` to include the unavailable arm → 3917; narrow it to the
  installable arm alone → 3909.
- Drop `defaultEnabled` from `materializableFields` → 3338 (missing key) and 3923.
- Flip the componentPaths dedup from first-wins to last-wins, or move implicit-by-convention
  ahead of declared → 3413, 2564, 2605, 3231.
- Return from `deriveSourcePluginRoot` before the PR-2 case-3 dir-existence check → 2422.
- Skip `readManifest` on the git branch → 2393.
- Make `resolveDefaultEnabled` prefer the manifest over the entry → 2799 and 2819 (both
  directions, which is why the pair exists).
- Swallow the non-ENOENT rethrow in `defaultStatKind` → 3623, 3639, 3656 (awaited
  `assert.rejects` keyed on `.code === "ENOTDIR"`, the correct class-plus-structured-field form).
- Drop the `(root)` fallback for an empty `instancePath` in `readManifest` → 3692's
  `startsWith("malformed plugin.json: (root):")`.
- Coerce a non-`Error` rejection with `String(err)` incorrectly → 3729 and 3800 (whole-verdict
  compares against the exact composed note).
- Route hook supportability drops into the structural dirty accumulator instead of
  `partial.unsupported` → 2014, 2099, 2138.
- Run `detectOrphanRewake` over the unfiltered config instead of the kept subset → 2014
  (and its converse at 2056, which is what makes the pair conclusive).
- Add `bin` back to `UNSUPPORTED_COMPONENT_KINDS` → 3130.
- Give loose mode implicit-by-convention probing → 2727.
- Widen the loose conflict machinery to iterate keys instead of the closed tuple → 2781
  (the one mutation that case's `notStrictEqual` does catch).
- Unwrap `.mcp.json` incorrectly (`{ mcpServers: … }` handling) → 3754.

## Not covered

- **`tests/domain/resolver.test.ts` lines 1–2000** — slice A's range. I read into it only to
  settle whether a sibling case kills a mutation (specifically: the `hooksConfigPath`
  assertions at 381/423/514/551/591, the `malformed mcpServers` sites at 919/1459/1502/1880,
  the `defaultEnabled` precedence table at 950–1178, and the five weak throw cases the first
  pass named). I did not review it.
- **`resolver.ts` MCPR arms** (`validateReferencePath`, `readReferencedMcp`,
  `applyStrictMcp`'s string-reference branch, lines 1093–1165 and 1385–1393) — exercised only
  by slice A's cases. In particular `validateReferencePath`'s `throw err` at 1112 has no
  visible ENOTDIR-style cover analogous to 3639/3656; slice A should check.
- **No coverage measurement.** `npm run test:coverage:direct` was not run, per the
  diagnostic-only constraint. Every branch-census claim above is from reading.
- **No `tsc --noEmit` run.** The five `@ts-expect-error` mutation results in BLOCKERs 4 and 5
  are reasoned from the TypeScript assertion-signature and unused-suppression (TS2578) rules,
  not measured. They are cheap for the fixing pass to confirm: apply the mutation, run
  `npm run typecheck`, and check that the suppression flips to "unused".

## Meta-findings impact

### New cross-cutting evidence

**1. Injection is only half the pattern — the other half is asserting the interaction, and
this repo has done the first half without the second.** META-FINDINGS' "Patterns to
propagate" table treats "Injected orchestrator dependency" as a solved pattern with three
reference implementations. `domain/resolver.ts`'s `ResolveContext.resolveGitPluginRoot` is a
textbook consumer-declared port injected exactly as prescribed — and its test double
(`resolver.test.ts:2189`) is a **zero-parameter function that discards its argument**, used
by ten cases, with no call-count or argument assertion anywhere in `tests/`. Injecting a
seam and then not asserting through it produces a test that looks strict and proves nothing.
**Check every `__deps` / callback seam in `orchestrators/**` and `edge/handlers/**` for the
same shape**: a hand-rolled `() => Promise.resolve(fixed)` where the promise is *what gets
passed in*. This also sharpens leverage item 4 (edge-handler injection seams): adding the
seams is necessary but not sufficient; the tickets should name the interaction assertion too.

**2. Fragment assertions do not merely fail to catch a garbled message — they let whole
production parameters be deleted.** META-FINDINGS item 3 justifies the fragment-assertion
cluster with "a dropped description line, a garbled message, a scrambled row." The resolver
gives a harder example: `applyMcpValue(partial, mcp, detail = true)`'s entire `else` branch
and its `detail` parameter, plus the deliberate strict/loose asymmetry they encode, can be
deleted with the suite green, because all six assertion sites use
`.includes("malformed mcpServers")` and both branches emit strings containing it. **Any
optional flag whose only observable effect is a message suffix is invisible to
`.includes()`.** Worth adding to item 3's rationale and worth a targeted sweep: grep for
production functions with a boolean formatting parameter and check whether both settings are
pinned by exact strings.

**3. Fixture path resolution has drifted between two conventions and one of them is not
hermetic.** `tests/domain/resolver.test.ts:72-77` resolves `tests/fixtures/` from
`fileURLToPath(import.meta.url)`. `tests/orchestrators/plugin/info.test.ts:4078` and `:4120`
read the literal relative path `"tests/fixtures/ralph-wiggum-hooks.json"`, which resolves
against `process.cwd()` and only works when the runner is launched from the repo root.
`tests/domain/components/hooks.test.ts` uses the `import.meta.url` form. **Grep for
`readFile("tests/` across the suite** — this is an order/launch-directory dependency, not a
style nit, and it belongs with the hermeticity items.

**4. A repo that builds compile-time proof blocks can prove one gate and silently skip its
sibling.** This file has a carefully built NFR-7 proof block that pins
`requirePartialInstallable` and omits `requireInstallable` entirely, and pins two of the seven
fields the `unavailable` arm must omit. **Sweep for other `asserts x is …` exports and other
branded/discriminated types and check whether each has both a positive assignment proof and a
direction-specific negative** — this is the same failure shape META-FINDINGS already recorded
for the `ScopedLocations` brand ("a compile-time guarantee nothing verifies"), so it is now
two independent instances, not one.

### Corrections to META-FINDINGS.md

**Item 5, "Restore exhaustiveness on closed-union switches", needs splitting by switch
shape.** The claim is: *"This is the silent-omission class: adding a member to a closed set
compiles clean at every derivation site."* That is **not** true for every default-less switch.
`domain/resolver.ts` has two more of them — `classifySourceSupport` (line 591) and the
`switch (r.kind)` in `deriveSourcePluginRoot` (line 816) — and neither is a silent-omission
hazard, because both return from every arm inside a value-returning function and
`tsconfig.json:11` sets `noImplicitReturns: true`, which makes a new union member TS7030 at
the switch. The repo's own recorded note (`switch-exhaustiveness-ts7030.md`) says TS7030 fires
even when the return type includes `undefined`. Before treating the four listed modules as one
BLOCKER class, check each: a switch that *returns from every arm* is compiler-gated and the
missing `default: assertNever` is house-style only; a switch used as a *statement* (assigning,
pushing, or falling through) is the real hazard. I did not read those four modules, so I am
qualifying the class, not refuting the instances.

**"Patterns to propagate" — the strict-interaction-mocking row's reach is overstated.** It
lists `tests/orchestrators/**` top level, `tests/edge/handlers/plugin/**` and
`tests/index.test.ts`. `tests/domain/` should be named as a place the pattern has **not**
reached: the domain layer's one injected port is faked with an ignore-everything callback
(above). The row currently reads as "this is how the repo does it"; it is closer to "this is
how three directories do it."

### Confirmations

- **Item 3 (fragment assertions) — confirmed from a file the scale table does not list.**
  `tests/domain/resolver.test.ts` carries 19 `notes.some(...)` and 37 `assert.ok(...)` in
  lines 2000–3949 *alone*, against 30 `deepStrictEqual`. Add it to the table at roughly the
  scale of `orchestrators/marketplace/update.test.ts`. Independently confirmed by the
  first-pass file's own count of 106 `state`-only `strictEqual` sites file-wide.
- **"The dominant shape: sibling drift" — confirmed at unusually tight resolution.** The
  usual instance is file-vs-sibling-file. Here it is *within one `switch` statement*: of the
  three arms of `deriveSourcePluginRoot`'s result switch, `escapes` (2338) and
  `missing-subdir` (2356) assert their note and `not-cached` (2374) does not. And *within one
  file*: 3469 compares `pluginRoot` values while 3288/3304 compare only its `typeof`; 3515
  compares the whole `error.shape` while 3808 compares one field; every invalid-value fixture
  uses `pluginEntry({ … })` except 2637, which uses `Object.defineProperty`. The good news in
  META-FINDINGS holds — every fix here has a named in-file target, so this is propagation.
- **"Decisions" item 2 (module splits) — the first pass's split proposal for
  `domain/resolver.ts` is supported by my branch census, from a different angle than it
  argued.** It argued from test-file size. The stronger argument is that the three
  reachable-untested branches I found (`applyMcpValue`'s `detail=false`, the `not-cached`
  note, and the `resolveGitPluginRoot` forwarding contract) are all invisible *because* every
  case must drive the entire `resolveStrict`/`resolveLoose` pipeline and observe only the
  final verdict. Extracting the MCP and git-source concerns would let each be asserted on its
  own return value, which is what closes those three gaps structurally rather than by adding
  more end-to-end cases.
- **Provenance's "clean verdicts are not reliable" — confirmed in the degenerate direction.**
  This area's first-pass file listed *no* clean files, which reads as thoroughness but is the
  same unfalsified negative in another form: it recorded four test findings and two production
  findings for a 3,949-line test module and a 1,757-line production module and left everything
  else unstated. Five BLOCKERs were still available in half the file.
