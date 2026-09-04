# Domain — manifest, source, auth, naming — adversarial re-review

**Scope:** every file on `domain-core.md`'s two `### Clean files` lists (10 test files, 9 production modules), plus the two files that carried first-pass findings (`manifest-cache.test.ts`, `device-flow-contract.ts`) and the paired production modules `github-auth.ts` and `manifest-cache.ts`. `resolver.ts` / `tests/domain/resolver.test.ts` and `domain/components/` remain out of scope, matching the first pass.
**First-pass file:** `unit-test-findings/domain-core.md`
**Clean files attacked:** 19
**Existing findings graded:** 6

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 6 |
| New WARNING (missed by first pass) | 16 |
| Existing CONFIRMED | 5 |
| Existing UNDERSTATED | 1 |
| Existing OVERSTATED | 0 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 0 |

The first pass's headline — "No BLOCKER findings came out of this sweep" — does not survive. Six mutations survive every case in files it declared clean, four of them on documented, security- or correctness-relevant invariants. The area is still above the repo average, and the specific praise for the device-flow contract holds; the clean verdicts on `auth-registry.test.ts`, `name.test.ts`, `source.test.ts` and `github-auth.test.ts` do not.

## New findings — from the clean lists

### `tests/domain/auth-registry.test.ts`

- **[BLOCKER] `hostMatch`'s exact-equality invariant is unpinned; a suffix match survives every case** — `lines 122–133`
  Mutating `auth-registry.ts:54` from `(host) => host === "github.com"` to `(host) => host.endsWith("github.com")` (or `.includes(...)`) leaves all 7 `findProviderForHost` cases green. The unknown-host row list is `["", "GitHub.com", "GitLab.com", "githvb.com", "gitlab.cam"]` — case variants and single-character typos only, never a **suffix** lookalike. `auth-registry.ts:69` states the invariant in so many words ("Exact equality also keeps lookalike hosts such as `evil-gitlab.com` from binding a real token to a hostile remote"), and `orchestrators/auth-host.ts:87` is the consumer: `findProviderForHost` decides which provider's Device Flow token gets bound to a remote, so a widened match binds a real GitHub token to an attacker-controlled host. Add these rows to the loop at line 122: `"evil-github.com"`, `"notgithub.com"`, `"github.com.evil.test"`, `"evil-gitlab.com"`, `"gitlab.com.attacker.test"`, `"api.github.com"`, `"github.com/"`. Also add two direct cases asserting `GITHUB_PROVIDER.hostMatch("gitlab.com") === false` and `GITLAB_PROVIDER.hostMatch("github.com") === false`, so descriptor disjointness is proven independently of the registry lookup.
- **[WARNING] The descriptor comparison is a hand-picked projection, so a new field is invisible** — `lines 48–62`, `82–92`
  Both descriptor cases build `descriptor` field-by-field and compare that projection with `deepStrictEqual`. Adding a seventh member to `GitAuthProvider` (or to either literal) changes nothing observable. This is the repo's own recorded "optional-field silent-omission class". Add `assert.deepStrictEqual(Object.keys(GITHUB_PROVIDER).sort(), ["clientId","credentialFrom","deviceCodeUrl","hostMatch","id","scope","tokenUrl"])` (and the GitLab twin) alongside the existing projection compare — the function-valued members are why the whole object cannot be `deepStrictEqual`'d directly, but the key set can.
- **[WARNING] Pointless arrange alias in the data-driven loop** — `line 125`
  `const remoteHost = host;` renames a loop variable for no reason; the three sibling `findProviderForHost` cases (lines 102, 113) do the same with `const host = "github.com"`. Delete the alias and pass `host` directly.

### `tests/domain/name.test.ts`

- **[BLOCKER] Control-character rejection is only exercised mid-string, so both loop-bound mutations survive** — `lines 79–98` (rows `"foo\tbar"`, `"foo\x00bar"`, `"foo\x1fbar"`, `"foo\x7fbar"`)
  All four control-character rows place the offending byte at index 3 of a 7-character name. Mutating `name.ts:44` from `for (let i = 0; i < name.length; i++)` to `let i = 1`, or to `i < name.length - 1`, leaves every case in the file green — the empty/whitespace/`.`/`..`/separator rows all return before the loop. This is reachable, not theoretical: `bridges/skills/discover.ts:112` and `bridges/agents/discover.ts:89` call `assertSafeName` on directory-entry names read straight off a plugin tree, so a skill directory named `"\x01foo"` or `"foo\x7f"` reaches this loop. Add two rows to the table at line 48 with the same `safeNeighbor` shape the file already uses: `{ unsafeName: "\x01foo", safeNeighbor: "\x21foo", errorMessage: 'Name "\x01foo" must not contain ASCII control characters.' }` and `{ unsafeName: "foo\x01", safeNeighbor: "foo\x21", errorMessage: 'Name "foo\x01" must not contain ASCII control characters.' }`. Use `\x01` rather than `\t` or `\n` so `name.trim()` cannot consume the character and fire the empty-name guard first.
- **[WARNING] No `@ts-expect-error` negative pins the exported signatures** — `line 9`
  `name.test.ts` has one `@ts-expect-error` (line 37) and it exists to reach a runtime guard, not to pin a type. The module exports four functions whose `label?: string` optionality and `string` return are unproven at type level. Low value on its own; listed because it is the same gap as `source.test.ts` and `github-auth.test.ts` (see the sibling-drift finding below).

### `tests/domain/source.test.ts`

- **[BLOCKER] `samePlannedSource`'s GitHub `ref` comparison has no covering case, and the row that claims to test it is malformed** — `lines 724–735`, `test('distinguishes GitHub references')`
  The row plans `"acme/tools#v2"`. Running the real parser (`node --input-type=module` against `domain/source.ts`) returns `{"kind":"github","raw":"acme/tools#v2","owner":"acme","repo":"tools#v2"}` — **no `ref` field at all**; `#ref` is not shorthand syntax, `@ref` is (D-76-04). The row therefore discriminates on `repo`, not on `ref`. Deleting `planned.ref === current.ref` from `source.ts:590` leaves every row in the file green: the only other GitHub row ("matches equal GitHub sources") has `undefined === undefined` on both sides. Fix: change `plannedRaw` to `"acme/tools@v2"`, and add a third row `{ stored: { kind: "github", raw: "acme/tools@v1", owner: "acme", repo: "tools", ref: "v1" }, plannedRaw: "acme/tools@v1", sourceOutcome: "same" }` so both directions of the ref compare are pinned.
- **[BLOCKER] The shared `url | git-subdir | npm` comparison arm is only ever reached through `url`** — `lines 781–797`
  Both rows that name `git-subdir` and `npm` supply a `plannedRaw` that parses to a *different* kind (`'{"source":"git-subdir"}'` parses to `unknown`; `"npm:@scope/pkg@1.2.3"` parses to `github` with `owner: "npm:@scope"`), so they exit at the `planned.kind !== current.kind` guard on `source.ts:581` and never enter the switch. Verified by running `samePlannedSource` directly. Consequence: mutating the arm at `source.ts:599–602` to `case "url": ...; case "git-subdir": case "npm": return "different";` — or, worse, to a git-subdir comparison that ignores `source.path` — survives the whole file. `orchestrators/reconcile/plan.ts` uses this result to decide remove-then-re-add, so a git-subdir plugin whose subdirectory moved would silently not reconcile. Add four rows: identical git-subdir stored/planned → `"same"`; same `url`, different `path` → `"different"`; identical npm stored/planned → `"same"`; same package, different `version` → `"different"`. The planned side must be an object source (`parsePluginSource` accepts objects), not a string.
- **[WARNING] The github.com-URL-that-is-not-a-repo fallthrough has no case** — `source.ts:179–184`, false branch of `if (parsed.kind === "github")`
  `parsePluginSource({ source: "url", url: "https://github.com/onlyone" })` returns `{kind:"url", raw:"https://github.com/onlyone", url:"https://github.com/onlyone"}` (verified). No row in `UNKNOWN_PARSE_CASES` or `PARSE_CASES` exercises it, so a mutation that returns `unknownObjectSource(obj, ...)` there instead survives. Add that exact input as a `PARSE_CASES` row with the verified expected value.
- **[WARNING] `parseShorthandSourceForm`'s empty-ref branch has no case** — `source.ts:356`
  `"acme/tools@"` yields `{kind:"unknown", raw:"acme/tools@", reason:"non-relative string source acme/tools@ cannot be classified"}` (verified). No row covers `ref.length > 0` being false while the left half *is* a valid owner/repo. Add it to `UNKNOWN_PARSE_CASES`.
- **[WARNING] Error assertions are weaker than the sibling's; an `Error` subclass passes** — `lines 650–661`, `705–711`
  `assert.throws(fn, { name: "Error", message })` compares own/inherited properties, so throwing a subclass that sets `this.name = "Error"` still passes. The sibling `name.test.ts:128` uses `assert.strictEqual(error.constructor, Error)` and does catch that mutation. Propagate the `name.test.ts` validator shape (`assert.ok(error instanceof Error); assert.strictEqual(error.constructor, Error); assert.strictEqual(error.message, expected); return true;`) to both `describe`s here.
- **[WARNING] `Reflect.apply` used to bypass typing where the sibling uses `@ts-expect-error`** — `line 657`
  `Reflect.apply(pathSource, undefined, [invalidPath])` exists only to pass `42` to a `string` parameter. `name.test.ts:37` reaches the identical runtime guard with `// @ts-expect-error Runtime validation protects untyped callers.`, which is the sanctioned form (the style rules allow `@ts-expect-error` in unit tests and nowhere else). Replace, and split the `42` row out of the `["", "   ", 42]` loop so the two string rows keep a clean call.
- **[WARNING] Seven exported types from `source.ts` have no case in the paired test** — see the census below
  `PathSource`, `GitHubSource`, `UrlSource`, `GitSubdirSource`, `NpmSource`, `UnknownSource` and `GitBackedSource` are never imported by `source.test.ts`; only the `ParsedSource` union and `SamePlannedSourceResult` are, and both only as annotations on row tables. The type-only-module pattern asks for `satisfies` checks plus `@ts-expect-error` negatives; four sibling files in this same directory do exactly that (`auth-registry.test.ts:11–29`, `manifest-lookup.test.ts:10–20`, `manifest.test.ts:14–24`, `plugin-root.test.ts:12`). Add a header block of `void (… satisfies UrlSource)` positives and `@ts-expect-error` negatives — most valuable on `GitBackedSource`, whose whole purpose is to be a three-member alias five orchestrators depend on.

### `tests/domain/github-auth.test.ts`

- **[BLOCKER] The AUTH-03 "prompt before any token" ordering is asserted by title only** — `test('emits the documented AUTH-03 prompt before any token is acquired')`, `lines 191–237`
  Moving `opts.notifyFn(...)` from `github-auth.ts:436` to *after* the `runPollLoop` call leaves every case in this file — and every case in `device-flow-contract.ts` — green. `strong-mock` does not order across mocks (the rules say so explicitly), the notification mock only pins message and severity, and the contract's `DeviceFlowContractObservation` compares `notifications` and `waits` as two independent arrays that carry no interleaving. The case's own comment claims "no access token ever exists while the prompt is emitted (AUTH-09)", which is exactly the property nothing checks. Fix with the technique the rules name and the repo already uses: give `createDeviceFlowContractParticipant` (`tests/domain/device-flow-contract.ts:104`) one shared `events: string[]` log that `notifyFn`, `waitForPoll`, `approve`, and a wrapping `http` recorder all push into, expose it on the observation, and compare the whole log — `["notify","wait","poll","approve"]` for the success case. `tests/transaction/phase-ledger.test.ts` is the in-repo reference for this shape.
- **[WARNING] The poll deadline arithmetic has no covering case** — `github-auth.ts:354`, `356`
  Every case supplies either `expires_in: 900` (never reached — the poll resolves first) or `expires_in: 0` (the timeout case at line 590). With only those two, mutating `Date.now() + deviceCode.expires_in * 1000` to `* 100`, or `while (Date.now() < deadlineMs)` to `<=`, survives. This is the concrete cost of the first pass's `Date.now()` design WARNING (regraded UNDERSTATED below). Once a `now?: () => number` seam exists, add a case with `expires_in: 30`, a scripted clock returning `0, 10_000, 20_000, 31_000`, and three `pending` polls, asserting the timeout reason and exactly three `pollToken` calls.
- **[WARNING] No `@ts-expect-error` negative on `DeviceFlowResult`'s discriminant** — `lines 132–137`
  The file has two `satisfies` positives and zero negatives. `DeviceFlowResult` is a discriminated union whose whole point is that `ok: true` implies `cred` and `ok: false` implies `reason`; nothing proves `{ ok: true, reason: "x", authAttempted: true }` is rejected. Add two `@ts-expect-error` voids next to the existing positives.

### `tests/domain/plugin-root.test.ts`

- **[WARNING] A self-referential assertion that passes for any implementation** — `lines 168–171`
  `assert.deepStrictEqual(containedPaths.map((p) => path.relative(directory, p)), containedRelativePaths)` compares the row's `makeContainedPaths(directory)` output against the row's `containedRelativePaths` literal. Neither side involves `asAbsolutePluginRoot`. It reads like a containment check and checks nothing. Delete `makeContainedPaths` and `containedRelativePaths` from all seven rows; the real assertions (lines 165–167, 172) already catch every mutation to the validator.
- **[WARNING] `mkdtemp` in all 11 cases for a pure string function** — `lines 17, 31, 45, 63, 147`
  `asAbsolutePluginRoot` never touches the filesystem, so the only work the temp directory does is give `path.join(directory, …)` an absolute prefix and let `assert.deepStrictEqual(await readdir(directory), [])` prove non-creation. One module-scope constant absolute prefix (`path.join(path.sep, "tmp", "plugin-root")`) removes 11 `mkdtemp`/`rm` pairs; keep a single case that does use a real directory and asserts `readdir` is empty, so the "creates no filesystem content" claim keeps one owner.

### `tests/domain/version.test.ts`

- **[WARNING] The skip list's exact-name matching has no adjacent-neighbor row** — `test('ignores Git, dependency, and Finder entry contents')`, `lines 94–121`
  Mutating `version.ts:51` from `.includes(e.name)` on the entry name to a prefix test (`HASH_WALK_SKIP.some((s) => e.name.startsWith(s))`) leaves the case green, while silently excluding `.gitignore`, `.gitattributes`, and `node_modules.md` from a contract the module's own header calls stable and CHANGELOG-gated. The sibling `name.test.ts` already pairs every rejected input with an accepted `safeNeighbor`; propagate that here by adding `.gitignore`, `.DS_Store2`, and `node_modules.txt` to `cleanPluginRoot` **and** `ignoredPluginRoot` and re-pinning both literals.
- **[WARNING] Off-by-one on the BOM length guard survives** — `version.ts:82`
  `buf.length >= 3` → `> 3` changes behaviour only for a file whose entire content is a three-byte BOM. `short.txt` (one byte, line 85) is the closest case and does not reach the guard. Add a fixture file containing exactly `Buffer.from([0xef,0xbb,0xbf])` to the normalization case and re-pin the hash.

### `tests/domain/manifest.test.ts`

- **[WARNING] "Only the first schema defect is reported" has no covering case** — `manifest.ts:73`
  Both schema-error cases (lines 193, 218) produce a single TypeBox error, so `.slice(0, 1)` can be widened to `.slice(0, 5)` — or dropped — with no test failing. The `.join("")` with no separator would then emit two run-together messages. Add a case whose manifest carries two defects (e.g. `{"name": 42, "plugins": [{"name":"p","source":"./p","defaultEnabled":"false"}]}`) and assert the exact single-defect message.
- **[WARNING] The malformed-JSON case pins V8's own `SyntaxError` wording** — `lines 172–173`
  `"Expected property name or '}' in JSON at position 1 (line 1 column 2)"` is engine text, not a project contract, and changes across Node majors. Keep `assert.ok(error.cause instanceof SyntaxError)` and assert only the project-owned prefix: `assert.ok(error.message.startsWith("marketplace.json is not valid JSON: SyntaxError: "))` — this is the one place in the area where a prefix check is the *stronger* assertion, because the tail is not ours.

### `tests/domain/manifest-cache.test.ts` (new, distinct from the first pass's finding)

- **[WARNING] The `size` half of the invalidation predicate is unpinned** — `test('reloads a successful entry after its size changes')`, `lines 131–158`
  `writeFile` changes `mtimeMs` as well as `size`, so `manifest-cache.ts:92`'s `hit?.mtimeMs === st.mtimeMs && hit.size === st.size` reloads on the mtime half alone. Dropping `&& hit.size === st.size` leaves this case green; the mtime-only case at line 160 covers only the other half. Fix: after `writeFile(manifestPath, '{"larger":true}')`, `stat` the original mtime beforehand and `utimes` it back, so only `size` differs.

## Export ownership census

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `auth-registry.ts` | `GitAuthProvider` | `auth-registry.test.ts:11–29` | owned (positive + negative) |
| `auth-registry.ts` | `GITHUB_PROVIDER` | `auth-registry.test.ts:32` | owned (projection only — see finding) |
| `auth-registry.ts` | `GITLAB_PROVIDER` | `auth-registry.test.ts:67` | owned (projection only) |
| `auth-registry.ts` | `findProviderForHost` | `auth-registry.test.ts:100–133` | owned; exact-match invariant NOT owned |
| `clone-key.ts` | `pluginCloneKey` | `clone-key.test.ts:11–74` | owned |
| `clone-key.ts` | `pluginMirrorKey` | `clone-key.test.ts:78–116` | owned |
| `clone-key.ts` | `canonicalCloneUrl` | `clone-key.test.ts:120–165` | owned (all 3 kinds) |
| `manifest-lookup.ts` | `ManifestPluginEntry` | `manifest-lookup.test.ts:10` | owned |
| `manifest-lookup.ts` | `ManifestLookup` | `manifest-lookup.test.ts:11–20` | owned (3 positives, 2 negatives) |
| `manifest-lookup.ts` | `lookupDeclaredPlugin` | `manifest-lookup.test.ts:22–148` | owned |
| `plugin-root.ts` | `AbsolutePluginRoot` | `plugin-root.test.ts:12` | owned (negative) |
| `plugin-root.ts` | `asAbsolutePluginRoot` | `plugin-root.test.ts:15–174` | owned |
| `manifest.ts` | `MarketplaceManifest` | `manifest.test.ts:14–24` | owned |
| `manifest.ts` | `MARKETPLACE_VALIDATOR` | `manifest.test.ts:26–102` | owned by the TEST ONLY — no production consumer |
| `manifest.ts` | `loadMarketplaceManifest` | `manifest.test.ts:104–268` | owned |
| `manifest-cache.ts` | `ManifestLoader` | `manifest-cache.test.ts:12` | owned |
| `manifest-cache.ts` | `createManifestCache` | `manifest-cache.test.ts:27–440` | owned |
| `name.ts` | `assertSafeName` | `name.test.ts:11–170` | owned; loop bounds NOT owned |
| `name.ts` | `generatedSkillName` | `name.test.ts:172–236` | owned |
| `name.ts` | `generatedCommandName` | `name.test.ts:238–347` | owned |
| `name.ts` | `generatedAgentName` | `name.test.ts:349–429` | owned |
| `version.ts` | `computeHashVersion` | `version.test.ts:20–182` | owned |
| `version.ts` | `shaVersion` | `version.test.ts:184–195` | owned |
| `source.ts` | `parsePluginSource` | `source.test.ts:627–644` | owned (60 rows) |
| `source.ts` | `pathSource` | `source.test.ts:646–675` | owned |
| `source.ts` | `githubSource` | `source.test.ts:677–714` | owned |
| `source.ts` | `samePlannedSource` | `source.test.ts:716–818` | owned; ref compare and git-subdir/npm arm NOT owned |
| `source.ts` | `sourceLogical` | `source.test.ts:820–916` | owned (all 6 arms) |
| `source.ts` | `ensureGitSuffix` | `source.test.ts:918–937` | owned |
| `source.ts` | `ParsedSource` | `source.test.ts:18` | incidental — annotation only, no `satisfies`/negative |
| `source.ts` | `SamePlannedSourceResult` | `source.test.ts:25` | incidental — annotation only |
| `source.ts` | `PathSource` | — | NO CASE |
| `source.ts` | `GitHubSource` | — | NO CASE |
| `source.ts` | `UrlSource` | — | NO CASE |
| `source.ts` | `GitSubdirSource` | — | NO CASE |
| `source.ts` | `NpmSource` | — | NO CASE |
| `source.ts` | `UnknownSource` | — | NO CASE |
| `source.ts` | `GitBackedSource` | — | NO CASE (5 orchestrators depend on it) |
| `github-auth.ts` | `initiateDeviceFlow` | `github-auth.test.ts:139–1247` | owned |
| `github-auth.ts` | `DeviceFlowHttp` | `github-auth.test.ts:144` (mocked) | owned |
| `github-auth.ts` | `NotifyFn` | `github-auth.test.ts:149` (mocked) | owned |
| `github-auth.ts` | `PollResult` | `github-auth.test.ts:132` | owned (positive only) |
| `github-auth.ts` | `DeviceFlowResult` | `github-auth.test.ts:133–137` | owned (positive only) |
| `github-auth.ts` | `DeviceCodeResponse` | `github-auth.test.ts:27` | incidental — return-type annotation on a helper |
| `github-auth.ts` | `InitiateDeviceFlowOpts` | `github-auth.test.ts:66` | incidental — used only to name a field's type |

Pairing itself is complete: all nine in-scope production modules have exactly one paired test module at the mirrored path, and `domain/README.md` needs none.

## Branch census

**(a) Reachable and untested — findings, listed above with their fixes**

- `source.ts:179–184` — `urlObjectSource`'s `parsed.kind === "github"` false branch (verified reachable with `{source:"url", url:"https://github.com/onlyone"}`).
- `source.ts:356` — `ref.length > 0` false while the left half parses as github (`"acme/tools@"`).
- `source.ts:590` — the `planned.ref === current.ref` conjunct: executed, never *decisive*.
- `source.ts:599–602` — the shared arm, entered only via `url`.
- `name.ts:44–50` — loop indices 0 and `length-1`.
- `version.ts:82` — `buf.length >= 3` boundary.
- `version.ts:51` — exact-name vs prefix skip matching.
- `manifest.ts:73` — `.slice(0, 1)` with more than one error present.
- `manifest-cache.ts:92` — the `hit.size === st.size` conjunct.
- `github-auth.ts:354, 356` — non-zero, non-900 `expires_in`.
- `source.ts:414` / `stripUrlDecorations` — the trailing-slash `while` loop with more than one slash (`ensureGitSuffix` covers its own copy of the loop at `source.ts:460` with `"…/r///"`; `stripUrlDecorations` gets only a single slash). Low value, listed for completeness.
- `source.ts:488` — `.replace(/\/$/, "")` on a `/tree/<ref>/` URL with a trailing slash.

**(b) Unreachable by real input — production dead code, not test gaps**

- `name.ts:75`, `name.ts:129`, `name.ts:149` — the final `assertSafeName(generated)` in each of the three generators can never throw. `generated` is always `<safe><separator><safe>` with a `-` or `:` joiner, so it is never empty, never `"."`/`".."`, never contains `/`/`\`, and never contains a control character once both halves passed. `name.ts:128` even documents this ("this passes"). 100% branch coverage of `assertSafeName` from these call sites is unachievable; delete the three calls or keep them and record why.
- `github-auth.ts:271–272` — `tokenType: … : "bearer"` and `scope: … : ""`. Grep-confirmed: no production code anywhere reads `PollResult.tokenType` or the success arm's `scope`; `runPollLoop` reads only `r.accessToken`. Both defaults are unobservable through the module's only export.

**(c) Compiler-forced and not removable — the D-116-01a category**

- `source.ts:587`, `source.ts:594` — `current.kind === "github"` / `current.kind === "path"` inside `samePlannedSource`'s switch. Both are always true at that point (the `planned.kind !== current.kind` guard on line 581 already established it) but TypeScript cannot narrow `current` from a discriminant comparison against another union, so the checks cannot be deleted.
- `name.ts:28` — `typeof name !== "string"` on a `string`-typed parameter. Deliberately reachable from untyped JSON-driven callers and correctly covered by `name.test.ts:30` with a described `@ts-expect-error`. Not a finding in either direction; recorded so a coverage pass does not mistake it for dead code.
- `source.ts:521` — the same guard in `pathSource`, covered the same way (though via `Reflect.apply` rather than `@ts-expect-error`; see the sibling-drift finding).

## Production code findings

### `extensions/pi-claude-marketplace/domain/github-auth.ts`

- **[BLOCKER] `runPollLoop`'s switch has no `default` arm, and the compiler does not cover for it** — `line 370`
  Adding a member to `PollResult` compiles clean here and silently falls out of the switch into the next `while` iteration — an unbounded poll until the device-code deadline, with no error and no notification. This is the one missing-`default` in the area that `noImplicitReturns` does **not** catch: `runPollLoop` returns after the loop (line 409), so TS7030 never fires. Add `default: assertNever(r);` as the last group, matching the codebase's own idiom.
- **[WARNING] `PollResult`'s success arm carries two fields nothing reads** — `line 77`, defaults at `271–272`
  `tokenType` and `scope` are produced by `pollTokenImpl`, echoed in test fixtures, and read by no production code. Either drop them from the union (and from `pollTokenImpl`), or state in the doc comment why the shape mirrors the wire response beyond what the engine consumes.

### `extensions/pi-claude-marketplace/domain/source.ts`

- **[WARNING] Two closed-union switches with no `default` group** — `line 585` (`samePlannedSource`), `line 618` (`sourceLogical`)
  Both violate the style rule ("Every `switch` has a `default` group, last, even if empty"). Unlike `runPollLoop` above, both functions return a value from every arm with no code after the switch, so `noImplicitReturns` **does** turn a new `ParsedSource` member into a compile error (TS7030). Adding `default: assertNever(source);` is defence in depth and consistency, not a correctness fix — record the severity difference so the fixing pass does not treat these three as one ticket.

### `extensions/pi-claude-marketplace/domain/manifest.ts`

- **[WARNING] `MARKETPLACE_VALIDATOR` is exported with no consumer outside its own module** — `line 40`
  Grep-confirmed: the only references are `manifest.ts:70–71` (internal) and `tests/domain/manifest.test.ts`, where 15 of the file's 21 cases drive it directly. `orchestrators/marketplace/add.ts:16,22` and `update.ts:300` mention it in prose but call `loadMarketplaceManifest`. Under the "every export is used outside its module" rule this is an export the test keeps alive. `fallow dead-code` cannot see it because `.fallowrc.json` sets `production: false`, so test usage counts. Either un-export it and let the schema cases run through `loadMarketplaceManifest` (they already write real files), or keep the export and say in its doc comment that it is the validator seam other manifests are checked against, naming a caller. Do not silently leave it as-is — it is the only test-shaped export in the area.

## Grading of first-pass findings

### `tests/domain/manifest-cache.test.ts`

- **CONFIRMED** — *Stub-with-call-count-assertions should be a `strong-mock` interaction mock*. Real, WARNING fits: `load.mock.callCount()` is decisive (a broken always-reload cache would still pass the `strictEqual` identity checks), which makes `load` a mock in stub's clothing across all 13 cases. **Correct the fix instruction:** the first pass hedged on whether `strong-mock` can sequence identical calls. It can, and the proof is in this very area — `github-auth.test.ts:296–304` stacks two `when(() => deviceFlowHttp.pollToken("client-1","device-1",0))` expectations that resolve differently, consumed in order. So `mock<ManifestLoader>({ exactParams: true, name: "load" })` plus one `when()` per expected call plus `verify(load)` replaces every `mockImplementationOnce(fn, index)`; no shared-log fallback is needed.

### `tests/domain/device-flow-contract.ts`

- **CONFIRMED** — *"overwrite" contract category is neither covered nor recorded as inapplicable*. The inapplicability note at lines 61–63 covers **validation** only. One addition the first pass missed: **deletion** is equally unrecorded — "resets queued state between fresh participants" is a reset across two participants, not a deletion within one, and the first pass itself called it only "a deletion/reset analogue". Record or cover both categories in the same comment block.

### `tests/domain/device-flow-fake.test.ts`

- **CONFIRMED** — *Vestigial meta-test of the contract's own case-name list*. Grep-confirmed: `DEVICE_FLOW_CASE_NAMES` has exactly two references repo-wide, its own definition and this test. **Extend the fix:** deleting it leaves the concern with no inventory at all, and the shared-adapter-contract rule asks for one — of *participants*, not case names. Replace the deleted export with a typed participant inventory (`export const DEVICE_FLOW_PARTICIPANTS = ["fake", "fetch-backed"] as const`) that both `device-flow-fake.test.ts` and `github-auth.test.ts` register against, so a dropped participant is what fails.

### `tests/domain/fixtures/hash-stability/`

- **CONFIRMED** — *Orphaned fixture directory*. Verified by grep over `extensions/`, `tests/` and `docs/`: the only occurrence of the string `hash-stability` anywhere is inside the fixture's own `skills/foo.md` frontmatter. Nothing reads the tree. The first pass's preferred fix (wire it into `version.test.ts` with a recorded literal) is the right one and now has independent support: I reproduced all five `version.test.ts` hash literals from a hand-written implementation of the documented algorithm, which shows the pins are genuine — a committed fixture would extend that same guarantee across a git checkout's line-ending normalization, which the `writeFile`-based cases cannot.

### `extensions/pi-claude-marketplace/domain/github-auth.ts`

- **UNDERSTATED** — *Inline `Date.now()` in the poll deadline is a hidden dependency*. Recorded as a testability/design WARNING; it is also a live coverage hole. Because the only two `expires_in` values in the suite are `0` (collapsing the window) and `900` (never reached), the deadline expression at line 354 and the loop condition at line 356 have **no discriminating case at all**: `* 1000` → `* 100`, and `<` → `<=`, both survive the entire file. The design fix and the missing case are one ticket, and the ticket should say so.
- **CONFIRMED** — *`InitiateDeviceFlowOpts` and `DeviceFlowResult` fields are not `readonly`*. Real, WARNING fits; purely a consistency point against the rest of `domain/`. Nothing in the suite mutates either shape.

## Still clean after attack

These survived deliberate mutation, and the fixing pass should not spend time here.

- **`tests/domain/manifest-lookup.test.ts`** — catches `find` → `findLast` (duplicate-names case, line 116), `===` → `toLowerCase()` comparison (case-sensitivity case, line 90), `===` → `.includes()` and `.startsWith()` (empty-name case, line 51, which is exactly why that row exists), and NFC normalization (line 103). Whole-value `deepStrictEqual` throughout; no projections. This is the strongest file in the area for its size.
- **`tests/domain/manifest-cache.test.ts`** — apart from the `size` conjunct noted above, every branch of `createManifestCache` has a discriminating case, including both post-load-stat-failure arms (lines 362, 390) and the negative-entry identity re-throw (line 187, which asserts both `deepStrictEqual` against an independently built error *and* `strictEqual` identity). Mutations caught: negative-caching a stat failure; cloning on hit instead of returning by reference; caching under the pre-load stat; wrapping the loader's thrown value.
- **`tests/domain/version.test.ts`** — I reimplemented the documented PI-7 algorithm from scratch and reproduced all five non-trivial pinned literals (`hash-6e4d4d577c91`, `hash-7f044a9c40a0`, `hash-e07e386a2c84`, `hash-574e22309277`, `hash-e851780efdf8`) exactly. The pins are real, not stale snapshots, and the implementation matches its own documentation. Mutations caught: dropping the symlink path bytes; following symlinks; removing the BOM strip; removing the CRLF collapse; collapsing a standalone `\r`; changing `HASH_TRUNC`; changing the `hash-` prefix.
- **`tests/domain/clone-key.test.ts`** — I recomputed all three hash literals independently (`sha256` of the three URLs, first 12 hex) and they match. Mutations caught: swapping the two key halves; changing `KEY_TRUNC`; canonicalizing the URL inside the helper instead of hashing verbatim (the `.git` row at line 64 exists for exactly that); returning `source.url` for a github source.
- **`tests/domain/plugin-root.test.ts`** — apart from the decorative assertion noted above, every guard has a discriminating case, and `assert.strictEqual(pluginRootError.constructor, Error)` (line 166) catches the "throw a different error class carrying the same message" mutation. It also catches normalizing the returned path (the `..`-preserving case at line 61).
- **`tests/domain/source.test.ts`, `parsePluginSource` half** — 60 whole-value `deepStrictEqual` rows covering every arm of both object-source switches, every reject reason string, the `sha` validate/lowercase/drop rules, and the array/`null`/number boundary. Mutations caught: dropping the `.git` strip; dropping the empty-fragment rule; reordering the github-host arm after the generic-https arm; accepting an abbreviated sha; not lowercasing a valid sha.
- **`tests/domain/github-auth.test.ts`, everything except ordering and the deadline** — genuinely exemplary on the axes the first pass named. Mutations caught: any wrong argument to `requestCode`/`pollToken`/`approve` (`exactParams: true` on every mock, `verify()` at the end of every case); the cumulative-vs-flat `slow_down` back-off (lines 330–382 pin `0 → 5_000 → 10_000`); mutating `currentIntervalSec` on `pending`; every `PollResult` arm's reason string; the `error instanceof Error` fallback on both the init and poll paths; the exact wire bodies and headers of both requests (lines 861–888). `unexpectedFetch` as the default `fetch` implementation is the "fail loudly on unplanned input" pattern META-FINDINGS asks other files to adopt — it is already adopted here.
- **`tests/domain/device-flow-contract.ts` + `device-flow-fake.test.ts` negative control** — the deliberately-broken-fake case (`device-flow-fake.test.ts:129`) asserts the *exact set* of contract cases that fail, not merely that one does. I traced the broken fake against all ten cases and the expectation is correct: only "consumes polling responses in order" can detect a non-consuming queue. META-FINDINGS' judgment of this as a model implementation holds.
- **`tests/domain/name.test.ts`, everything except control-character position** — the `safeNeighbor` adjacency idiom is the strongest technique in the area: it pins each boundary from both sides, so `code < 0x20` → `code <= 0x20` is caught by the accepted `"foo\x20bar"` neighbor and `code === 0x7f` removal is caught by its own row. Also caught: dropping the `.trim()`; dropping the `"."`/`".."` check; the `source === plugin` short circuit; the D-141-02 empty-elision rule (`"acme-"` → `"acme:acme-"`); and every label-prefix variant.
- **No fragment assertions anywhere in the area.** Grep for `.includes(`, `.startsWith(`, `.endsWith(`, `.match(`, `notStrictEqual` across all 12 non-resolver domain test files returns only `assert.ok(error instanceof X)` inside `assert.throws` validators, each followed by an exact-message check. META-FINDINGS' item 3 (100+ fragment-assertion sites) has **zero** instances here.

## Not covered

- No toolchain commands were run — no `node --test`, no `npm run test:coverage:direct`, no `npm run check`, per this pass's constraint. Every coverage and branch claim above is from reading plus targeted `node -e` probes of the production modules; direct per-pair coverage remains unmeasured for this area.
- `domain/resolver.ts` / `tests/domain/resolver.test.ts` and `domain/components/` + `tests/domain/components/` were out of scope and not opened, except for the greps needed to confirm `MARKETPLACE_VALIDATOR` has no production consumer and that the `hash-stability` fixtures are unreferenced.
- `tests/integration/auth-e2e.test.ts` and the six orchestrator test files that import `tests/domain/device-flow-fake.ts` were not reviewed; I only confirmed the import edges exist. If the fake's options shape changes, those eight consumers are the blast radius.
- I did not attempt to determine whether `readdir` ordering on the CI filesystem makes the `version.ts` `.sort()` mutation reliably detectable — the pinned literals make it detectable whenever readdir order differs from sorted order, which is filesystem-dependent.

## Meta-findings impact

### New cross-cutting evidence

**1. A data-driven row can be silently malformed, and the row's own title is the only thing that says otherwise.** `source.test.ts:733` plans `"acme/tools#v2"` believing it carries a ref; the parser produces `repo: "tools#v2"` and no ref. The assertion still passes, for the wrong reason, and the property the case exists to protect is unguarded. This is a distinct defect class from a weak assertion: the assertion is strong (`strictEqual` on the whole outcome) and the *input* is wrong. It is invisible to any review that reads the row table without running the parser. **Where else to check:** every area with a `for (const row of ROWS)` table whose inputs are strings the production code re-parses — `tests/edge/args*.test.ts`, `tests/domain/resolver.test.ts`, `tests/orchestrators/plugin/*.test.ts` row tables, and `tests/bridges/hooks/if-field/*`. The cheap detection method is what I used: run the parser on each row's input and diff against what the row's *name* claims.

**2. `strong-mock` verifies calls but never their order, so any "X happens before Y" title in a `strong-mock` file is unverified by construction.** `github-auth.test.ts`'s AUTH-03 case is the instance I found; the technique the rules prescribe (one shared recorder log) is used elsewhere in the repo but not here. **Where else to check:** grep the unit suite for test titles containing `before`, `after`, `first`, `then`, `prior to`, `precedes` in files that import `strong-mock`, and check whether each has a shared log or only per-mock `when()`/`verify()`. META-FINDINGS names `tests/orchestrators/**`, `tests/edge/handlers/plugin/**` and `tests/index.test.ts` as the strict-mocking reference implementations — those are exactly the files most likely to carry this hole.

**3. `fallow dead-code` with `production: false` cannot see an export whose only consumer is its own test.** `MARKETPLACE_VALIDATOR` is the instance here. This is a structural blind spot in a gate the repo relies on, and it is the same shape as the "gates that do not gate" cluster. **Where else to check:** every `export` in `extensions/` whose grep hits are confined to its own module plus one `*.test.ts`. That is a mechanical repo-wide scan, and it belongs in the "audit every architectural gate" workstream rather than in a per-area file.

**4. The `safeNeighbor` adjacency idiom in `name.test.ts` is a propagatable pattern this sweep has not named.** Each rejected input is paired with an accepted input one character away, so every boundary predicate is pinned from both sides in the same table. It is what makes `name.test.ts` catch `code < 0x20` → `code <= 0x20`. Two files in this area needed it and did not have it (`version.test.ts`'s skip list, `auth-registry.test.ts`'s host match). It belongs in META-FINDINGS' "Patterns to propagate" table with `tests/domain/name.test.ts:48–133` as the reference.

### Corrections to META-FINDINGS.md

**Correction 1 — the exhaustiveness cluster is larger than four modules.** META-FINDINGS §"Ranked by leverage" item 5 says "Four modules have `switch` statements over closed unions with no `default` arm" and lists `reconcile/plan.ts`, `reconcile/apply.ts`, `plugin/install.messaging.ts`, `plugin/reinstall.messaging.ts`. Add `domain/source.ts:585`, `domain/source.ts:618`, and `domain/github-auth.ts:370` — six modules, seven switches.

**Correction 2 — and the cluster needs splitting, because the compiler already covers most of it.** The item asserts as a blanket fact that "adding a member to a closed set compiles clean at every derivation site." That is not true under this repo's `tsconfig.json` (`noImplicitReturns: true`, line 11). A switch whose every arm returns and which has no code after it produces TS7030 when a member is added — the repo's own memory records this (`switch-exhaustiveness-ts7030`). `source.ts:585` and `source.ts:618` are both that shape, so they are style/defence-in-depth, not silent-omission risks. `github-auth.ts:370` is the opposite shape — the function returns *after* the loop, so a new `PollResult` member compiles clean and produces a silent hang until the device-code deadline. **The fixing pass should triage each of the seven by whether code follows the switch, and prioritise only the ones where it does.** I have not checked the four originally-listed modules for this.

**Correction 3 — the reference-implementation table needs one qualification.** The row "Shared real/fake adapter contract with a deliberately-broken-fake negative control → `tests/domain/device-flow-contract.ts` — judged a model implementation" is right about the negative control (I verified the expected-failure set is exactly correct against all ten cases). But the contract is *not* a complete model: it records only one of the six required categories as inapplicable, covers neither overwrite nor deletion, and has no participant inventory. Qualify the row to "model negative control; incomplete category coverage" so the fixing pass does not copy the gaps along with the pattern.

**Correction 4 — "Confidence: findings are reliable; clean verdicts are not" is right, and this area is the sharper case for it.** `domain-core.md` reported 0 BLOCKERs and META-FINDINGS' "Ranked by leverage" leans on this area as healthy. Six mutations survive in files it declared clean, two of them (`auth-registry.test.ts` host matching, `github-auth.test.ts` notify ordering) on invariants the production source documents in prose. The general lesson for the consolidation: **a low finding count correlates with reviewer confidence, not with test strength** — this area got the lowest count in the domain layer and had unowned security invariants.

### Confirmations

- **Item 3 (fragment assertions), confirmed by absence.** I grepped all 12 non-resolver domain test files for `.includes(`, `.startsWith(`, `.endsWith(`, `.match(`, and `notStrictEqual`. Zero content-fragment assertions; every error check is `instanceof` plus an exact message. This area is a clean counter-example to the ~100-site cluster, which supports META-FINDINGS' framing that the defect is concentrated in the orchestrator render tests rather than repo-wide.
- **The "offline fake that fails loudly on unplanned input" pattern is already adopted here.** META-FINDINGS names `tests/orchestrators/plugin/fetch.test.ts` and says "adopt this in the other git fakes". `tests/domain/github-auth.test.ts:60` (`unexpectedFetch`) and `tests/domain/device-flow-contract.ts:113,118` (`fill`/`reject` that reject with "Unexpected credential fill") do the same thing for the HTTP and credential boundaries. Two more reference sites for that row.
- **Item 2 (test-only hooks over module-global state) does not extend into this area.** `domain/manifest-cache.ts` is the counter-example the first pass claimed it was: `createManifestCache(load)` owns its `Map`, has no reset export, and `manifest-cache.test.ts:69` ("keeps entries private to each cache instance") proves the isolation with two live instances. `domain/manifest.ts:86`'s module-level `manifestCache` singleton is the *result* of that factory, is documented as deliberate (D-01), and exposes no reset. Independently verified by grep: no `reset*` export exists anywhere under `domain/`.
- **The falsified-hypothesis list's spirit holds here too.** The first pass's suspicion that `github-auth.ts` had a hidden clock dependency was correct and I strengthened it; its suspicion that the device-flow contract was a model was correct in the part it named. Briefing with named suspicions again produced both a confirmation and a sharpening rather than vague reassurance.
