# Orchestrators — marketplace shared, remove, autoupdate, info, list — adversarial re-review

**Scope:** `tests/orchestrators/marketplace/{shared,remove,autoupdate,info,list}.test.ts` and
`{remove,autoupdate,list}.messaging.test.ts`, paired with
`extensions/pi-claude-marketplace/orchestrators/marketplace/{shared,remove,autoupdate,info,list}.ts`
and `{remove,autoupdate,list}.messaging.ts`. Verified independently against
`tests/architecture/no-orchestrator-network.test.ts`, `shared/notify.ts`,
`shared/notify-context.ts`, `persistence/state-io.ts`, `persistence/config-merge.ts`,
`bridges/commands/unstage.ts`, `bridges/mcp/unstage.ts`, `domain/name.ts`.
**First-pass file:** `unit-test-findings/orchestrators-marketplace-rest.md`
**Clean files attacked:** 6 (1 test + 5 production)
**Existing findings graded:** 16

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 4 |
| New WARNING (missed by first pass) | 11 |
| Existing CONFIRMED | 11 |
| Existing UNDERSTATED | 1 |
| Existing OVERSTATED | 4 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 0 |

The first pass's picture of this area is broadly right and its six BLOCKERs all
survive. What it missed is concentrated in exactly the places it declared clean:
`autoupdate.ts` carries the *same* unbacked NFR-5 header claim the reviewer
correctly flagged on `list.ts` and `remove.ts`, and `list.ts` has three
mutation-survivable paths behind whole-string assertions that look airtight.

## New findings — from the clean lists

### `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts` (first-pass CLEAN)

- **[BLOCKER] Third ungated NFR-5 claim — the first pass found two of three** —
  `lines 3, 60–61`
  The header states `NFR-5` and then, explicitly: *"NFR-5: zero git surface --
  autoupdate never imports platform/git or DEFAULT_GIT_OPS."* I read
  `tests/architecture/no-orchestrator-network.test.ts:67–112` line by line:
  `FORBIDDEN_TARGETS` names `orchestrators/plugin/{install,list,reinstall,info,
  enable-disable,fetch}.ts`, `orchestrators/marketplace/info.ts`,
  `orchestrators/reconcile/{pending,plan,notify}.ts`, and `domain/resolver.ts`.
  It does **not** name `orchestrators/marketplace/autoupdate.ts`, and the
  "Exempt files (do NOT add)" block at lines 29–36 names only
  `orchestrators/plugin/{update,uninstall}.ts` — so this is an omission, not a
  documented exemption. No other gate covers it either: `grep` over
  `tests/architecture/`, `.fallowrc.json` and `eslint.config.js` finds
  `marketplace/autoupdate.ts` only in `config-state-consistency.test.ts:27` and
  `cross-op-convergence.test.ts:48`, both of which import the orchestrator to
  drive it, not to scan it. Adding a `platform/git` import to `autoupdate.ts`
  today is caught by nothing.
  Fix: add
  `"extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts"`
  to `FORBIDDEN_TARGETS` in the same commit as the `list.ts` / `remove.ts`
  additions the first pass already asked for, with the rationale comment
  `// MAU + NFR-5: the autoupdate flip is state + config only; no network.`

- **[WARNING] `OUT-07 / D-12 -> Plural` comments describe a tally the call sites
  never request** — `lines 540, 606` (calls at `543, 609`; same shape at `213–227`)
  Both comments say the emission is a bulk/`Plural` cascade under OUT-07, but
  `notifyWithContext(opts.ctx, opts.pi, flipContext, ...)` is called with four
  arguments — no `cardinality`. `shared/notify-context.ts:140–177` only sets
  `cardinality` on the envelope when the argument is passed, and
  `shared/notify.ts:3141` returns `""` from `composeTally` unless
  `cardinality === "plural"`. Consequence: `AUTOUPDATE_CONTEXT.Messaging.label`
  / `NOAUTOUPDATE_CONTEXT.Messaging.label` are never rendered anywhere, and a
  bare `marketplace autoupdate` over N marketplaces emits no
  `Marketplace autoupdate: N success(es)` trailer. Unlike `list` (where the
  tally would collapse to `""` anyway because every row is a bare header), the
  autoupdate rows carry `status` and `severity`, so a tally *would* render if
  the argument were passed. Grep confirms no expected string anywhere in
  `tests/` or `extensions/` contains `Marketplace autoupdate:`.
  Fix: decide once — either pass `undefined, "plural"` at `543`/`609` and add
  the trailer to the expected strings in `autoupdate.test.ts`, or delete the
  `-> Plural` clause from both comments. Do not leave the comment asserting
  behavior the code does not produce.

- **[WARNING] Row-stamp asymmetry inside one `map`, with a comment claiming the
  opposite** — `lines 563–604`
  The `skipped` arm (565–577) stamps `severity: "info"` **and**
  `needsReload: false` and carries the comment *"Stamped explicitly (defaults
  coincide) so every producer row carries an auditable severity/needsReload fact
  rather than relying on the implicit SEV-01/RLD-01 default."* The
  `writeBackSkipped` arm (587–595) stamps `severity` but **not** `needsReload`.
  The fresh-flip arm (598–603) stamps **neither**. Because the defaults coincide
  with the intended values, no mutation here is observable: deleting
  `severity: "info"` at 575 or `needsReload: false` at 576 leaves every case in
  `autoupdate.test.ts` green. This is the optional-field silent-omission class —
  the rule stated in the comment is unenforced and already violated twice in the
  same expression.
  Fix: stamp `severity` and `needsReload` on all three arms (matching the
  comment), or delete the claim. This is a production consistency fix; there is
  no test to add, because the fields are unobservable by construction.

### `extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts` (first-pass CLEAN)

- **[BLOCKER] `autoupdate` is read for presence, not value — the mutation
  survives every case** — `line 79`, cases at `list.test.ts:263, 468`
  Mutating `const autoupdate = merged.marketplaces[record.name]?.entry.autoupdate
  ?? false;` to `const autoupdate = merged.marketplaces[record.name] !== undefined;`
  leaves all 9 cases green. Every case that seeds a config entry seeds it with
  `autoupdate: true` (`list.test.ts:263` base `false` + local `true` → local
  wins `true`; `list.test.ts:468` base `true` + invalid local → `true`); every
  case that expects no `<autoupdate>` marker has **no config entry at all**.
  A marketplace declared in `claude-plugins.json` with `"autoupdate": false`
  would render `● name [scope] <autoupdate>` under the mutation and no case
  notices.
  Fix: add one case to `list.test.ts` — seed a project marketplace record, call
  `seedAutoupdate(locations, locations.configJsonPath, "off", "./off", false)`
  with no local layer, and assert
  `assert.deepStrictEqual(boundary.notifications, [{ message: "● off [project]" }])`.

- **[WARNING] `details.lastUpdatedAt` is threaded into a surface documented as
  never rendering it — dead production code** — `lines 83–90`
  `shared/notify.ts:1891–1893` and `1986–1987` both state, and the code at
  `1988–1991` confirms, that the `case undefined:` list arm renders only
  `[ICON_INSTALLED, name, [scope], autoupdateToken]` — `details.lastUpdatedAt`
  is read nowhere on this path (its only reader is `notify.ts:3417`, the
  `marketplace info` surface, which list never reaches). Three mutations
  therefore survive every case: dropping the `record.lastUpdatedAt !== undefined`
  disjunct from the gate at line 83; deleting the `lastUpdatedAt` spread at
  87–89; setting it to a wrong literal. `list.test.ts:307` is the case that
  should have caught this and cannot — its own title concedes the point
  (*"lastUpdatedAt remains stored but renders no timestamp or status marker"*),
  and with `autoupdate === false` the with-details and without-details forms
  produce byte-identical output through sub-branches A and B.
  Fix: delete the `record.lastUpdatedAt !== undefined` disjunct and the
  `lastUpdatedAt` spread from `list.ts:83–89`, reducing the gate to
  `...(autoupdate ? { details: { autoupdate } } : {})`. Keep `list.test.ts:307`
  as the regression proof that a stored `lastUpdatedAt` renders nothing.
  (Branch-census category: reachable, unobservable — dead code, not a missing test.)

- **[WARNING] Nothing pins that the row's scope token comes from the record** —
  `line 82`
  Mutating `scope: record.scope` to `scope: scope` (the enclosing loop variable)
  leaves every case green: all nine cases seed records whose `scope` field
  already equals the scope of the state file holding them. The two are
  independent in principle — `state.json` is hand-editable and `record.scope` is
  the declared source of truth for the `[scope]` bracket.
  Fix: in `list.test.ts`, seed the **project** location with a record carrying
  `scope: "user"` and assert the row renders `● drifted [user]`, pinning that the
  bracket is read from the record and not from the enumerating loop.

- **[WARNING] A malformed base `claude-plugins.json` silently degrades, and no
  case covers it** — `line 63`
  `list.ts` destructures only `{ merged }` from `loadMergedScopeConfig` and never
  inspects `base.status` / `local.status`, which `persistence/config-merge.ts:22–24`
  documents as the caller's job under D-18 (*"the caller inspects `base.status` /
  `local.status` to decide what to do"*). An unparseable base layer therefore
  contributes an empty `ScopeConfig`, so every marketplace renders without its
  `<autoupdate>` marker with no warning at all. `list.test.ts:468` covers the
  mirror-image invalid-**local** case; the invalid-**base** case has no test.
  Note the asymmetry against siblings: `autoupdate.ts:399–401` and
  `remove.ts:453–455` both abort (CFG-03) on an invalid *target* config.
  Fix: add a `list.test.ts` case that writes `"{ invalid base config"` to
  `locations.configJsonPath` with a valid marketplace record, and assert the
  bytes the team decides are correct. Escalate first whether a read-only surface
  should degrade silently — if yes, the case documents the decision; if no, this
  becomes a production finding.

- **[WARNING] `OUT-07 / D-12: ... -> Plural cardinality at the call site`
  comment is unmet in both readings, and `LIST_CONTEXT.Messaging.label` is
  unread** — `list.ts:101–103` / call at `104`; `list.messaging.ts:11–12`
  The call passes no `cardinality` argument (so `composeTally` returns `""`,
  `notify.ts:3141`), and the accumulator at `list.ts:56` is annotated
  `MarketplaceRows<never>[]`, not the `Plural<...>` alias the comment names —
  compare `autoupdate.ts:542`, which does use `Plural<...>`. Because
  `composeTally` is the only reader of `message.label` (`notify.ts:3196` is its
  sole interpolation site), `LIST_CONTEXT.Messaging.label` is a string no
  user-visible byte depends on: mutating it to `""` changes nothing, and
  `list.messaging.test.ts:17` asserts it anyway.
  Fix: either annotate the accumulator `Plural<MarketplaceRows<never>>` and pass
  `undefined, "plural"` (verifying against the catalog UAT fixtures first — for a
  pure list surface the tally still collapses to `""` because
  `notify.ts:3170–3176` subtracts bare headers from the success count), or drop
  the `-> Plural cardinality at the call site` clause from both files. Once
  decided, `list.messaging.test.ts` should say in its title that the label is a
  registry identity, not a rendered token.

### `tests/orchestrators/marketplace/remove.messaging.test.ts` (first-pass CLEAN)

- **[WARNING] The `uninstalled` arm's orphan-fold contract is never exercised,
  while its sibling arm in the same file is** — cases at `line 69` and `line 96`
  Mutating `remove.messaging.ts:52` from
  `renderUninstalledRow(p, probe, mpScope)` to
  `renderUninstalledRow(p, probe, p.scope ?? mpScope)` — i.e. always suppress the
  `[scope]` bracket — leaves both `uninstalled` cases green. Case 1 has
  `p.scope === undefined`; case 2 has `p.scope === mpScope === "project"`. Per
  `notify.ts:2146–2152` the bracket only emits when the two differ, so neither
  case reaches the emitting direction. The `failed` arm covers exactly this at
  `line 180` (`scope: "project"`, `mpScope: "user"` → `⊘ tool [project] …`).
  Fix: change the case at line 96 to call
  `REMOVE_CONTEXT.render.uninstalled(row, probe, "user")` against the
  `scope: "project"` row and expect
  `"○ helper [project] v1.2.3 (uninstalled)"`, then add a second case keeping the
  current same-scope fold. That gives the `uninstalled` arm the same two-point
  coverage the `failed` arm already has.

- **[WARNING] The two type-level cases at the head of the file are tautologies** —
  `lines 12–15`
  `RemovePrivateReason` resolves to the single literal `"plugins remain"`, so
  `void ("plugins remain" satisfies RemovePrivateReason)` and the
  `@ts-expect-error` on `"permission denied"` are true by construction. Neither
  exercises the property the module comment claims they guard
  (`remove.messaging.ts:27–33`: *"an out-of-set literal violates the
  `extends Reason` constraint -- a TS2344 compile error here"*), because
  `_ReasonInSet` is deliberately unexported and the constraint fires at the
  alias declaration, not at any consumer.
  Fix: keep both lines but retitle the intent in a one-line comment — they pin
  that `RemovePrivateReason` is exactly `"plugins remain"` and nothing wider,
  which is worth pinning. Do not add a runtime case to compensate; the TS2344
  guard is unreachable from a test by design.

- *(observation, not a finding)* Cases 3 (`line 96`) and 5 (`line 161`) assert
  rows carrying `scope`, a shape the sole producer never builds:
  `remove.ts:272–278`, `279–287` and `783–789` construct every child row without
  a `scope` field. The cross-scope rendering contract is owned by
  `renderScopeBracket` and belongs to `tests/shared/notify.test.ts`. Worth
  keeping here as arm-wiring proof, but do not treat it as coverage of a
  reachable `marketplace remove` output.

### `tests/orchestrators/marketplace/remove.test.ts` (not clean-listed; new finding)

- **[BLOCKER] The orchestrated config write-back suppression has no
  discriminating case** — `remove.ts:404–406`, all 6 orchestrated cases
  `commitFullRemove`'s `if (orchestrated) { return; }` exists so a
  reconcile-driven removal never clobbers a per-machine
  `claude-plugins.local.json` override (WR-09 / T-56-02-01, documented at
  `remove.ts:400–403`). Deleting that guard leaves every case in
  `remove.test.ts` green. Reason: of the six cases passing
  `notifications: { mode: "orchestrated" }` — lines 243, 276, 315, 459, 731, 1149
  — none reaches `commitFullRemove` with a valid config layer on disk. Lines
  243/276/315/459 write no config file at all (so `cascadeRemoveFromLayer`'s
  `cfg.status !== "valid"` early return fires and nothing is written either way);
  line 731 aborts at the CFG-03 sentinel before `commitFullRemove`; line 1149 has
  `failedPlugins.length > 0`, so `commitFullRemove` is never called. The sibling
  orchestrator proves its equivalent invariant properly —
  `autoupdate.test.ts:579` ("orchestrated enable preserves an existing config
  source and opposite value") seeds a real config and asserts
  bytes + inode + mtime unchanged.
  Fix: add one case modelled on `autoupdate.test.ts:579`. Seed a marketplace with
  one plugin, `saveConfig` both `configJsonPath` and `configLocalJsonPath` with
  `marketplaces` and `plugins` entries naming that marketplace, capture both
  files' bytes, call `removeMarketplace` with
  `notifications: { mode: "orchestrated" }`, then assert the outcome is
  `{ status: "removed", name, unstaged: ["tool"] }`, the marketplace is gone from
  `state.json`, and **both** config files are byte-identical to the captures.

### `tests/orchestrators/marketplace/info.test.ts` (not clean-listed; new finding)

- **[BLOCKER] `multiNotificationBoundary` cannot prove the notification order the
  test's own title promises** — `test('implicit scope emits a healthy project
  block before a failed user block')`, `lines 809–868`; helper at `83–118`
  The helper registers one `when(() => ui.notify(<message>))` per expectation.
  `strong-mock` matches each incoming call against the first *unmet* expectation
  whose arguments match; the two expectations here have different `message`
  arguments, so each call satisfies its own expectation regardless of which
  arrives first. Swapping `info.ts`'s success emission (`lines 189–194`) with its
  failure loop (`lines 200–202`) leaves this case green — and reordering those
  two is exactly the promise the title names. `verifyAll()` at line 866 checks
  counts, never sequence.
  Fix: replace `multiNotificationBoundary` with the capture-array boundary that
  `remove.test.ts:60–89` and `list.test.ts:56–72` already use — one
  `when(() => ui.notify).thenReturn((message, severity) => { calls.push(...) })`
  stub feeding a shared log — and assert
  `assert.deepStrictEqual(boundary.notifications, [<project block>, <user block>])`.
  That is the repo's own documented ordering technique (one shared log, whole log
  compared), and it is already in use two files over.

- **[WARNING] Placeholder variable name `result`** — `line 897`
  `const result = getMarketplaceInfo({...})` holds a pending promise. Rename to
  `rejection` or `infoCall` per the naming rule. Same class as the first pass's
  `shared.test.ts:866/889` finding, which it missed here.

### `tests/orchestrators/marketplace/shared.test.ts` (not clean-listed; new finding)

- **[WARNING] The MCP unstage failure's `cause` chain is never asserted** —
  `lines 809–810`
  `bridges/mcp/unstage.ts:57` throws
  `new Error(\`malformed JSON at ${locations.mcpJsonPath}: ${errorMessage(err)}\`,
  { cause: err })`. The case asserts only `instanceof Error` plus
  `assert.match(message, /malformed JSON/)`. Dropping `{ cause: err }` from the
  production throw — the "drop one structured field from the error" mutation —
  survives, and so does replacing the path with a wrong one, even though the test
  holds `locations.mcpJsonPath`. `instanceof Error` is the *correct* class check
  here (the bridge genuinely throws a bare `Error`), so this is about the fields,
  not the class.
  Fix: assert `outcome.cause.message.startsWith(\`malformed JSON at ${locations.mcpJsonPath}: \`)`
  is replaced by an exact `assert.strictEqual` where the JSON-parse tail is
  predictable, and add `assert.ok(outcome.cause.cause instanceof SyntaxError)`.

### `tests/orchestrators/marketplace/{autoupdate,list}.messaging.test.ts` (new finding)

- **[WARNING] Bare `actual` as a variable name — 3 sites** —
  `autoupdate.messaging.test.ts:48, 68`; `list.messaging.test.ts:14`
  The naming rule names `actual` explicitly. Rename to `renderedRow` (matching
  `remove.messaging.test.ts:83`, which already does it right) and to
  `listContext` respectively. One rule, three mechanical renames.

## Export ownership census

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `list.ts` | `ListMarketplacesOptions` | `list.test.ts:172` (`satisfies`) | owned |
| `list.ts` | `listMarketplaces` | `list.test.ts:168–551` (9 cases) | owned |
| `list.messaging.ts` | `LIST_CONTEXT` | `list.messaging.test.ts:6` | owned — but see the unread-`label` finding |
| `remove.messaging.ts` | `RemovePrivateReason` | `remove.messaging.test.ts:12,15` | owned; **no production consumer** — compile-time pin, sanctioned by CONVENTIONS.md's `fallow-ignore private-type-leak` family (mirrors `add.messaging.ts:36`). Not a test-only hook; do not "fix" it |
| `remove.messaging.ts` | `RemoveRowMsg` | `remove.messaging.test.ts:17–52` + `remove.ts:263,552,778` | owned |
| `remove.messaging.ts` | `REMOVE_CONTEXT` | `remove.messaging.test.ts:54–197` | owned |
| `autoupdate.messaging.ts` | `AUTOUPDATE_CONTEXT` | `autoupdate.messaging.test.ts:12,31` | owned |
| `autoupdate.messaging.ts` | `NOAUTOUPDATE_CONTEXT` | `autoupdate.messaging.test.ts:12,54` | owned |
| `autoupdate.messaging.ts` | *(private)* `renderFailedRow` | — | shared by both contexts; identity never pinned (first-pass WARNING CONFIRMED) |
| `autoupdate.ts` | `AutoupdateNotifications` | `autoupdate.test.ts:566,600,665` (via `notifications:`) | owned |
| `autoupdate.ts` | `AutoupdateOptions` | `autoupdate.test.ts` (every call) | owned |
| `autoupdate.ts` | `setMarketplaceAutoupdate` | `autoupdate.test.ts:164–1017` (17 cases) | owned |
| `remove.ts` | `RemoveMarketplaceNotifications` | `remove.test.ts:254` etc. | owned |
| `remove.ts` | `RemoveMarketplaceOutcome` | `remove.test.ts:16,191` | owned |
| `remove.ts` | `RemoveMarketplaceOptions` | `remove.test.ts` (every call) | owned |
| `remove.ts` | `removeMarketplace` (both overloads) | `remove.test.ts:213–1227` (20 cases) | owned; the narrowing overload's orchestrated arm is exercised at 243/276/315/731/1149 |
| `info.ts` | `GetMarketplaceInfoOptions` | `info.test.ts` (every call) | owned |
| `info.ts` | `getMarketplaceInfo` | `info.test.ts` (16 cases) | owned |

No export in the area is unowned. Two exports are owned only by type-level
cases (`RemovePrivateReason`, `RemoveRowMsg`), which is the correct form for
type-only surface.

## Branch census

**`list.ts`**
- `opts.scope === undefined` — both arms covered (`list.test.ts:168` bare, `191` explicit).
- `Object.values(state.marketplaces)` empty vs non-empty — covered (`168`, `380`).
- `merged.marketplaces[record.name]?` miss — covered (`191`).
- `merged.marketplaces[record.name]?.entry.autoupdate === false` — **reachable and
  untested** (BLOCKER above).
- `record.lastUpdatedAt !== undefined` disjunct at `line 83` — **reachable and
  unobservable**: production dead code, not a missing test (WARNING above).
- Invalid base config (`loadMergedScopeConfig` degrade path) — **reachable and
  untested** (WARNING above).

**`autoupdate.ts`**
- `reclassifyByConfigTruth` both directions — covered
  (`changed→unchanged` at `autoupdate.test.ts:271`; `unchanged→changed` promotion
  at `220`, which is the case the SPLIT-01 comment at `autoupdate.ts:243–248`
  exists for).
- `buildAutoupdatePatch` source-present / synthesizable / unsynthesizable — all
  three covered (`220`, `164`, `612`).
- `writeAutoupdateBack` empty-batch early return — covered (`612`).
- `flipOneScope` `cfg.status` invalid / valid / missing — all covered
  (`677`/`715`, `220`, `164`).
- Orchestrated dry-skip loop — covered (`644`).
- `errors[0]` `first !== undefined` guard at `line 514` — **compiler-forced and
  not removable** (`missingEverywhere` already proves `errors.length ===
  scopes.length >= 1`; `noUncheckedIndexedAccess` forces the check). Category (c),
  cf. D-116-01a. Do not open a coverage finding on it.
- `opts.name ?? "(unknown)"` at `line 211` — both arms covered (`796`, `852`).

**`remove.ts`**
- `commitFullRemove` orchestrated early return (`404–406`) — **reachable and
  untested** (BLOCKER above).
- `runRemoveLockBody`'s `sourceKind` ternary `: undefined` arm (`468–471`) —
  **unreachable by real input**, and this is provable, not a judgment call:
  `persistence/state-io.ts:326–365` (`normalizeStoredSource`) throws
  `state.json marketplace "<n>" has malformed source object (missing kind/raw)`
  for any stored `source.kind` outside `{path, github, url, unknown}`, and every
  path into `tx.state` goes through `loadState`. The only reason
  `remove.test.ts:487` can reach the arm is the `Object.prototype` getter, which
  returns `"unknown"` for the first 8 reads *specifically to get past that
  validator* and `"future"` afterwards. Category (b): production dead code.
- `cascadeRemoveFromLayer` WR-02 short-circuit — covered (`613`).
- `runPostRemoveCleanup` cache try/catch — covered (`937`, via a directory at
  `pluginCacheFile`); `garbageCollectPluginClones` try/catch — covered (`438`).
- Clone-retention matrix (`github`/`url` reclaim, `path`/`unknown` retain) —
  covered by the `SOURCE_CASES` loop at `350–436`.

**`remove.messaging.ts` / `autoupdate.messaging.ts` / `list.messaging.ts`**
- Every render arm invoked. The `probe` parameter is inert by construction on
  both arms (`pluginRow` and `renderUninstalledRow` pass `false, false` for both
  soft-dep declare flags, `notify.ts:2241` and `2363`), so varying it across
  cases proves nothing — not a finding, but do not read the false/false vs
  true/true pairs in these files as soft-dep coverage.

## Grading of first-pass findings

### `tests/orchestrators/marketplace/shared.test.ts`

- **CONFIRMED** — *Weak `instanceof Error` where a specific typed class is
  available* (BLOCKER) — `bridges/commands/unstage.ts:23` calls
  `assertPathInside(input.locations.promptsTargetDir, target, "command to unstage")`
  with no preceding `assertSafeName`, so the throw is a
  `PathContainmentError`/`SymlinkRefusedError` (`shared/path-safety.ts:9,30`).
  The "throw a plain `Error` carrying the same message" mutation survives at
  `line 713`. Correctly scoped to that one site: `line 657`'s sibling comes from
  `assertSafeName`, which `domain/name.ts:33,37,41` throws as a bare `Error`, and
  `line 689`'s `instanceof Error` *is* the property under test (non-Error
  normalization). The first pass did not over-apply the finding.
- **CONFIRMED** — *Placeholder `result`* (WARNING) — `lines 866, 889` verified.
  Add `info.test.ts:897` to the same fix batch.

### `tests/orchestrators/marketplace/remove.test.ts`

- **UNDERSTATED** — *`Object.prototype` mutation plus incidental
  implementation-detail assertion* (recorded BLOCKER) — the finding is real and
  the `sourceKindReads === 12` criticism is exactly right, but it is worse than
  recorded in two ways the fixing pass must know. (1) **The prescribed fix does
  not work.** Seeding `source: { kind: "some-future-kind", raw: "..." }` makes
  `loadState` throw at `state-io.ts:360–364` before the orchestrator runs; that
  is precisely why the test needs a getter that reports `"unknown"` for the
  first 8 reads. (2) **The branch is unreachable by real input** (see Branch
  census), so the honest remedy is to delete `remove.ts:468–471`'s `: undefined`
  arm — narrowing `sourceKind` to `RecordedSourceKind` — and delete the whole
  case, rather than to rewrite the case. That makes this a production-shape
  decision, not a test cleanup, and raises its blast radius.
- **CONFIRMED** — *`assertFailedOutcome`'s `error` comparison is vacuous*
  (BLOCKER) — `line 207` passes `error: outcome.error` into the expected literal,
  so that slot compares a reference with itself. Only `line 262` pins the class,
  and only at the call site on `line 258`; the sites at `474` and `754` rest on
  `line 210`'s message equality, which a plain `{ message }` object satisfies.
  The recorded fix (drop `error` from the structural compare, add an explicit
  `instanceof` assertion) is correct as written.
- **CONFIRMED** — *Generic `instanceof Error` + message regex at `828–829` and
  `913–914`* (BLOCKER) — the symlink half is settled:
  `shared/path-safety.ts:30–36` is the only producer of `contains symlink`, and
  `transaction/with-state-guard.ts:168–170` (`toError`) passes `Error` instances
  through unchanged, so `thrown instanceof SymlinkRefusedError` is assertable and
  its `linkPath`/`linkTarget` fields are available. One caveat on the second
  half: the recorded fix asserts `.code === "EISDIR"`; I did not execute the
  suite, and the rename-onto-a-directory path could surface a different errno.
  Determine the actual `.code` when applying, then assert it — do not
  copy `"EISDIR"` in blind.
- **CONFIRMED** — *No structural test proves `remove.ts` stays network-free*
  (BLOCKER) — verified directly against
  `tests/architecture/no-orchestrator-network.test.ts:67–112`. Not an exemption:
  the exempt list at `29–36` names only `plugin/update.ts` and
  `plugin/uninstall.ts`. See the new `autoupdate.ts` finding — fix all three
  together.

### `tests/orchestrators/marketplace/autoupdate.test.ts`, `info.test.ts`, `autoupdate.messaging.test.ts`, `list.messaging.test.ts`

- **OVERSTATED ×4** — *`assert.deepEqual` used instead of `assert.deepStrictEqual`*
  (`autoupdate.test.ts:297,331,604`; `info.test.ts` ×16; `autoupdate.messaging.test.ts:22–27`;
  `list.messaging.test.ts:17–20`). All four files open with
  `import assert from "node:assert/strict"`, under which `assert.deepEqual` **is**
  `assert.deepStrictEqual` — the same function object. Verified:
  `node -e "const s=require('node:assert/strict'); s.deepEqual===s.deepStrictEqual"`
  → `true`, and `s.deepEqual({a:1},{a:'1'})` throws `ERR_ASSERTION`. The same
  holds for `assert.equal === assert.strictEqual`. So the recorded framing —
  "loose", "practical risk is low **here**" — is wrong on the mechanism: the risk
  is zero everywhere in this repo, and the finding is a pure naming-consistency
  nit. Keep the rename (one convention per repo is worth having), but do not
  schedule it as a correctness item and do not let its count inflate the backlog.
- **CONFIRMED** — *`info.test.ts` note: `info.ts`'s NFR-5 gate claim points at
  the wrong file* — verified in both directions: `info.test.ts` contains no
  source-scan (its only non-`deepEqual` assertion is one `assert.rejects`), and
  `no-orchestrator-network.test.ts:87` does list
  `extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts`. The
  contract is genuinely proven, just not where the comment says.
- **CONFIRMED** — *No check that `AUTOUPDATE_CONTEXT.render.failed` and
  `NOAUTOUPDATE_CONTEXT.render.failed` stay the same function* (WARNING) —
  `autoupdate.messaging.ts:35` defines one `renderFailedRow` and both contexts
  reference it at `47` and `60`. The recorded fix
  (`assert.strictEqual(AUTOUPDATE_CONTEXT.render.failed, NOAUTOUPDATE_CONTEXT.render.failed)`)
  is exactly right and is the same `assert.strictEqual`-same-binding technique
  the barrel rule prescribes.

### `tests/orchestrators/marketplace/list.test.ts`

- **CONFIRMED** — *No structural test proves `list.ts` stays network-free*
  (BLOCKER) — verified. `FORBIDDEN_TARGETS:78` names
  `orchestrators/plugin/list.ts`, a different file. The first pass's warning that
  these are easy to confuse is well taken.

### Production findings

- **CONFIRMED** — *`info.ts` header names the wrong enforcing test file*
  (WARNING) — `info.ts:5–6`. Feeds the META-FINDINGS "gates that do not gate"
  workstream: this is how the `list.ts`/`remove.ts`/`autoupdate.ts` omission
  stayed invisible.
- **CONFIRMED** — *`remove.ts` two `as` casts without an adjacent rationale*
  (WARNING) — `lines 457, 467`. The comparison to `shared.ts` holds:
  `shared.ts:430–431` carries the D-04 rationale immediately above the pair of
  `record as { readonly autoupdate?: unknown }` casts at `438` and `449`.
- **CONFIRMED** — *`shared.ts` five per-field `as string[]` casts*
  (WARNING) — `lines 307–313`. Low priority as recorded; the single-annotation
  form (`const dropped: { skills: string[]; commands: string[]; agents: string[];
  hooks: string[]; mcpServers: string[] } = { skills: [], ... }`) is the style
  guide's preference and removes all five.

## Still clean after attack

Mutations these files genuinely catch — do not spend fixing-pass budget here.

- `tests/orchestrators/marketplace/autoupdate.test.ts` — catches: byte-exact
  config output **including key order and insertion position** (`186–198`,
  `359–375`); mtime + inode + bytes stability on idempotent flips (`297`, `331`);
  `<autoupdate>` vs `<no autoupdate>` marker swap; the `{already autoupdate}`
  brace; the full 5-line cause-chain including the lock retry hint (`806–815`);
  config-basename-only leak (a full-path leak fails `691`, `733`); orchestrated
  write-back suppression with a real config present (`579`, byte + inode + mtime);
  `state.json` byte-stability on every arm (WR-05); real `proper-lockfile`
  contention and real `chmod` `EACCES`, not fakes.
- `tests/orchestrators/marketplace/remove.test.ts` — catches: the four-way
  source-kind clone-retention matrix (`350–436`); cascade **call order and
  arguments** via a whole-log `deepStrictEqual` (`1102`); byte-exact cross-layer
  config sweep (`598–605`); the exact surviving `resources.*` arrays after a
  TR-03 partial filter (`1051–1085`); AG-5 resource preservation (`1171–1177`);
  whole-message notification equality on every arm; genuine silence proofs
  (`notificationBoundary(0)` registers zero `when()`s, so any `ctx.ui` read in
  orchestrated mode throws).
- `tests/orchestrators/marketplace/list.test.ts` — catches: scope-loop order swap
  (`455–460` pins project-then-user across six rows); `?? true` on the autoupdate
  default (`183`, `219`); any filesystem write at all (before/after tree snapshot
  with base64 file contents, `106–137`); the `(no marketplaces)` sentinel;
  local-over-base config precedence (`263`); structured rejection shape
  `{cause, message, name}` rather than a substring (`533–544`).
- `tests/orchestrators/marketplace/remove.messaging.test.ts` — catches: icon swap
  on both arms; status-token change; the reasons brace including multi-reason
  comma joining and order (`195`); version token; a hardcoded wrong `mpScope` on
  either arm (case at `96` kills a hardcoded `"user"`); and the exact key set of
  each row literal via `Object.keys` (`92`, `151`), which pins truly-omitted
  optionals rather than `undefined`-valued ones.
- `tests/orchestrators/marketplace/shared.test.ts` — catches: `refreshGitHubClone`
  call order and short-circuit position via a shared call log; the exact
  `dropped` shape at every one of the five cascade failure points (skills →
  commands → agents → hooks → mcp), which pins the D-03 fail-fast boundary;
  `AgentsUnstageFailureError.failedAgents` structurally (`754–759`);
  `MarketplaceNotFoundError`'s `name`/`message`/`mpName`/`scopes` fields
  individually (`903–907`).
- `tests/orchestrators/marketplace/info.test.ts` — catches: whole-message
  equality on all 16 surfaces via `strong-mock` `exactParams` expectations plus
  `verify`; read-only proof through a full before/after tree snapshot of both
  `home` and `cwd`; every source kind with and without optional fields; the
  cross-scope-hint wording on explicit-scope misses. Its one hole is ordering
  (BLOCKER above).

## Not covered

- I did not execute `node --test`, `npm run check`, or any coverage tooling; the
  brief forbids it and other agents are running concurrently. Every claim above
  is from reading source, except the two `node -e` probes on
  `node:assert/strict`, which touched nothing in the repo.
- I did not re-derive the internal test suites of the bridges that
  `cascadeUnstagePlugin` drives through real filesystems
  (`bridges/{skills,commands,agents,hooks,mcp}`); I verified only the throw sites
  and error classes cited above.
- `add.ts` / `update.ts` and their messaging modules are out of this area
  (owned by `orchestrators-marketplace-add-update`), so the `Plural`-cardinality
  and NFR-5 questions raised here were not checked against them.
- I did not determine the actual errno for the state-save-onto-a-directory case
  (`remove.test.ts:913–914`); see the caveat in that verdict.

## Meta-findings impact

### New cross-cutting evidence

1. **`assert.deepEqual` / `assert.equal` are not loose under
   `node:assert/strict` — and every file in this repo imports it that way.**
   Proven: `require('node:assert/strict').deepEqual === .deepStrictEqual` is
   `true` (same function object), and `deepEqual({a:1},{a:'1'})` throws
   `ERR_ASSERTION`. META-FINDINGS' sibling-drift list cites
   `clone-cache.test.ts` for "loose `assert.equal`", and four findings in this
   area alone rest on the same mistaken mechanism. **Every first-pass finding
   whose stated defect is assertion looseness needs re-reading**: if the file
   imports `node:assert/strict`, the finding is a naming-consistency nit with
   zero behavioral risk, not a correctness item. Areas to re-check:
   `orchestrators-plugin-*`, `bridges-*`, and anywhere the audit tallied a
   "loose comparison" cluster.

2. **`strong-mock`-based notification boundaries cannot prove multi-`notify`
   ordering.** Where an orchestrator emits more than one `ctx.ui.notify` per
   invocation and the test registers one `when(() => ui.notify(<msg>))` per
   expected message, call order is unverifiable — `strong-mock` matches on
   arguments, not sequence. Found here at `info.test.ts:83–118` guarding a case
   whose title *names order as the promise*. The capture-array form already used
   in `remove.test.ts:60` / `list.test.ts:56` fixes it. **Check every orchestrator
   that deliberately emits multiple notifications**: `orchestrators/import/`,
   `orchestrators/reconcile/apply`, `orchestrators/plugin/update`, and anything
   whose header documents an IL-2 carve-out.

3. **`OUT-07 / D-12 "-> Plural cardinality at the call site"` is asserted in
   comments far more often than it is passed as an argument.** Of ~40
   `notifyWithContext` call sites repo-wide, exactly three pass a `cardinality`
   (`import/execute.ts:1204`, `plugin/fetch.ts:194`,
   `plugin/reinstall.messaging.ts:199`). Every other bulk surface — including
   `marketplace/{list,autoupdate,remove,add,update}.ts`, `plugin/list.ts`,
   `plugin/info.ts`, `reconcile/pending.ts` — omits it while several of their
   headers claim Plural. Because `composeTally` (`notify.ts:3141`) returns `""`
   without it, `Messaging.label` is unread on all of those, and every
   `*.messaging.test.ts` label assertion pins a value no user-visible byte
   depends on. This is one design question the operator should settle once, not
   per area.

### Corrections to META-FINDINGS.md

- **"Gates that do not gate", item 3** — *"`orchestrators/marketplace/list.ts`
  and `remove.ts` are not covered by the NFR-5 no-network gate"*. Correct but
  **incomplete: it is three files, not two.**
  `orchestrators/marketplace/autoupdate.ts:60–61` carries the identical
  header claim (*"NFR-5: zero git surface -- autoupdate never imports
  platform/git or DEFAULT_GIT_OPS"*) and is likewise absent from
  `no-orchestrator-network.test.ts:67–112`. The first pass filed `autoupdate.ts`
  as a **clean** production module, which is how the third instance was lost.
  Update the item to name all three.

- **"Decisions the fixing pass cannot make", item 1** (prototype surgery,
  *"Two readings: the branches are dead defensive code to delete, or they are
  deliberate and the propping-up tests are the problem"*). For
  `orchestrators/marketplace/remove.test.ts` specifically, **the ambiguity is
  resolvable and the answer is "dead defensive code"**:
  `persistence/state-io.ts:326–365` (`normalizeStoredSource`) throws for any
  stored `source.kind` outside `{path, github, url, unknown}`, and `tx.state`
  always arrives via `loadState`, so `remove.ts:468–471`'s `: undefined` arm
  cannot be reached by real input. The `Object.prototype` getter exists
  *because* of that validator — it reports `"unknown"` for the first 8 reads to
  get past it. Move this one out of "operator decision" into "delete the branch,
  delete the case." The other three prototype-surgery files were not in my area
  and may still be genuinely ambiguous.

- **"Ranked by leverage", item 3 (fragment assertions)** — this area is a
  counter-example worth recording so the fixing pass does not sweep it: all five
  orchestrator test files here already compare whole hand-written strings
  (`remove.test.ts:1047`, `autoupdate.test.ts:686–692`, `list.test.ts:455–460`,
  `info.test.ts:252–257`). The only `.includes()` in the area
  (`remove.test.ts:725`) is a deliberate *negative* path-leak check, which is the
  correct use. Zero fragment-assertion work is needed here.

### Confirmations

- **"Gates that do not gate", item 3's second half** — *"`info.ts`'s header
  comment misattributes where its gate lives, which is how this stayed
  invisible"*. Independently confirmed from both ends: `info.ts:5–6` names
  `tests/orchestrators/marketplace/info.test.ts`, that file's only non-`deepEqual`
  assertion is a single `assert.rejects` (no source scan of any kind), and the
  real gate at `no-orchestrator-network.test.ts:87` does list `info.ts`. The
  causal claim holds — and this area supplies the direct evidence for it, since
  the same reviewer who read that comment then found the two (now three) missing
  targets next door.
- **"The dominant shape: sibling drift"** — confirmed with three fresh instances
  the first pass did not see, each with a named in-repo target that already does
  it right: `remove.test.ts` vs `autoupdate.test.ts:579` (orchestrated
  write-back suppression, proven vs unproven); `info.test.ts:83` vs
  `remove.test.ts:60` / `list.test.ts:56` (order-blind mock boundary vs
  capture-array log); `remove.messaging.ts`'s `uninstalled` arm vs its own
  `failed` arm in the same file (orphan-fold covered on one arm only).
- **"Patterns to propagate" — "Proving a module does not touch a port"** —
  confirmed in use here: `remove.test.ts:60–89`'s `notificationBoundary(0)`
  registers zero `when()` expectations, so any `ctx.ui` read during an
  orchestrated call throws. That is a genuine silence proof, applied at six call
  sites.
