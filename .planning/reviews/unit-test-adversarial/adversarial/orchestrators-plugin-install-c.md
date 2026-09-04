# Orchestrators — plugin install (slice C) — adversarial re-review

**Scope:** `tests/orchestrators/plugin/install.test.ts` lines 5660–9431 (47
`test()` cases, read in full), plus the paired production surface it exercises:
`extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` (clone-probe /
version-derivation / state-phase / entrypoint-option threading), and the
collaborators those cases reach — `orchestrators/plugin/clone-cache.ts`,
`shared/fs-utils.ts::resolveGitSubdirRoot`, `orchestrators/auth-host.ts`,
`tests/platform/git-ops-fake.ts`, `tests/orchestrators/plugin/scope-tree-inventory.ts`.
**First-pass file:** `unit-test-findings/orchestrators-plugin-install.md`
**Clean files attacked:** the first pass declared **no** clean files — its
`### Clean files` section says "No other test-support files are owned by this
assignment" and the production section says "None". The unfalsified negatives in
this area are therefore *cases*, not files: 47 cases in my range, of which the
first pass recorded findings against 5. I ran the mutation catalogue against the
other 42 and against the 3 support modules the file pulls in.
**Existing findings graded:** 11 (7 unit-test + 4 production; the 4 whose only
cited lines fall in slices A/B are graded as out-of-range and named as such)

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 6 |
| New WARNING (missed by first pass) | 10 |
| Existing CONFIRMED | 5 |
| Existing UNDERSTATED | 3 |
| Existing OVERSTATED | 0 |
| Existing REFUTED | 0 (one *claim inside* a confirmed finding is refuted — see `credentialOps`) |
| Existing DUPLICATE-OF | 1 |
| Existing out-of-range (cited lines belong to slices A/B) | 2 |

**Headline:** this range is two files wearing one filename. Lines **5856–6753**
(16 cases: PURL-01..04/09, D-77-06, MIRR-01/03, SUB-02, PI-15 mcp-unwind,
D-141-03) carry *zero* `// arrange`/`// act`/`// assert` comments, 36 loose
`assert.equal` calls, field-by-field record checks, and `.includes()` fragments.
Lines **6755–9431** (31 cases: auth, ledger, retry proofs) carry AAA comments on
every case, `assert.deepStrictEqual` on whole outcomes, byte-exact notification
arrays, `instanceof` + structured-field error checks, and whole-tree inventories.
The boundary is exact — `grep -c "// arrange"` returns 31 against 47 cases, and
the 16 without are precisely the 16 before line 6755. The first pass's summary
("one of the strongest-engineered files in the sweep") is true of the second
half and false of the first.

---

## New findings — from the unfalsified cases

### `tests/orchestrators/plugin/install.test.ts`

- **[BLOCKER] `D-77-06` clone-dedup case passes vacuously when both installs fail** —
  `test("D-77-06: a github-object source dedups to the same clone as a url naming the same repo")`,
  assertions at `lines 6169` and `6178`
  The only record assertion is
  `assert.equal(ghRecord?.resolvedSource, uRecord?.resolvedSource)`. Both sides
  are `X | undefined`, so `undefined === undefined` passes. Mutate `install.ts`
  anywhere **after** `seam.materializePluginClone` returns — e.g. make
  `resolveGitPluginRootWithSubdir` (`clone-cache.ts:564`) return
  `{kind:"missing-subdir"}` unconditionally, or make the state phase skip the
  write — and both installs produce no record while `gitState.cloneCalls.length`
  is still exactly `1` (the second install hits the warm-cache short-circuit at
  `clone-cache.ts:175` regardless). Every assertion in the case stays green with
  git-source install completely broken. Fix: before the equality, add
  `assert.ok(ghRecord !== undefined)` / `assert.ok(uRecord !== undefined)` **and**
  pin the shared value:
  `assert.strictEqual(ghRecord.resolvedSource, await locations.pluginCloneDir(pluginCloneKey("https://github.com/org/repo", GIT_SOURCE_SHA)))`,
  then assert `uRecord.resolvedSource` equals the same computed root. The
  `pluginCloneKey`-computed-root idiom is already used correctly two cases
  earlier at `lines 5898-5900`.

- **[BLOCKER] `install forwards explicit map-model and version-pin entrypoint options` cannot discriminate map-model** —
  `line 8167`, option passed at `line 8185`
  The fixture plugin `plain` is seeded with **no agents**, and `mapModel` is the
  only option in `InstallPluginOptions` that has no effect outside the agents
  phase (`install.ts:1023`, `mapModel: opts.mapModel ?? false`, the sole read).
  Worse, the case passes `mapModel: false`, which is byte-identical to omitting
  it. Mutation: delete `mapModel` from `InstallPluginOptions` /
  `InstallLedgerOptions` / `buildInstallLedgerOptions` and hardcode `false` at
  `install.ts:1023` — this case, and every other case in the repo, stays green.
  `grep -n mapModel tests/orchestrators/plugin/install.test.ts` returns exactly
  one line (8185); `tests/edge/handlers/plugin/install.test.ts` proves the
  *handler* forwards the flag to a mocked `installPlugin`, and
  `tests/bridges/agents/stage.test.ts` proves the *bridge* honours it, but the
  join at `install.ts:1023` is owned by nobody. Fix: split this into two cases.
  Keep the version-pin half as-is (it is fully discriminating). Add
  `test("install threads --map-model into the agents phase")` seeding
  `agents: [{ sourceName: "reviewer" }]` with a `model:` line in the frontmatter,
  calling with `mapModel: true`, and asserting the staged agent file at
  `path.join(locations.agentsDir, \`${GENERATED_AGENT_PREFIX}plain-reviewer.md\`)`
  carries the mapped `model:` key — compare the whole file bytes, as the
  `agents` retry proof at `line 8597` already writes hand-authored agent
  frontmatter.

- **[BLOCKER] Two cases build their expected timestamps by reading the actual record** —
  `lines 8148-8156` (`runInstallLedger preserves installedAt while replacing an existing disabled record`)
  and `lines 8203-8217` (`install forwards explicit map-model and version-pin entrypoint options`)
  Both `assert.deepStrictEqual` calls fill `updatedAt` (and at 8209 `installedAt`
  too) from a re-read of the state they are asserting against:
  `updatedAt: state.marketplaces.mp?.plugins.existing?.updatedAt` and
  `installedAt: (await loadState(...)).marketplaces.mp?.plugins.plain?.installedAt`.
  The skill bans exactly this ("Expected values are built independently … no
  transforming the adapter result"). Surviving mutations: at 8203, change
  `install.ts:1229` to `installedAt: ""` — passes; swap `installedAt` and
  `updatedAt` at 1229/1230 — passes; drop `installedAt` entirely — passes
  (`undefined === undefined`). At 8148 the trailing
  `assert.notEqual(updatedAt, "2026-01-01T00:00:00.000Z")` narrows it, but
  `updatedAt: "1970-01-01T00:00:00.000Z"` still survives. Fix without waiting on
  the clock injection: replace each self-read field with an independent shape
  check plus a relation check —
  `assert.match(record.installedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)`,
  the same for `updatedAt`, `assert.strictEqual(record.installedAt, record.updatedAt)`
  for a fresh install (both come from the same `nowIso` at `install.ts:1180`),
  and for the re-materialization case keep the existing hardcoded
  `installedAt: "2026-01-01T00:00:00.000Z"` and add
  `assert.notStrictEqual(record.updatedAt, record.installedAt)`. Then
  `deepStrictEqual` the remaining fields against a literal with the two
  timestamps omitted (compare with `Object.keys(record).sort()` so an added
  field is still caught).

- **[BLOCKER] Nine git-source cases assert three fields of the state record and never the record** —
  `lines 5885-5900`, `5970-5973`, `6015-6022`, `6169-6182`, `6226-6247`,
  `6290-6311`, `6347-6355`, `6401-6408`, `6436-6437`
  Every PURL/MIRR case checks some subset of `{version, resolvedSha,
  resolvedSource}` field-by-field. Nothing in the whole family asserts
  `record.enabled`, `record.resources`, `record.compatibility`, or
  `record.installedAt/updatedAt`. Surviving mutations, all in `install.ts`'s
  state phase (`lines 1181-1231`): flip `enabled: true` → `false` for every
  install; return `resources: {skills: [], …}` instead of the staged names (the
  `seedGitSourceMarketplace` fixture always ships one `greet` skill, so the
  correct value is `["gp-greet"]`); write `installable: false` into
  `compatibility`. All nine cases stay green for all three. `PURL-04` is the
  weakest instance — its second-install check is the standalone negative
  `assert.ok(after.marketplaces["mp"]?.plugins["gp2"] !== undefined)` at
  `line 5970`, which the skill names explicitly as a finding ("passes for any
  value; the test must assert what the value *is*"). **One fix rule for all
  nine:** replace the field-by-field block with a single
  `assert.deepStrictEqual(record, { … })` against a hand-written literal, using
  the timestamp treatment from the finding above. The reference form is two
  screens down in the same file at `lines 8148-8156`.

- **[BLOCKER] Nine git-source cases never capture `notifications` at all** —
  `lines 5871, 5941, 6001, 6147, 6212, 6276, 6333, 6387, 6430`
  All nine destructure `const { ctx, pi } = makeCtx()`, discarding the
  `notifications` sink, and none captures `installPlugin`'s return value either.
  These are standalone-mode installs, so the notification **is** the whole
  user-visible product of the call, and `install.test.ts` is the module that
  owns it. Surviving mutations: render the row at `warning` severity; drop the
  `/reload to pick up changes` trailer; render the version token wrong; emit two
  rows instead of one. Fix: destructure `notifications` and add
  `assert.deepStrictEqual(notifications, [{ message: "…" }])` with a hand-written
  literal per case, copying the byte-exact form already used at `line 9126`
  (`"● mp [project]\n  ● retryable v0.0.1 (installed)\n\n/reload to pick up changes"`).
  For the two failure cases at 6029/6070 see the grading section — that is the
  first pass's BLOCKER and the same fix closes it.

- **[BLOCKER] `PI-15: an mcp phase that cannot run unwinds the hooks bridge` matches an unanchored fragment of a joined message** —
  `line 6628`
  `assert.match(notifications.map(n => n.message).join("\n"), /⊘ hello v0\.0\.1 \(failed\)/)`
  is satisfied by any superstring. Surviving mutations: the row gains a
  `{rollback partial}` token (the regex has no terminator — it matches
  `⊘ hello v0.0.1 (failed) {rollback partial}`); the `cause:` child line is
  dropped; the `A plugin operation has failed.` header is dropped; a second
  spurious notification is appended. Nothing else in the case looks at
  notifications, and the severity is never checked. Fix: replace with
  `assert.deepStrictEqual(notifications, [{ message: "…", severity: "error" }])`,
  hand-writing the message the same way `lines 9251-9263` and `9114-9128` do —
  those two cases are the in-file reference and they even pin the `cause:` and
  `[skills] (rollback failed)` child rows.

- **[WARNING] `D-141-03: an orchestrated install carries the same warning on postCommitWarnings` checks one substring of one array element** —
  `lines 6742-6748`
  `assert.equal(outcome.status, "installed")` plus
  `assert.ok(warnings?.some(w => w.includes('"hello:tools:lint"')))`. Surviving
  mutations: the warning is emitted twice; the rest of the sentence is garbled;
  `outcome.version` / `declaresAgents` / `resourcesChanged` are wrong. The
  sibling at `lines 7574-7586` does this correctly — a full
  `assert.deepStrictEqual(first, { …, postCommitWarnings: [ …four whole strings… ], … })`.
  Fix: copy that shape. Read the current warning text once and hand-write it into
  the literal; do not derive it from `surfaceDiscoveryWarnings`.

- **[WARNING] `D-141-03: a standalone install …` never asserts the install row it counts** —
  `lines 6694-6710`
  The case asserts `notifications.length === 2` and then inspects
  `notifications[1]` only. `notifications[0]` — the install row, whose resource
  count the case's own leading comment (`lines 6659-6661`) says is the reason the
  diagnostic exists — is never read. Same fix rule: one
  `assert.deepStrictEqual(notifications, [row, diagnostic])` with both messages
  hand-written.

- **[WARNING] 16 consecutive cases carry no `// arrange` / `// act` / `// assert` phase comments** —
  `lines 5856, 5907, 5980, 6029, 6070, 6117, 6189, 6254, 6318, 6362, 6415, 6454, 6543, 6602, 6677, 6717`
  Every one of the 31 cases from `line 6755` to EOF has them. `grep -c "// arrange"`
  over the range returns 31 against 47 cases and the deficit is exactly this
  block. Fix: add the three comments to each of the 16, splitting at the
  `installPlugin(...)` call as the surrounding cases do.

- **[WARNING] The same 16 cases use loose `assert.equal` where the rest of the range uses `assert.strictEqual`** —
  36 of the range's 40 `assert.equal` calls fall before `line 6755`; after it the
  file uses `strictEqual`/`deepStrictEqual` throughout (18 remaining
  `.includes()` calls after 6755 are all array-membership tests on a directory
  inventory, not string-fragment checks). This is the same divergence
  META-FINDINGS records for `clone-cache.test.ts`. Fix: mechanical rename to
  `assert.strictEqual` across the block.

- **[WARNING] `const result` placeholder name at three sites** —
  `lines 7314, 7348, 8137`
  All three hold a `runInstallLedger` return. The skill names `result` as a
  finding, and the neighbouring cases already use production-role names
  (`outcome`, `first`, `second`, `firstOutcome`). Rename to `ledgerResult`. Also
  `const value: unknown = Reflect.get(...)` at `lines 7417` and `7468` — rename
  to `entry`.

- **[WARNING] `MIRR-01/MIRR-03 unpinned git-subdir` asserts a shape on the value the test itself computed** —
  `lines 6307-6311`
  `assert.match(path.basename(mirrorRoot), /^[0-9a-f]{12}$/)` where
  `mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey(url))` is pure
  test-side computation. It therefore tests `domain/clone-key.ts`'s contract —
  owned by `tests/domain/clone-key.test.ts` — and proves nothing about
  `installPlugin`. Its immediate sibling at `lines 6239-6240` does it right,
  asserting `path.basename(record.resolvedSource)`. Fix: change the subject to
  `path.dirname(record.resolvedSource)` (the mirror root under which the subdir
  sits) or delete the assertion as duplicative of the `resolvedSource` equality
  two lines above.

- **[WARNING] `PURL-09 / sha over ref` proves the sha wins for the *version* but not for the *checkout*** —
  `lines 6401-6408`
  The case seeds `remoteResolveMap: { "v2.0.0": refSha }` so the ref maps to a
  different sha, then asserts only `record.resolvedSha`, `record.version`, and
  `resolveRemoteRefCalls.length === 0`. It never asserts what the clone was
  checked out at. Mutation: change `clone-cache.ts`'s
  `checkoutPinWithRefetch` call to check out `args.ref` instead of `args.pin` —
  the fake copies the same fixture tree for any ref, so the case stays green
  while the materialized tree is the wrong commit. The sibling at `line 5896`
  already asserts `gitState.checkoutCalls[0]?.ref === GIT_SOURCE_SHA`. Fix: add
  `assert.deepStrictEqual(gitState.checkoutCalls.map(c => c.ref), [GIT_SOURCE_SHA])`.

- **[WARNING] Eleven git-source cases take the live `DEFAULT_CREDENTIAL_OPS` and the real Device Flow endpoints by omission** —
  `lines 5856, 5907, 5980, 6029, 6070, 6117, 6189, 6254, 6318, 6362, 8224`
  None passes `credentialOps`, so `install.ts:747` resolves
  `opts.credentialOps ?? DEFAULT_CREDENTIAL_OPS` — the real `git credential`
  subprocess wrapper — and the case at `line 6117` uses a `github` source, so
  `buildCloneAuth` also builds an `onAuthRequired` closing over the real
  device-flow endpoints (`deviceFlowHttp` undefined). The cases stay offline
  today for two reasons that are both accidental from the case's point of view:
  `buildCloneAuth` (`auth-host.ts:133`) is synchronous and lazy, and this file's
  own `makeMockGitOps` strips the `auth` bundle before delegating
  (`lines 5714, 5728`) so the fake can never invoke it. The eight auth cases at
  `lines 6755-7302` all inject `createCredentialOpsFake({ boundary: "memory" })`
  and close with the silence proof
  `assert.deepStrictEqual(credentials.calls, { approve: [], fill: [], reject: [] })`.
  Fix: propagate that pattern — add `credentialOps: credentials.credentialOps`
  (and `deviceFlowHttp: installDeviceFlow().http` for the github case) to all
  eleven, and add the silence proof. That converts an unproven boundary into a
  proof and removes the dependency on a production laziness invariant nothing
  asserts.

- **[WARNING] `git.state.cloneCalls[].auth` is structurally always `undefined`, and one case asserts it as if it were an observation** —
  `lines 5713-5716` (the strip) and `line 6868` (the assertion)
  `makeMockGitOps.clone` destructures `auth` off before calling
  `fake.gitOps.clone`, and `tests/platform/git-ops-fake.ts:129` records
  `structuredClone(cloneOptions)` of the already-stripped object. So
  `auth: undefined` in the `deepStrictEqual` at `line 6868-6875` is a tautology,
  not a proof of authlessness. The case's *real* proof is the seam-level
  `assert.deepStrictEqual(authCapture.calls, [{ auth: undefined, cloneUrl }])`
  at `line 6866`, which does discriminate. Fix: drop `auth` from the
  `cloneCalls.map(...)` projection at `lines 6868-6873` so the surviving
  assertion is honest about what it observes, and add a one-line comment on
  `makeMockGitOps.clone` saying the strip exists because the shared fake
  `structuredClone`s its options. (See "Meta-findings impact" — the strip itself
  should stop existing.)

- **[WARNING] Four duplicated dynamic `await import()` preambles for `routing-state.ts`** —
  `lines 7741, 7873, 8721, 8890` (ten in the whole file, six in slices A/B at
  `lines 2179, 2233, 4942, 5039, 5085, 5142`)
  Each case re-imports `resetRoutingState` (and sometimes `setParsedConfig`) at
  runtime, while `CacheEntry` from the same module is already a static
  `import type` at `line 49`. The dynamic form buys nothing — `installPlugin`
  loads the module transitively on every one of these paths. Fix: one static
  `import { resetRoutingState, setParsedConfig } from ".../bridges/hooks/routing-state.ts";`
  at the top, and delete the ten preambles.

- **[WARNING] SUB-02 asserts substrings of files whose whole bytes are the contract** —
  `lines 6486-6536` and `6565-6590`
  Six `body.includes(...)` / `body.includes(...) === false` pairs. The fixture
  bodies are three to four lines long and fully determined, so the skill's
  bytes-are-the-contract rule applies. Surviving mutations: the skills bridge
  substitutes correctly but mangles the rewritten `name:` frontmatter key; the
  commands bridge appends a stray trailing line; the agent's `tools:` line is
  dropped. Fix: read each materialized file once, hand-write the exact bytes into
  the case as a literal, and use `assert.strictEqual(skillBody, "…")`. Do **not**
  compute the expected from the fixture body — the bridges rewrite frontmatter,
  so the literal has to be authored.

- **[WARNING] `PURL-01/02/09` and `MIRR-01 regression` are near-duplicate cases** —
  `lines 5856` and `6318`
  Identical fixture, identical source object, identical install call. The only
  thing 6318 adds is `assert.match(path.basename(record.resolvedSource), /^[0-9a-f]{12}-[0-9a-f]{12}$/)`.
  Fix: move that one assertion into the 5856 case (which already computes
  `pluginCloneKey(...)` and the clone root) and delete 6318, or keep 6318 and
  delete the `resolvedSource` half of 5856. Two cases maintaining one fixture is
  the cost being paid for one extra regex.

---

## Export ownership census

`extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`. "Owning case"
names a case **in lines 5660–9431**; exports owned only by slices A/B are marked
so rather than reported as gaps.

| Module | Export | Owning case (this slice) | Status |
| --- | --- | --- | --- |
| `install.ts` | `installPlugin` | `line 5856` … `line 9285` (43 cases) | owned |
| `install.ts` | `runInstallLedger` | `7304`, `7331`, `7385`, `7445`, `7678`, `8120` | owned — six cases, all with whole-value `deepStrictEqual` on the result |
| `install.ts` | `InstallLedgerResult` (`kind: "marketplace-absent"` arm) | `7304` | owned |
| `install.ts` | `InstallLedgerResult` (`kind: "installed"` arm) | `7331`, `8137` | owned |
| `install.ts` | `InstallLedgerSummary` | `7331` (full literal at `7358-7377`) | owned — the only case that pins every field |
| `install.ts` | `InstallFailureCapture` | `7421/7438`, `7472/7489`, `7713/7731` | owned |
| `install.ts` | `InstallCloneCacheSeam` | `5746` (`seamWith`), `5776` (`captureInstallAuth`), `7207` | owned |
| `install.ts` | `InstallLedgerOptions.allowExistingRecord` | `8137` | owned |
| `install.ts` | `InstallLedgerOptions.pinVersionOverride` | `7348`, `8189` | owned |
| `install.ts` | `InstallPluginOptions.mapModel` | `8185` | **NO DISCRIMINATING CASE** — see BLOCKER above |
| `install.ts` | `InstallPluginOptions.partial` | `5649` (in range, weak) + slice B | owned by slice B |
| `install.ts` | `InstallPluginOptions.local` | — | owned by slice B (`lines 4254`, `4380`) |
| `install.ts` | `InstallPluginOptions.applyDefaultEnabled` | `7943`, `8091`, `9341` | owned |
| `install.ts` | `InstallPluginOptions.authMemo` | `6777`, `6989` | owned |
| `install.ts` | `InstallPluginOptions.credentialOps` | `6771` … `7266` (8 auth cases) | owned |
| `install.ts` | `InstallPluginOptions.deviceFlowHttp` | `6782`, `6910`, `6994`, `7276` | owned |
| `install.ts` | `InstallPluginNotifications` (`orchestrated`) | 20+ cases | owned |
| `install.ts` | `InstallPluginNotifications` (`standalone`) | `6602`, `7080`, `8283`, `9040`, `9174` | owned |
| `clone-cache.ts` | `resolvePluginPin` (via seam) | `5856`, `6362` | owned |
| `clone-cache.ts` | `materializePluginClone` (via seam) | `5856`, `5907`, `6117` | owned |
| `clone-cache.ts` | `materializeOrRefreshPluginMirror` (via seam) | `6189`, `6254`, `8224` | owned |
| `tests/.../scope-tree-inventory.ts` | `retryTree` | used by 11 retry proofs; support module, no meta-test required | correct |

---

## Branch census

Branches reachable from `installPlugin`/`runInstallLedger` that this slice's
cases exercise or leave open. Classified per the brief.

**(a) Reachable and untested**

1. `install.ts:582` — `probeUnpinned`'s `result.kind !== "materialized"` arm.
   Every non-materialized subdir case in the file (`6029` escape, `6070`
   missing) is **pinned**, so it goes through `probePinned` (`line 603`). No case
   installs an *unpinned* `git-subdir` source whose subdir escapes or is absent.
   Mutation: move `captured = resolvedSha` outside the `if` at `line 582` — a
   failed mirror materialize then leaves a stale sha for the version/state
   record, which is exactly what the comment at `580-581` says the guard
   prevents. Nothing fails. Fix: add one case cloning the `6254` fixture with
   `path: "packages/absent"`.
2. `install.ts:1023` — `mapModel` true arm. See BLOCKER above.
3. `install.ts:1220` — `hooks: c.resolved.hooksConfigPath === undefined ? [] : [c.plugin]`
   is covered on both arms in this slice (`7861` and `8434`), but the
   *git-source* combination is not: no PURL/MIRR fixture declares hooks or mcp,
   so `install.ts:1188` (`resolvedSha` spread) and `1192` (`hookEntries` spread)
   are never exercised together. Low value; noted for completeness.

**(b) Unreachable by real input (defensive, not dead)**

4. `install.ts:642-644` — `isGitSource && args.resolvedSha === undefined` falls
   through to the 3-tier ladder. Unreachable from `installPlugin`: a git source
   that survives `requireInstallable` necessarily materialized, and the probe
   sets `captured` on exactly that path. `pinVersionOverride` short-circuits at
   `636` before this. Do not add a test; do not delete the fallback either (it is
   the reason a future non-materializing git kind degrades instead of crashing).
5. `install.ts:1171-1178` — "marketplace disappeared from state" is only
   reachable via the `Proxy` planted at `7461`. That is a *planted* violation,
   which this repo's own convention endorses, so it counts as tested, not as
   unreachable. Same for the `ConcurrentInstallError` arm at `1167` (`7410`).

**(c) Compiler-forced, not removable (D-116-01a)**

6. `clone-cache.ts:571` — `if (subdirResult.kind !== "materialized") return subdirResult;`
   The narrowing is required to construct the `materialized` arm with
   `resolvedSha` on the next line; the union cannot be re-widened. Both non-
   materialized members are covered at the `resolveGitSubdirRoot` unit level
   (`tests/shared/fs-utils.test.ts:496`, `tests/orchestrators/plugin/clone-cache.test.ts:1544`).

---

## Grading of first-pass findings

### `tests/orchestrators/plugin/install.test.ts`

- **CONFIRMED (and sharpened)** — *No case proves the mcp phase's real
  `unstageMcpServers` removal on rollback* (`7385`, `7445`). Verified: both cases
  seed the `"empty"` fixture, so `resolved.mcpServers` is `{}` and `mcpPhase.undo`
  takes the `c.mcpPrep === undefined` early return. The only other case that
  reaches an mcp-adjacent unwind is `6602`, and that one fails the mcp
  **prepare** (it occupies `mcp.json` with a directory), so mcp's own undo never
  runs there either. The first pass's fix instruction — reuse the `Proxy`
  technique at `7410`/`7461` against a fixture with real `mcpServers` and assert
  `mcp.json` afterwards — is correct and executable.

- **CONFIRMED, with a different root cause than recorded** — *Weak "at least one
  notification" assertions* for the two in-range sites, `line 6063` (escape) and
  `line 6110` (missing subdir). The first pass proposed "a distinguishing token
  for each PURL-03 case so 'escapes' cannot be silently reclassified". The
  precise fact is stronger: **the two cases are today indistinguishable from each
  other, and NFR-10 containment can be deleted outright without either failing.**
  The escape fixture seeds the plugin at the repo root and declares
  `path: "../../etc"`; if `assertPathInside` were removed from
  `resolveGitSubdirRoot` (`shared/fs-utils.ts:249`), `path.resolve(cloneRoot, "../../etc")`
  lands on `<scopeRoot>/pi-claude-marketplace/etc`, which does not exist, so the
  call returns `{kind:"missing-subdir"}` — the install still fails, no record is
  written, a notification still fires, both cases stay green. The distinguishing
  evidence is the `detail` note the resolver folds into `unavailable`
  (`domain/resolver.ts:823`): `git-subdir path "../../etc" escapes <cloneRoot> (resolved: …).`
  versus `git-subdir path "packages/absent" does not exist in the plugin clone`.
  Both are computable in the case (`cloneRoot = await locations.pluginCloneDir(pluginCloneKey("https://example.com/org/mono", GIT_SOURCE_SHA))`).
  Fix: replace each `assert.ok(notifications.length >= 1)` with a full
  `assert.deepStrictEqual(notifications, [{ message: "…", severity: "error" }])`
  carrying that note verbatim. Note the *unit* of containment is genuinely owned
  elsewhere (`tests/shared/fs-utils.test.ts:496`,
  `tests/orchestrators/plugin/clone-cache.test.ts:1544`) — what is unowned is the
  end-to-end propagation of the note into the failed row.

- **CONFIRMED** — *Stub given a call-count assertion*, `line 7670`
  (`validation.mock.callCount() === 1`). The `deepStrictEqual` on the outcome at
  `7662-7669` already fully discriminates. Drop the count.

- **CONFIRMED, low priority** — the two companion instances. `line 8108`
  (`assert.ok(parse.mock.callCount() >= 1)`) is vacuous — `JSON.parse` runs on
  every state load, so the assertion holds for any implementation. Delete it.
  `line 8334` (`mkdirMock.mock.callCount() === 1`) does encode a real "the lock
  failure is not retried" claim; keep it, but move it after the notification
  assertion so it reads as the secondary check it is.

- **UNDERSTATED** — *Four different idioms for "does this path exist"*. The first
  pass called this "purely a readability nit". Two of the four idioms are
  materially weaker than the others, not merely different: the inline `survives`
  helper at `lines 6632-6636` returns a boolean that is then compared with
  `assert.equal(..., false)`, which loses the errno entirely, and
  `await assert.rejects(stat(...), /ENOENT/)` at `line 7996` is the only site in
  the file that pins *which* failure. A `EACCES` on the parent directory would
  satisfy the `survives` form as "removed". Proposed severity: WARNING is right,
  but the fix is not "pick one idiom" — it is "use `assert.rejects(stat(p), /ENOENT/)`
  for gone-ness and `pathExists` for present-ness", which the file already does
  at `7996` and `8419` respectively.

- **DUPLICATE-OF** — *`ctx.ui.notify` recorder is a hand-rolled sink*
  (`makeCtx`, `lines 282-299`). This is META-FINDINGS "Ranked by leverage" item 1
  (over-wide `ExtensionContext` parameter) reaching this file: the `as ExtensionContext`
  cast at `line 294` exists only because `notify()` types its parameter against
  the full SDK object. Narrowing `notify`'s parameter to `{ ui: { notify(...) } }`
  deletes the cast and lets the recorder be a `satisfies`-checked literal. Own it
  in the `notify.ts` ticket, not here. The first pass's reasoning for leaving the
  recorder itself alone (it is asserted as a Fake, on whole-value message
  equality, never on call count) is correct and I concur — for the 31 cases after
  `line 6755`. For the 9 cases that discard `notifications` entirely it is not a
  Fake at all, it is an unread sink; see the BLOCKER above.

- **out of range** — *Orchestrated failure-classification tests skip the outcome's
  cause/error* (`3549`, `3581`) and *Redundant architectural git-surface check*
  (`3219`) cite slice A only. Not graded.

- **out of range** — *`in`-check plus unnecessary `as` cast* cites `3640`, `793`,
  `3541`, `3924`; none in my range. I found no instance of the pattern after
  `line 5660` (`grep` for `as unknown`/`: any`/`<any>` over the range returns
  nothing, and the one remaining cast-shaped read,
  `(outcome as { postCommitWarnings?: readonly string[] })` at `line 6744`, is a
  narrowing of a genuinely optional field, not a discriminant bypass).

### `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`

- **CONFIRMED** — *Stale doc comment describes a re-export that no longer exists*
  (`lines 2456-2460`). Verified: `grep -n "^export"` returns nine exports, none of
  them a catch-site dispatch seam, and the comment is the last thing in the file
  with nothing following it. It violates the repo's own comment policy clause
  against "narration of code that no longer exists"
  (`.claude/rules/typescript-comments.md`). Delete it. Note the neighbouring
  comment at `lines 2450-2455` ("`marketplace` is not in the args type — nothing
  in this function reads it") is also orphaned — it documents an argument list
  that no longer follows it — and should go with it.

- **UNDERSTATED** — *Three inline `new Date()` calls and one `homedir()` call are
  hidden dependencies* (`1088`, `1180`, `1389`, `1437`). The first pass rated this
  WARNING and cited one weakened assertion (`8157-8160`). The real cost is two
  cases whose `deepStrictEqual` reads its own expected timestamps back out of the
  actual record (`8148-8156`, `8203-8217`) — see my BLOCKER above. That is not a
  weakened assertion, it is an absent one: three of `install.ts:1229-1230`'s
  possible mutations survive it. Proposed severity: keep the production finding at
  WARNING (the `Clock` member on `InstallLedgerOptions` is the right fix and is not
  urgent), but raise the *test-side* consequence to BLOCKER and fix it now with the
  independent shape/relation assertions, which need no production change.

- **CONFIRMED as a finding; its supporting claim is REFUTED** — *`credentialOps`
  parameter defaults to the live boundary inside the module* (`line 747`). The
  finding is real. But the first pass wrote: "every test in this file does inject
  `credentialOps` explicitly, so there is no live coverage gap today." That is
  false. Eleven cases that drive the git-source path — `5856, 5907, 5980, 6029,
  6070, 6117, 6189, 6254, 6318, 6362, 8224` — pass no `credentialOps`, so
  `install.ts:747` resolves to `DEFAULT_CREDENTIAL_OPS`, and the `github` case at
  `6117` additionally builds an `onAuthRequired` over the real device-flow
  endpoints. They stay offline only because `buildCloneAuth` (`auth-host.ts:133`)
  is lazy and this file's `makeMockGitOps` strips the bundle before the fake ever
  sees it. Proposed severity: keep WARNING on the production default, and add the
  test-side WARNING above (inject the fake + silence proof in all eleven).

- **CONFIRMED, note only** — *`installPlugin` is ~490 lines*. Not a finding under
  the toolchain gates; agreed.

- **CONFIRMED, with one addition** — the module-split recommendation. From this
  slice I would add a fourth candidate ahead of the first pass's third: the
  **git-source clone probe** (`makeInstallCloneProbe`, `deriveInstallVersion`,
  `lines 549-647`, ~100 lines) is a self-contained policy object whose only
  dependencies are the seam and `parsePluginSource`. Extracting it to
  `orchestrators/plugin/install-clone-probe.ts` would let the eleven PURL/MIRR
  cases become fast unit tests against a stub seam — asserting the *returned*
  `GitPluginRootResult` and the captured sha directly, instead of seeding a
  marketplace on disk, running a full install, and reading `state.json` back to
  infer one probe decision. It would also make branch (a)(1) above — the
  unpinned non-materialized arm — trivially reachable. Note there is already a
  `tests/orchestrators/plugin/git-source-probe.test.ts` in the directory, which
  suggests part of this seam has been extracted before; check it before designing
  the split.

---

## Still clean after attack

These survived deliberate mutation. Named so the fixing pass does not spend time
here.

- **`lines 6755-7302`, the eight `plugin install authentication:` cases.** I tried:
  changing `hostFromCloneUrl`'s github branch to return `gitlab.com` (caught at
  `6809`); returning a bundle for the providerless host (caught at `6866`);
  dropping the `approve` call after a successful device flow (caught at
  `7064-7073`); re-requesting a device code on the second same-host install
  (caught at `7058-7063` — `requestCode` is pinned to exactly one entry);
  swapping the 401 classification with the ENETUNREACH one (caught at `7127` vs
  `7180`, both byte-exact including the presence/absence of the `cause:` child
  line); returning `{status:"failed"}` with a synthesized cause for the non-Error
  throw (caught at `7231-7235`). The silence proofs
  (`credentials.calls === {approve:[],fill:[],reject:[]}`, `deviceFlow.calls`
  empty) catch the "collaborator called when it should not be" class that
  `strong-mock` would otherwise own. This block is a reference implementation and
  should be added to META-FINDINGS' "Patterns to propagate" table.

- **`lines 8343-9431`, the seven `retry proof:` cases.** I tried: reordering the
  undo schedule (caught — `firstSchedule`/`secondSchedule` are compared as whole
  arrays, e.g. `8665-8673` pins `undo:commands` before `undo:skills`); leaving one
  staged artifact behind after rollback (caught — `retryTree` compares the entire
  scope-root inventory as a literal array, `8443-8470`); leaking a staging UUID
  directory (caught at `8710`, `8876`, `9029`); making the retry non-idempotent
  (caught — every case asserts `firstTree` and the post-retry tree separately, and
  `assert.strictEqual(firstStateBytes, stateBytes)` proves the failed run wrote
  nothing); throwing a different error class from the containment refusal (caught
  at `9236-9243` — `instanceof SymlinkRefusedError` plus four structured fields
  plus the exact message). The `observeRetryBridgeSchedule` helper implements the
  skill's own "one shared log, compared whole" prescription for cross-collaborator
  ordering, using real `t.mock.method` interception rather than hand-rolled
  wrappers, and restores every mock in `finally`.

- **`line 7331` (`runInstallLedger projects a complete empty-plugin summary`).**
  The `deepStrictEqual` at `7358-7377` pins every field of `InstallLedgerSummary`
  and of the nested `resolved`. Deleting any one field from
  `toInstallLedgerSummary` (`install.ts:817-824`) or from the resolver's
  `installable` arm fails it. This is the only case in the file that owns the
  summary projection and it owns it completely.

- **`line 7304` (`marketplace-absent` discriminant).** `deepStrictEqual` on the
  result **and** on the whole `state` object afterwards. Mutating
  `preflightInstallResolve` to mutate state before returning the discriminant is
  caught.

- **`line 7496` (ordered bridge cleanup leaks).** The `postCommitWarnings` array
  is compared as a whole against four hand-written strings, and the leaked paths
  are independently ordered by the `findIndex` assertion at `7568-7573`, so
  putting the commands path in the skills warning is caught. The
  `assert.strictEqual(firstTree.filter(isLeakedStagingEntry).length, 3)` plus the
  full non-leaked inventory is a good pattern for "assert everything except the
  N random-UUID entries".

- **`tests/orchestrators/plugin/scope-tree-inventory.ts`.** Correctly placed
  beside its concern (not in a `tests/helpers/` dumping ground); binds `readdir`
  at module load *before* any case installs a mock, with the reason stated in the
  header; no shared mutable state; `pathExists` guard so a missing root yields
  `[]` rather than throwing. Support module, no meta-test required. Clean.

- **Case hygiene across the whole range.** Zero `describe()`, zero `it()`, zero
  committed `only`/`skip`/`todo`, zero `any`/`as unknown`/`<Type>value`, one
  `mkdtemp` per case, every one removed in `finally`, `withHermeticHome` saving
  and restoring `process.env.HOME`, every `assert.rejects` awaited, every
  `t.mock.method` restored plus `syncBuiltinESMExports()` in `finally`. The two
  `eslint-disable` comments (`7211`, `8302`) are both on deliberate non-`Error`
  throws that are the behaviour under test.

---

## Not covered

- I did not run any test or coverage command (the brief forbids it). Every
  "surviving mutation" above is derived by reading the case and the production
  line it would have to catch; none was executed.
- `install.messaging.ts` / `install.messaging.test.ts` — excluded from this area
  by the original assignment, still excluded here. Several of my fix instructions
  say "hand-write the expected notification"; the catalogue those strings come
  from lives in that pair, and whoever executes the fix should read it rather than
  copying my paraphrases.
- Lines 1–5659 of the test file belong to slices A and B. I read `lines 1-690`
  (imports, `makeCtx`, `withHermeticHome`, the fixture builders) because my range
  depends on them, and I read the `test()` titles of the whole file to check for
  duplicate ownership, but I did not review those cases' bodies.
- I did not audit `tests/platform/credential-ops-fake.ts` or
  `tests/domain/device-flow-fake.ts` beyond their call sites here; they pair with
  other areas.
- The `record?.enabled === true` assertion at `line 9415`, on a fixture with
  `entryDefaultEnabled: false` and `applyDefaultEnabled: true`, looked wrong on
  first read. It is correct: the first (failed) run stamped `"enabled": false`
  into `claude-plugins.json`, so on the retry `readDeclaredEnabled`
  (`install.ts:2080`) returns a defined value and `disabledInstall.landed`
  (`2086-2089`) is false. The record/config divergence is the documented one at
  `install.ts:2350-2353`. Recording this so the next reader does not re-derive it.

---

## Meta-findings impact

### New cross-cutting evidence

**1. The `structuredClone` bug in `tests/platform/git-ops-fake.ts` has forced the
same hand-rolled workaround into 11 test files at 20 sites — not one.**
META-FINDINGS says: "Already biting: `tests/orchestrators/marketplace/add.test.ts`
carries a strip-and-reattach workaround instead of the shared fake handling it
once." The real count, from
`grep -rn "const { auth" tests/`:

| File | Sites |
| --- | --- |
| `tests/orchestrators/plugin/clone-cache.test.ts` | 103, 117, 160 |
| `tests/orchestrators/plugin/info.test.ts` | 179, 186, 205 |
| `tests/orchestrators/plugin/fetch.test.ts` | 159, 174, 202 |
| `tests/orchestrators/plugin/install.test.ts` | 5714, 5728 |
| `tests/orchestrators/plugin/reinstall.test.ts` | 2819, 2833 |
| `tests/orchestrators/reconcile/apply.test.ts` | 122, 136 |
| `tests/orchestrators/marketplace/add.test.ts` | 141 |
| `tests/orchestrators/marketplace/update.test.ts` | 86 |
| `tests/orchestrators/plugin/bootstrap.test.ts` | 69 |
| `tests/edge/handlers/plugin/bootstrap.test.ts` | 247 |
| `tests/architecture/config-state-consistency.test.ts` | 74 |

This is not just duplication — it **silently destroys an observation**. Because
every wrapper strips `auth` before the fake records
`structuredClone(cloneOptions)` (`git-ops-fake.ts:129`), `state.calls.clone[i].auth`
is structurally always `undefined` in all 11 files. `install.test.ts:6868`
already asserts that `undefined` inside a `deepStrictEqual` as though it were an
observation of authless cloning. **Every one of the other ten files should be
checked for the same false assertion.** The single fix is in the shared fake:
replace `structuredClone(cloneOptions)` with a shallow copy that carries `auth`
by reference (or clones only the serializable fields and keeps `auth` as-is),
then delete all 20 wrappers. That would also make "which auth bundle reached the
wire" observable for the first time, which is what
`tests/orchestrators/plugin/install.test.ts` currently has to reconstruct with a
separate seam-level recorder (`captureInstallAuth`, `line 5776`). Raise this to
the same tier as the `mcp.json` null/string crash: it is a support-layer defect
with a blast radius of eleven files.

**2. "Two-era" drift inside a single large test file is a distinct shape from the
sibling drift META-FINDINGS catalogues, and it may be the dominant one in the
other 5k–9k-line files.** In `install.test.ts` the boundary is exact and
mechanically detectable: `// arrange` present in 31 of 47 cases in my range,
absent in exactly the 16 oldest ones, and those same 16 hold 36 of the range's 40
loose `assert.equal` calls, all 9 discard-the-notifications cases, and all the
`.includes()`-as-content-check sites. The convention was not missing when those
cases were written; it arrived later and was never back-propagated. **Suggested
check for the other split files** (`list.test.ts`, `info.test.ts`,
`update.test.ts`, `reinstall.test.ts`, `catalog-uat.test.ts`): run
`grep -c "// arrange"` against the case count and find the boundary line. If the
same pattern holds, the fixing pass can be scoped by line range instead of by
finding, which is much cheaper than the per-finding list implies. It also means
the finding *counts* in those files under-represent the work, because a reviewer
who reads the strong half first tends to record the file as healthy.

**3. Latent hermeticity: a `?? DEFAULT_*` production default is only as hermetic
as the test double that happens not to invoke it.** Eleven cases in this file run
with `credentialOps` unset and reach `DEFAULT_CREDENTIAL_OPS`; they stay offline
only because `buildCloneAuth` is lazy and the local git wrapper strips the
callbacks. Neither fact is asserted anywhere. The same shape will exist wherever
an orchestrator writes `opts.X ?? DEFAULT_X` — `install.ts:747` and
`clone-cache.ts:166` (`args.gitOps ?? DEFAULT_GIT_OPS`) are two in this area
alone. **Suggested repo-wide check:** for every `?? DEFAULT_` in
`extensions/`, list the unit cases that call the function without supplying the
option. Where any exist, either inject the fake or add a silence proof. The eight
auth cases at `install.test.ts:6755-7302` are the template — they inject and then
assert `credentials.calls === { approve: [], fill: [], reject: [] }`.

### Corrections to META-FINDINGS.md

- **"Offline fake that fails loudly on unplanned input | `tests/orchestrators/plugin/fetch.test.ts` — its git fake carries a URL allow-list and throws on anything unplanned … **Adopt this in the other git fakes**."**
  The allow-list is **not** local to `fetch.test.ts`. It is a first-class option of
  the shared fake — `createGitOpsFake({ allowedRemoteUrls })`, enforced by
  `requireRemote` at `tests/platform/git-ops-fake.ts:117-121` — and
  `install.test.ts:5704` already opts in with a seven-entry `INSTALL_REMOTE_URLS`
  allow-list. The correct recommendation is narrower and easier: **audit which
  callers of `createGitOpsFake` omit `allowedRemoteUrls`** (the option defaults to
  an empty set, so omitting it makes `requireRemote` reject *everything*, which is
  fail-loud in the other direction and is presumably why callers that never clone
  omit it). The reference implementation is the shared fake, not `fetch.test.ts`.

- **"weak assertions inside `install.test.ts` vs. the rest of `install.test.ts`"**
  (under "The dominant shape: sibling drift"). Accurate but too vague to plan
  from. Replace with the exact boundary: `install.test.ts` lines **≤ 6753** are
  the weak era, lines **≥ 6755** are the strong one, and the strong half is good
  enough to serve as the repo's reference for whole-outcome assertions,
  cross-collaborator order proofs, and silence proofs.

- **"Ranked by leverage" §3 lists `orchestrators/plugin/install.test.ts` as
  "scattered 'at least one notification' checks".** Understated for this slice.
  There are two `notifications.length >= 1` sites, but there are also **nine cases
  that never capture `notifications` at all** (lines 5871, 5941, 6001, 6147, 6212,
  6276, 6333, 6387, 6430) in standalone mode, where the notification is the entire
  user-visible product. Count this file's contribution to the fragment-assertion
  cluster as ~13 sites, not ~2.

- **"Decisions the fixing pass cannot make" §2 (module splits) lists
  `orchestrators/plugin/install.ts` with "9.4k test lines".** Add a named seam the
  first pass did not: `makeInstallCloneProbe` + `deriveInstallVersion`
  (`install.ts:549-647`) → `install-clone-probe.ts`. It has no dependency on the
  ledger, the lock, or the state snapshot, and extracting it converts eleven
  disk-backed end-to-end cases into stub-seam unit tests. Check
  `tests/orchestrators/plugin/git-source-probe.test.ts` first — a probe module may
  already exist in part.

### Confirmations

- **"Replace test-only hooks over module-global state" — `bridges/hooks/routing-state.ts`.**
  Independently confirmed from a second angle. `install.test.ts` calls
  `resetRoutingState()` at 22 sites across 10 cases (12 sites / 4 cases in my
  range: 7750, 7866, 7882, 8000, 8730, 8883, 8897, 9034), each preceded by its own
  duplicated dynamic `await import()` of the module. That is on top of the 62
  calls META-FINDINGS attributes to the hooks area. I also checked
  `setParsedConfig` and it is **not** a test-only export — `event-router.ts:123`
  calls it in production — so the item-2 table's scope (`resetRoutingState` /
  `resetEpoch` only) is correct as written.

- **"`shared/notify.ts` wide `ctx` parameter" (leverage item 1).** Confirmed
  reaching this file: `install.test.ts:288-294` builds a two-field object and
  forces it through `as ExtensionContext`, and `295-297` does the same for
  `ExtensionAPI`. Narrowing `notify`'s parameter deletes both casts and lets
  `makeCtx` return `satisfies`-checked literals.

- **"Planting a real violation to prove containment" / "Cross-collaborator order
  proof via one shared log."** Both patterns are independently implemented here
  and work: the `Proxy`-planted state races at `7410`/`7461`/`8072`/`9314`, and
  `observeRetryBridgeSchedule` (`lines 61-185`) feeding one `string[]` compared
  whole in seven retry proofs. `install.test.ts` deserves a row in the
  "Patterns to propagate" table alongside `tests/transaction/phase-ledger.test.ts`.

- **"Direct per-pair coverage was never measured."** Confirmed still true — I ran
  no coverage command. My branch census above is read-derived and should not be
  mistaken for a coverage measurement.
