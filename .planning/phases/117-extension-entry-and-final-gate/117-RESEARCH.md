# Phase 117: Extension Entry and Final Gate - Research

**Researched:** 2026-09-03
**Domain:** Node `node:test` + `strong-mock` unit-test ownership; V8 block-coverage semantics; repository structural gates
**Confidence:** HIGH for A-F and H (measured in this tree); MEDIUM for G (ordering is inferred from measured file sets)
**Tree state:** branch `features/unit-test-refactor`, HEAD `5f799a32`. Every plant made during this
session was reverted; `git status --short` at the end matched the start byte for byte (the operator's
11 pre-existing untracked/modified entries and nothing else).

---

## Summary

Three of the eight things this phase was scoped against turned out to rest on a false premise, and
one previously-unnamed defect was found that would have made the phase's headline deliverable
invisible to `npm test`.

**The entry pair is not hard — it is already built and proven.** A cast-free owner reaching
**branches 14/14, functions 3/3, lines 161/161** on `extensions/pi-claude-marketplace/index.ts` was
written, run, planted twice, and measured during this session. It uses
`createNotificationBoundary`'s own `pi` (the helper is NOT broken by `pi.on.bind(pi)` — that premise
is false), and reaches the two catches no existing test touches through a cast-free `Proxy` over the
**event**, not the context. The working file is preserved at
`/tmp/claude-1000/-home-acolomba-pi-claude-marketplace-unit-test-refactor/4b89fec9-1c29-4a8a-88ef-c3496865a093/scratchpad/proto-index.test.ts.txt`.

**`npm test` cannot see `tests/index.test.ts`.** The glob is
`tests/{architecture,bridges,...}/**/*.test.ts` — every alternative names a directory, and the root
file sits in none of them. Measured: `globSync` returns 249 paths and `includes("tests/index.test.ts")`
is `false`. The direct-coverage gate would report the pair green while the owner never ran in the
suite. Both `test` and `test:coverage:unit` need amending.

**Primary recommendation:** run the helpers dissolution first (largest blast radius, no gate depends
on it), then the orphan folds, then the entry pair with the glob amendment, then the gate
strengthening with its controls, then the all-pair run, then the sweep. Do not let two workstreams
hold `package.json` at once.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-117-01:** Fold each supplement into the mirrored owner of the module it actually measures;
  relocate to `tests/architecture/` only the ones that span modules and so have no single owner.
  The gate already exempts `architecture`, `e2e` and `integration` by root, so relocation needs no
  gate change. — **Reversibility:** costly.

  | Orphan | Disposition |
  | --- | --- |
  | `tests/shared/index-smoke.test.ts` (434 lines) | fold into `tests/index.test.ts` |
  | `tests/edge/index-handler.test.ts` (235 lines) | fold into `tests/index.test.ts`, casts dropped |
  | `tests/shared/device-flow-prompt.test.ts` | fold into `tests/domain/github-auth.test.ts` |
  | `tests/orchestrators/marketplace/cascade.test.ts` | fold into `tests/orchestrators/marketplace/shared.test.ts` |
  | `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` | relocate to `tests/architecture/` |
  | `tests/bridges/integration-materialization-gate.test.ts` | relocate to `tests/architecture/` |
  | `tests/helpers/source-scan.test.ts` | relocate to `tests/architecture/` (see D-117-04) |

- **D-117-02:** `tests/edge/index-handler.test.ts` holds the 7 `as any` / `as unknown as` casts that
  are absent from every one of phase 116's 30 pairs. The casts do not survive the fold. If a proof
  cannot be restated without one, that is a finding to report, not a cast to carry forward.
- **D-117-03:** Both folds into `tests/index.test.ts` must land in a suite that reaches 100 percent
  direct coverage of `index.ts` when run alone. The existing hand-rolled `MockPi` shape in
  `index-smoke.test.ts` is not automatically the shape the new owner keeps; the owner follows the
  house pattern for a registration table.
- **D-117-04:** Dissolve `tests/helpers/` in this phase. Two modules have an unambiguous home; the
  two cross-tier ones go beside their **dominant** consumer and the minority imports across the tier
  boundary. — **Reversibility:** costly.

  ```text
  tests/architecture/source-scan.ts         (5 consumers, all local)
  tests/architecture/source-scan.test.ts    (its orphan resolved by the same move)
  tests/integration/ipc-child.ts            (2 consumers, all local)
  tests/edge/notification-boundary.ts       (22 local, 4 cross-tier)
  tests/edge/handlers/marketplace-seed.ts   (13 local, 2 cross-tier)

  tests/helpers/ deleted.
  ```

- **D-117-05:** The 6 surviving cross-tier imports (4 into `notification-boundary.ts`, 2 into
  `marketplace-seed.ts`) are accepted and named, not hidden. `.fallowrc.json`'s zone rules govern
  `extensions/`, not `tests/`, so they break no configured boundary — but the plan states them
  explicitly rather than leaving them to be rediscovered.
- **D-117-06:** Duplicating a helper per tier was rejected.
- **D-117-07:** Add proxy-owned and ambiguous detection to the structural gates. — **Reversibility:**
  reversible.
- **D-117-08:** Every new check gets a COV-04 negative control that **plants the violation** and
  proves the gate rejects it. A control that reads the gate's configuration back is not a control.
- **D-117-09:** No repo-wide audit of pre-existing gates' negative controls.
- **D-117-10:** Measure first, decide second. One task times the full sequential 204-pair run on
  Node 24 and records the wall-clock **read from the runner**, never computed from a delta.
- **D-117-11:** If concurrency is added, it ships with a negative control proving a planted failing
  pair is still detected when runs interleave. If it is not added, the plan records the measured
  duration and the reason. Either outcome is acceptable; an unmeasured choice is not.
- **D-117-12:** Sweep the inventory to truth in this phase (pair total 203/204 → 204/204 in
  ROADMAP.md **and** STATE.md prose; `MOD-10` closed; `REQUIREMENTS.md` status drift; ROADMAP's two
  independently-drifting plan counts).
- **D-117-13:** No production licence is opened. A branch or comment that cannot be corrected without
  a production edit is a finding to report, not a licence to take.
- **D-117-14:** The tool `available` / `unavailable` parameter-description decision stays open for the
  operator. — **Reversibility:** one-way.

### Inherited rules that still bind — do not relitigate

- **D-116-01a as amended (2026-09-02):** any pair that MEASURES an unreachable branch becomes a
  claimant and MUST pin the shortfall IDENTITY — an `Incomplete direct coverage for <source>:`
  verdict, denominator minus numerator exactly 1, the exact uncovered line set. Never pin an absolute
  branch pair. **No coverage-exception pragma, ever.** File each in `.planning/WINDOWS.md`.
- **D-116-04:** plant every non-obvious proof, confirm RED, revert, and record what the plant
  **actually said**. A plant that stays GREEN is a finding.
- **D-116-05 = O3:** a module with a real seam or an injected port gets exact-argument mocks; a
  seamless one gets `createNotificationBoundary(1, 0)` + `verifyBoundary()` with the exact-argument
  gap recorded in `must_haves`.
- **A green test proves nothing until you make it fail.** Read a plan's blocks against each other,
  not only against the module.

### Claude's Discretion

- The internal structure of `tests/index.test.ts` — case decomposition, fixture shape, and how the
  two folded suites' cases are merged or dropped as redundant.
- Whether the ambiguous and proxy-owned checks live in `check-corresponding-tests.mjs`,
  `test-coverage-direct.mjs`, or a third script, provided each lands where its requirement points.
- Plan and task decomposition, wave ordering, and commit granularity, subject to DEL-01.
- The order in which the four workstreams run, except that the inventory sweep (D-117-12) is last.

### Deferred Ideas (OUT OF SCOPE)

- A gate for unused type members.
- `BOOLEAN_FLAGS` re-exported from `edge/handlers/plugin/list.ts`.
- The tool `available` / `unavailable` parameter descriptions.
- A repo-wide audit of every structural gate's negative control.

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OWN-01..06 | Every production module has one mirrored owner test importing it directly | §D measures the gate's real behaviour and corrects the OWN-02 premise |
| CASE-01..04 | Case structure, naming, arrange/act/assert | §C names which legacy cases survive; house rules read (`.claude/rules/typescript-unit-testing.md`) |
| TEST-01..05 | Strong mocks, exact params, hermeticity | §A proves `createNotificationBoundary` owns this module; §B gives the measured probe counts |
| COV-01..05 | Focused direct coverage, fail-closed, complete record per row | §B (the 14/14 proof), §D (plantable verdicts), §F (record artifact, type-only tension) |
| DES-01..03 | Production designed for its tests; no test-only seams | §B: no seam needed — the `Proxy`-over-event route uses only the public handler signature |
| DEL-01..04 | One concern per plan/commit; rename hygiene | §E sequencing; §G conflicts |
| MOD-10 | The entry pair completes the contract | §A, §B, §C |
| PRES-01..02 | Public/persistence/adapter contracts unchanged | No production edit is needed anywhere in this phase (§A-§F) |
| SUITE-01..06 | Suite-wide gates, no generic helper directory, no exemption list, `npm run check`, inventory truth | §E (dissolution mechanics), §F (glob defect), §H (sweep line numbers) |

---

## Baseline measured in this tree, 2026-09-03

Every command below was run from the repository root and its exit code read directly.

| Command | Exit | Output read from the runner |
|---|---|---|
| `node scripts/check-corresponding-tests.mjs` | 1 | 8 violations (listed in §D) |
| `npm test` | 0 | `ℹ tests 5141` / `ℹ suites 295` / `ℹ pass 5141` / `ℹ fail 0` |
| `npm run test:integration` | 0 | `ℹ tests 31` / `ℹ pass 31` / `ℹ fail 0` |
| `npm run typecheck` | 0 | (silent) |
| `npm run lint` | 0 | (silent) |
| `npm run fallow` | 0 | three sub-gates clean |
| `npm run test:corresponding:negative` | 0 | `Corresponding-test negative controls passed.` |
| `npm run test:coverage:direct:negative` | 0 | `Direct-coverage negative controls passed.` |

`npm run check` was deliberately NOT run — the standing environment debt holds (`format:check`
short-circuits on the operator's untracked files). The eight rows above are what the aggregate would
have covered, minus `format:check`.

**Runtime — a new finding.** `node --version` on PATH prints **`v26.7.0`**; `/usr/bin/node --version`
prints **`v22.22.2`**. `command -v nvm fnm volta n asdf mise` finds nothing and there is no
`~/.nvm`, `~/.volta`, or brew `node@*` keg. `.github/workflows/ci.yml` pins `node-version: "24"` at
lines 70, 91, 111 and 132. **No Node 24 is installed in this checkout.** Success criterion 3 names
"the Node 24 all-pair result"; the plan must either install one or record which runtime it actually
measured and say so.

**Module count.** `readdirSync("extensions/pi-claude-marketplace", {recursive:true})` filtered to
`.ts` returns **204** files. The inventory total is correct.

---

## A. Can the house boundary helper own `index.ts` at all?

### The premise was FALSE

The question assumed `pi.on.bind(pi)` at `index.ts:29` would break `createNotificationBoundary`.
It does not. Two separate things were conflated:

1. **The lint error 116-27 hit is in the TEST file**, when a test reads a boundary method as a value.
   The new owner never does that — the `.bind()` is production code inside `index.ts`, which the test
   only calls. No `unbound-method` diagnostic arises anywhere in the owner.
2. **`.bind()` on a `strong-mock` proxy works at runtime.** Measured with a scratch probe
   (`tests/zz-scratch-probe.test.ts`, since deleted):

   ```
   ✔ probe: pi.on read as a value then .bind(pi) (4.460967ms)
   ℹ tests 1  ℹ pass 1  ℹ fail 0
   ```

   The bound function records the call and satisfies the `when(() => pi.on("session_start", …))`
   expectation exactly as a direct call would.

### MEASURED: the whole factory runs against the helper's own `pi`

A scratch owner was built at `tests/index.test.ts` (since deleted; preserved at
`.../scratchpad/proto-index.test.ts.txt`) using `createNotificationBoundary(emissions, probes)` and
adding the 17 registration expectations to the helper's returned `pi`. Result:

```
node --test --experimental-test-coverage tests/index.test.ts
ℹ tests 9  ℹ suites 0  ℹ pass 9  ℹ fail 0

node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/index.ts
Direct coverage passed: extensions/pi-claude-marketplace/index.ts (branches 14/14, functions 3/3, lines 161/161)

npm run typecheck   -> exit 0
npm run fallow      -> exit 0
node scripts/check-corresponding-tests.mjs -> 7 violations (missing-test: tests/index.test.ts is GONE)
```

`verifyBoundary()` is called in every case and passes. `registerTool` — a **generic** method on
`ExtensionAPI` — states and matches fine against the helper's `mock<ExtensionAPI>`.

### MEASURED: the registration order (17 calls, in this exact sequence)

Probed with a recording `pi` and a hermetic `HOME`:

```
["on:session_start","on:session_shutdown","on:session_before_compact","on:session_compact",
 "on:input","on:tool_call","on:tool_result","on:before_agent_start","on:agent_end",
 "on:agent_settled","on:input","on:resources_discover","on:session_start",
 "command:claude:plugin","on:session_start",
 "tool:pi_claude_marketplace_list","tool:pi_claude_marketplace_plugin_list"]
```

Eleven `pi.on` from `registerHooksBridge`, then `resources_discover` and the SENV `session_start`
from `index.ts`, then `registerCommand` + the TC-7 `session_start` wrapper + the two tools from
`edge/register.ts`. The SENV handler is the **second** of three `session_start` registrations —
which is what `index-smoke.test.ts`'s `sessionStart[1]!` index read has always relied on, now
confirmed by measurement rather than by its comment.

### MEASURED: two authoring traps, both from 116-28's own pattern

Writing the expectations the lazy way costs two diagnostics. Both were hit and both were fixed:

| What I wrote | What it printed | Fix |
|---|---|---|
| `pi.on(event, It.isAny())` inside a `for` loop over a `const [...] as const` array | `tests/…(50,13): error TS2769: No overload matches this call.` | One `when()` per registration with a **literal** event name — `ExtensionAPI.on` is a 32-way overload set and a union-typed argument resolves none of them |
| `It.isAny()` | 5× `@typescript-eslint/no-unsafe-argument` (`Unsafe argument of type 'any' assigned to a parameter of type 'ExtensionHandler<…>'`) | `It.willCapture<T>("label")` with `T` named — which is what the house rules mandate anyway (`no It.isAny()`) |
| `pi.registerTool(It.willCapture("marketplace list tool"))` untyped | `error TS2345: Argument of type 'Matcher & { value: unknown; }' is not assignable to parameter of type 'ToolDefinition<TSchema, unknown, any>'` | `It.willCapture<Parameters<ExtensionAPI["registerTool"]>[0]>("…")` |

**INFERRED, and it is a real difference from 116-28:** `tests/edge/register.test.ts` needed its
locally-declared `PiRegistrar` type (`Omit<ExtensionAPI,"registerTool"> & { registerTool: (tool: ToolRegistration) => void }`)
because it **compares** the registered tool definition structurally. This owner only **captures** it,
so the instantiated `Parameters<…>[0]` form suffices and `PiRegistrar` is not required. If the plan
decides to compare either tool registration by value, `PiRegistrar` comes back.

### The nearest analog, read in full

`tests/edge/register.test.ts` (from 116-28) is the pattern. Its mechanism for a registration table:

- `const pi = mock<PiRegistrar>({ exactParams: true, name: "extension API" });`
- `const commandOptions = It.willCapture<CommandRegistration>("claude:plugin registration");`
- `when(() => { pi.registerCommand("claude:plugin", commandOptions); }).thenReturn().times(1);`
- the command name and event name are **hand-authored as exact arguments**; only the callback is
  captured, because a function has no structural comparison
- `verify(pi)` last, wrapped as `verifyRegistrar()`
- a `createHermeticScope(t, label)` that mkdtemps `cwd` + `HOME`, deletes `PI_CODING_AGENT_DIR`,
  `process.chdir`s, and registers the restore in `t.after` **before** anything runs
- `installNetworkTrap(t)` replacing `https.request` with a fail-fast throw, explicitly labelled a
  hermeticity device with **no count asserted**

The new owner should take all of this. Note it registers the network trap and asserts nothing against
it — the same disposition applies here (see the caution in §B).

**INFERRED:** `index.ts` reaches `orchestrators/marketplace/shared.ts`'s `DEFAULT_GIT_OPS` by static
import, so the git door IS in this module's import graph. Whether any input through the captured
`resources_discover` handler opens it was **NOT MEASURED** — running `applyReconcile` over a fixture
declaring a cold git source would settle it. Per the handoff's SC-4 rule, ask the two questions
separately (can the fixture reach the transport; does any input turn it on) and label the zero
honestly. Default disposition: install the trap, assert no count, say why.

### Production `index.ts` carries a cast — recorded, not fixed

`index.ts:29-35` reads `pi.on.bind(pi) as unknown as (event: "resources_discover", handler: …) => void`.
That is existing production code and D-117-13 opens no licence. It costs the test nothing: the owner
never touches it.

---

## B. What does 100% direct coverage of `index.ts` actually require?

### MEASURED: the coverage the two legacy suites reach today

```
node --test --experimental-test-coverage --test-reporter=lcov --test-reporter-destination=… \
  tests/shared/index-smoke.test.ts tests/edge/index-handler.test.ts
```

LCOV record for `extensions/pi-claude-marketplace/index.ts`:

```
FNF:3  FNH:3
BRF:11 BRH:9
LF:161 LH:154
uncovered lines: 72 73 74 75 76 126 127
```

Per suite, run alone:

| Run | FNH/FNF | BRH/BRF | LH/LF | uncovered lines |
|---|---|---|---|---|
| `index-smoke.test.ts` alone | 3/3 | 6/10 | 134/161 | 72-76, 87-101, 119-123, 126-127 |
| `index-handler.test.ts` alone | 2/3 | 6/9 | 137/161 | 72-76, 113-124, 126-127, 149-153 |
| both together | 3/3 | 9/11 | 154/161 | 72-76, 126-127 |
| **the prototype owner, alone** | **3/3** | **14/14** | **161/161** | **none** |

### MEASURED: merging two suites HID an uncovered branch

Run alone, `index-smoke.test.ts` emits `BRDA:118,6,0,0` — the `catch (notifyErr)` at line 118 is
**never entered**. In the merged two-file run **no `BRDA` is emitted for line 118 at all**, and lines
119-123 report a hit count of `1`. The merged report therefore shows that region as covered when
neither suite executed it.

This is the strongest single argument for COV-05's "no aggregate-coverage substitution": the
aggregate is not merely weaker than the per-pair run, it can be **wrong in the safe direction**. It
also means the phase's headline claim must come from the focused per-pair run, never from
`coverage/unit.lcov`.

### The branch inventory of `index.ts`, and how each is reached

Line numbers are `extensions/pi-claude-marketplace/index.ts` at HEAD `5f799a32`.

| Site | Line | What it is | Reached in legacy? | How the prototype reaches it |
|---|---|---|---|---|
| module top-level | 1 | import evaluation | yes | any load |
| `claudeMarketplaceExtension` | 29 | the async factory | yes | every case |
| `resources_discover` arrow | 64 | the handler body | yes | every discover case |
| try continuation | 70 | after `hydrateProjectScopeForCwd` | yes | clean case |
| **`} catch {`** | **71** | hydrate failure (NFR-2) | **NO** | `Proxy` over the event throwing on `cwd` **read 1** |
| try continuation | 85 | after `applyReconcile` | yes | clean case |
| `} catch (err) {` | 86 | reconcile failure | yes (handler suite) | invalid `claude-plugins.json` + a notify that throws |
| `} catch {` | 97 | last-ditch notify failure | yes (handler suite) | every notify throws |
| try continuation | 111 | after `recomputePluginPath` | yes | clean case |
| `for (const skip of …)` | 112 | PATH skip loop body | yes (smoke suite) | malformed project `state.json` |
| try continuation | 124 | after the PATH warning notify | yes | same |
| **`} catch (err) {`** | **125** | PATH recompute failure | **NO** | `Proxy` over the event throwing on `cwd` **read 3** |
| `session_start` arrow | 148 | the SENV handler | yes | direct invocation |
| `} catch (err) {` | 151 | session-env failure | yes | a `getSessionId` that throws |
| `} catch (notifyErr) {` | 118 | PATH-warning notify failure | **NO** (hidden by the merge) | malformed `state.json` + a notify that always throws |

**Every branch is reachable through the module's default export. None is compiler-forced. None is
structurally unreachable. This pair produces NO D-116-01a claimant** — proven by reaching 14/14, not
by inspection.

### MEASURED: how to make `applyReconcile` throw with no injection seam

The legacy technique in `tests/edge/index-handler.test.ts:153-206` is correct and survives: seed
`<cwd>/.pi/claude-plugins.json` with the single byte `{`, then hand the handler a `ctx` whose FIRST
`ui.notify` call throws. `applyReconcile` accumulates an invalid-block outcome, renders its cascade,
and the throwing notify propagates out of `applyReconcile` into the line-86 catch. The SECOND notify
(the last-ditch `reconcile aborted:` line) succeeds and is recorded. Making **every** notify throw
drives the inner catch at line 97 as well.

Restated cast-free in the prototype as a `Proxy` over the boundary's own `ctx` that returns a
throwing `ui` object for the `ui` read and delegates every other member with `Reflect.get`. This is
116-15's technique, applied to `ctx.ui` rather than `ctx.cwd`.

### MEASURED: the two catches nothing reaches, and why

Both `hydrateProjectScopeForCwd` and `recomputePluginPath` swallow their own internal failures.
Read them:

- `bridges/hooks/event-router.ts:604-642` — `loadState` is wrapped in its own try/catch which
  `hookDebugLog`s and `return`s. The only unguarded throw site is `locationsFor("project", cwd)` at
  line 629.
- `orchestrators/plugin-path.ts:87-115` — each scope's `collectBinDirs(await loadState(...))` is
  inside a per-scope try that pushes to `skipped`. `applyPathLedger` is pure string manipulation
  (`shared/session-env.ts:94-127`) and cannot throw. Assigning to `process.env` cannot throw —
  probed directly: a value containing a NUL byte is silently **truncated**, not rejected
  (`assigned ok: "a"`). The only unguarded throw sites are `locationsFor("user", homedir())` at line
  96 and `locationsFor("project", cwd)` at line 97.

`locationsFor(scope, cwd)` is `scope === "user" ? getAgentDir() : path.join(cwd, ".pi")`
(`persistence/locations.ts:144-145`). It throws only when `cwd` is not a string.

**The route: `event.cwd` is read four times, and the test owns the event object.**

| Read | Line | Consumer |
|---|---|---|
| 1 | 70 | `hydrateProjectScopeForCwd(event.cwd)` |
| 2 | 85 | `applyReconcile({ ctx, pi, cwd: event.cwd })` |
| 3 | 111 | `recomputePluginPath(event.cwd)` |
| 4 | 131 | `locationsFor("project", event.cwd)` |

A `Proxy` over the event that counts `cwd` reads and throws on exactly the *n*th one drives whichever
catch you want and lets the rest of the handler run normally. Cast-free — `new Proxy<T>` preserves
`T`, so the value is still a `ResourcesDiscoverEvent` and needs no assertion:

```ts
function eventThrowingOnCwdRead(event: ResourcesDiscoverEvent, nth: number): ResourcesDiscoverEvent {
  let reads = 0;
  return new Proxy(event, {
    get(target, property, receiver): unknown {
      if (property === "cwd") {
        reads += 1;
        if (reads === nth) {
          throw new Error(`cwd read ${nth} refused`);
        }
      }

      return Reflect.get(target, property, receiver);
    },
  });
}
```

`nth = 1` covers line 71; `nth = 3` covers line 125. Note the explicit `: unknown` return annotation
on the trap — without it, `Reflect.get` returns `any` and `@typescript-eslint/no-unsafe-return`
fires. `tests/edge/handlers/plugin/enable-disable.test.ts:190-209` (116-15) already writes it that
way; copy that form.

### MEASURED: the inner catch at line 118

Seed `<cwd>/.pi/pi-claude-marketplace/state.json` with `{ not json` so `recomputePluginPath` returns
one `skipped` entry, and hand the handler a `ctx` whose notify **always** throws. `applyReconcile`
emits nothing on that fixture (measured — see the probe counts below), so the outer catch is not
taken; the loop at line 112 runs, `makeRawNotifyFn(ctx)` throws, and lines 118-123 execute.

`makeRawNotifyFn` (`shared/notify.ts:4125-4135`) reads `ctx.ui` inside the returned closure, so each
last-ditch or PATH-warning emission is one `ctx.ui` read plus one `ui.notify` read against the
boundary.

### MEASURED: the probe counts — do not inherit them

`createNotificationBoundary`'s `toolProbes` argument is required and per-case. Measured on this
module, from strong-mock's own `verify` failures:

| Fixture | emissions | toolProbes |
|---|---|---|
| pristine cwd, clean reconcile | 0 | **0** |
| malformed project `state.json` (PATH warning path) | 1 | **2** |
| invalid `claude-plugins.json` + throwing notify (reconcile-throw path) | 0 (intercepted) | **2** |

Sizing any of these at 0 probes produced:

```
Error: The following calls were unexpected:
 - extension API.getAllTools()
 - extension API.getAllTools()
There are no remaining unmet expectations.
  at verifyBoundary (tests/helpers/notification-boundary.ts:111:7)
```

The 2 probes on the malformed-`state.json` fixture come from `applyReconcile`'s render path even
though it emits nothing through the boundary. Measure yours; do not derive it from the emission
count.

### MEASURED: two plants, both RED, both reverted (D-116-04)

With the prototype in place at `tests/index.test.ts`, one case removed at a time:

```
=== PLANT A (hydrate-throw case removed) ===
Incomplete direct coverage for extensions/pi-claude-marketplace/index.ts: branches 11/12, lines 156/161

=== PLANT B (PATH-recompute-throw case removed) ===
Incomplete direct coverage for extensions/pi-claude-marketplace/index.ts: branches 10/11, lines 159/161

=== RESTORED ===
Direct coverage passed: extensions/pi-claude-marketplace/index.ts (branches 14/14, functions 3/3, lines 161/161)
```

Note what the plants prove beyond "the case is load-bearing": the branch **denominator** moved from
14 to 12 and to 11. Removing a case did not just lower the numerator. This is D-116-01a's
amendment demonstrated on this exact module — V8 emits a branch range only when its count diverges
from its enclosing block, so a weaker suite has **fewer** branches, not more uncovered ones. The
progression across this session was BRF 9 → 10 → 11 → 12 → 14 on one unchanged source file. Any plan
that writes an absolute branch pair into a `must_haves` is wrong before it is executed.

---

## C. The two suites being folded in

Both read in full.

### `tests/shared/index-smoke.test.ts` (434 lines, 7 cases)

| Case | Proves | Disposition |
|---|---|---|
| `default export is a function` | `typeof === "function"` | **DROP** — restated by every other case; a case that restates a compiler fact |
| `registers command, read-only tools, session_start, and resources_discover exactly once` | a **sorted** list of 14 event names, 1 command name, 2 tool names | **REBUILD.** The sorted-list form cannot see registration order and cannot see a swapped handler; it also compares names against a hand-copied array, which is the weakest half of what 116-28 measured. Replace with per-registration `when()` + literal name + typed `It.willCapture` |
| `resources_discover handler resolves project cwd at invocation time` | a prompt seeded under `event.cwd` is discovered and one under `process.cwd()` is not | **KEEP** — a real behavioural discriminator no coverage number can see |
| `PENV-01 … applies the plugin PATH from a valid state.json` | `process.env.PATH` gains `<resolvedSource>/bin`; `PI_CLAUDE_MARKETPLACE_PATH` is set | **KEEP** — an environment footprint, the PENV-01 equivalent of 116-07's on-disk footprint |
| `PENV-01 … malformed state.json and warns for that scope` | exactly one `warning` notify naming the project scope | **KEEP** — also the only thing covering lines 112-117 |
| `SENV-01/02/03 session_start applies the session env` | the three env vars after `getSessionId()` | **KEEP** |
| `WR-02 session_start swallows a throwing or undefined sessionManager` | `doesNotThrow` on both a throwing `getSessionId` and `{}` | **KEEP, but split the claim.** The two inputs produce the identical outcome; per the handoff's tautology rule, either show an input where they disagree or state plainly that both are the same NFR-2 path and keep one as the case with the other as a companion row |

### `tests/edge/index-handler.test.ts` (235 lines, 4 cases)

| Case | Proves | Disposition |
|---|---|---|
| `RECON-04 wiring: … with bound ctx` | `handlers.has("resources_discover")` and `handler.length === 2` | **DROP.** `Function.length` is a weak proxy for "the cast that elided ctx is gone" — an arrow taking two params satisfies it whatever it does with them. Subsumed by the `It.willCapture<DiscoverHandler>` expectation, which names the event by hand and types the callback |
| `a clean reconcile … returns a ResourcesDiscoverResult` + the WR-05 pristine-scope check | result shape, zero notifications, **and that neither `<cwd>/.pi` nor `<home>/.pi` was created** | **KEEP** — the WR-05 half is an on-disk negative and is exactly the footprint discipline 116-24 mandated. Note `bridges/hooks/event-router.ts:741` cites this test by name as the reason `ensureSharedDataDir` is gated |
| `a real applyReconcile throw is caught … reports 'reconcile aborted:' at error severity` | line 86-96 | **KEEP**, casts dropped |
| `even when the last-ditch notify ALSO throws` | line 97-100 | **KEEP**, casts dropped |

Neither suite covers lines 71, 118 or 125. Those three cases are **new** and are supplied by the
prototype.

### The casts, located and dispositioned

`grep -n "as unknown as\|as any\| as ResourcesDiscoverHandler" tests/edge/index-handler.test.ts`
returns **11 cast sites**, of which **7 are `as unknown as`** (which is the count D-117-02 names):

| Lines | Cast | Count | Can it be restated without a cast? |
|---|---|---|---|
| 99, 118, 170, 213 | `pi as unknown as ExtensionAPI` | 4 (`as unknown as`) | **YES** — use `createNotificationBoundary(…).pi`. Proven |
| 124, 194, 228 | `ctx as unknown as ExtensionContext` | 3 (`as unknown as`) | **YES** — use the boundary's `ctx`, or a `Proxy` over it for the throwing/`sessionManager` variants. Proven |
| 105, 119, 171, 214 | `pi.handlers.get(…) as ResourcesDiscoverHandler` | 4 (plain `as`) | **YES** — `It.willCapture<DiscoverHandler>("resources discover")`; `.value` is already typed. Proven |

`tests/shared/index-smoke.test.ts` carries five more of the same family (line 51
`as unknown as ExtensionAPI`; lines 269-272 and 311-314 `as (event: unknown, ctx: unknown) => …`;
lines 378 and 417 `sessionStart[1]! as …`; line 155 `result.promptPaths as string[]`). All eliminable
by the same three moves.

**MEASURED: the prototype contains ZERO `as unknown as`, ZERO `as any`, and ZERO `as never`,
typechecks at exit 0, lints clean apart from one `import-x/order` nit, and reaches 14/14 branches.**
`grep -n "as unknown as\|as any\| as never"` on it returns nothing.

**No proof was lost.** Every cast in both legacy suites exists only to force a hand-rolled object into
a Pi type. None of them supports a claim.

### The hand-rolled `MockPi` shape

Both suites build their own. Neither is compatible with TEST-03/TEST-04: `index-smoke`'s `makePiMock`
ends in `as unknown as ExtensionAPI` and records into `Map`s (no exact-parameter checking, no
unexpected-call failure); `index-handler`'s uses `mock.fn` from `node:test`, which is a spy, not a
strong mock. Per D-117-03 the new owner is rebuilt on the 116-28 pattern. Proven workable in §A.

---

## D. Ambiguous and proxy-owned detection (D-117-07)

All four files read in full: `scripts/check-corresponding-tests.mjs` (182 lines),
`scripts/test-coverage-direct.mjs` (298 lines), and both `.negative.mjs` controls.

### MEASURED: the 8 violations, re-run in this tree on 2026-09-03

```
$ node scripts/check-corresponding-tests.mjs   # exit 1
missing-test: tests/index.test.ts
unexpected-test: tests/bridges/integration-materialization-gate.test.ts
unexpected-test: tests/edge/index-handler.test.ts
unexpected-test: tests/helpers/source-scan.test.ts
unexpected-test: tests/orchestrators/marketplace/cascade.test.ts
unexpected-test: tests/orchestrators/plugin/cross-surface-reason-parity.test.ts
unexpected-test: tests/shared/device-flow-prompt.test.ts
unexpected-test: tests/shared/index-smoke.test.ts
Corresponding-test gate failed with 8 violation(s).
```

Unchanged from CONTEXT. Adding the prototype owner dropped it to exactly 7 (the `missing-test` row
disappeared, nothing else moved).

### The OWN-02 "proxy" premise was HALF FALSE

The question states the gate today has only `wrong-import` meaning "the owner does not import its
pair at all", and asks whether the additional proxy case is detectable. **Planted against the gate's
`--root` seam:**

```
A) owner imports ONLY the barrel:
[ { "kind": "wrong-import", "path": "tests/bridges/skills/stage.test.ts" } ]

B) owner imports the barrel AND its pair directly:
[]
```

(Fixture: `bridges/skills/stage.ts`, a barrel `bridges/skills/index.ts` re-exporting it, and an owner
`tests/bridges/skills/stage.test.ts` importing one or both.)

So the strong form of proxy ownership — the owner reaches its pair only through a barrel — is
**already rejected today**, under the name `wrong-import`. What is missing is not detection but
**naming**: the verdict does not say the owner went through a proxy, so a maintainer reading
`wrong-import` cannot tell a barrel proxy from a suite that imports nothing at all.

Form (B) — a direct import present *and* a barrel import beside it — is **not distinguishable from
the import list**. Deciding which binding the test actually invokes needs call-site analysis, not
import analysis. Say so; do not build a check that pretends otherwise.

### MEASURED: what a stricter, decidable OWN-02 rule would cost today

`find extensions/pi-claude-marketplace -name index.ts` returns 8 files: 7 barrels
(`bridges/{agents,commands,mcp,skills}/index.ts`, `bridges/hooks/index.ts`,
`bridges/hooks/if-field/index.ts`, `orchestrators/import/index.ts`) plus the root entry.
`ARCHITECTURE.md`'s mention of an aggregate `bridges/index.ts` is stale — it does not exist.

Eight test files import a production barrel:

```
tests/architecture/hooks-if-field.test.ts        tests/bridges/hooks/settle.test.ts
tests/bridges/hooks/dispatch-exec.test.ts        tests/edge/register.test.ts
tests/bridges/hooks/dispatch.test.ts             tests/edge/types.test.ts
tests/bridges/hooks/event-router.test.ts         tests/orchestrators/plugin/{uninstall,update}.test.ts
```

(plus the 7 barrels' own owner tests, which import their pair legitimately, and one
non-`.test.ts` fixture at `tests/fixtures/bad-imports/edge-imports-bridges.ts`.)

An audit script resolving each barrel's re-export list and comparing it against each importer's own
pair reported, for **all eight**:

```
barrel re-exports its OWN pair: NO
```

**So the rule "an owner test MUST NOT import a barrel that re-exports its own pair" is green on the
current tree.** It is decidable from the import graph the gate already builds, it encodes OWN-02
literally, and it is plantable. That is the recommended shape of the new check, alongside splitting
`wrong-import` into `wrong-import` and `proxy-import`.

### COV-02 "ambiguous": not reachable at the path level — and the correction

`pairForPath` (`scripts/test-coverage-direct.mjs:48-70`) already fails closed on:

- a path outside the project → `Path is outside the project: <p>` (`toProjectPath`, line 19)
- a path under neither root → `Path is not a source-test pair member: <p>` (line 60)
- a production path not ending `.ts` → `Not a production TypeScript path: <p>` (line 29)
- a `tests/` path not ending `.test.ts` → `Not a corresponding test path: <p>` (line 41). This is
  what a support module such as `tests/edge/notification-boundary.ts` hits
- either pair member absent → `Missing source-test pair member: <p>` (line 65)

`sourceToTest` and `testToSource` are total and mutually inverse string slices. **No path maps to
more than one pair, and no path is reachable that maps to two.** The premise that a path-level
ambiguity exists is false under the current 1:1 name mapping.

**MEASURED: ambiguity IS reachable one level down, and is already guarded there.**
`assertCompleteCoverage` throws when `records.length !== 1`. Driven with a synthetic LCOV text:

```
A THREW: Incomplete direct coverage for extensions/pi-claude-marketplace/shared/types.ts: branches 1/2, functions 0/1, lines 2/3
B THREW: Expected one LCOV record for extensions/pi-claude-marketplace/shared/types.ts, found 2
C:      branches 2/2, functions 1/1, lines 3/3
```

(A = one record with shortfalls; B = the same record duplicated; C = a complete record.)

Verdict B **is** the concrete ambiguity COV-02 names — two coverage records claiming the same source
— and it has no negative control today. Verdict A is the shortfall verdict the entire D-116-01a pin
regime rests on, and it has no negative control either. Both are plantable, as just shown.

**Recommended COV-02 disposition:** (1) plant B as the ambiguity control; (2) plant A as the
incomplete-coverage control; (3) for path-level ambiguity, assert the *invariant* over the whole
inventory — that `productionPaths().map(pairForPath)` yields 204 pairs with no repeated source path
and no repeated test path, and that `testToSource(sourceToTest(p)) === p` for every row — rather than
inventing a case that cannot occur. Say in the plan that the case is unreachable and that the
invariant is what is being asserted instead.

### MEASURED: a limit on `assertCompleteCoverage`'s injectable root

`selectedProjectRoot` is threaded **only** to `isTypeOnlyModule` (line 212). LCOV `SF` resolution goes
through the module-level `projectRoot` (line 209). So a control cannot plant a real coverage record
under a fixture tree:

```
$ assertCompleteCoverage("extensions/…/domain/answer.ts", "<lcov with SF:/tmp/fixture-root/…>", "/tmp/fixture-root")
THREW: Path is outside the project: /tmp/fixture-root/extensions/pi-claude-marketplace/domain/answer.ts
```

This is why the existing control at `scripts/test-coverage-direct.negative.mjs:19-25` can only pass
`""` (zero records) and can only reach the `found 0` arm. The workaround, measured above: point the
synthetic `SF` at a **real in-repo absolute path** and omit the fixture root entirely. No script
change is needed to gain controls for both verdicts.

`pairForPath` is **not exported** (`grep -n "^export " scripts/test-coverage-direct.mjs` returns only
`assertCompleteCoverage` at line 207). Any COV-02 check that drives the mapping needs a new export.
`checkCorrespondingTests` **is** exported with a `projectRoot` parameter that is honoured throughout
— measured, since the proxy plant above drove a fixture tree successfully.

### How the two existing controls plant — the pattern to extend

`scripts/check-corresponding-tests.negative.mjs`: `mkdtemp`s a fixture root, writes a real
`extensions/pi-claude-marketplace/domain/answer.ts` + `tests/domain/answer.test.ts` + a
fake/contract/fake-test quartet, asserts `checkCorrespondingTests(fixtureRoot)` returns `[]`, then
**mutates one thing at a time** — unlink the contract, unlink the fake, rewrite the fake-test without
the contract import, add a look-alike `answer-fakes.test.ts`, unlink the test, rewrite the test
without its pair import, add a stray `extra.test.ts` — asserting the exact violation array after
each and restoring before the next. Seven planted violations, `rm -rf` in `finally`.

`scripts/test-coverage-direct.negative.mjs`: writes a type-only source and asserts `"type-only"`,
rewrites it as a runtime module and asserts the `found 0` throw. Two plants.

Each new check gets the same shape: build the clean state, assert clean, plant one violation, assert
the exact verdict, restore.

---

## E. The `tests/helpers/` dissolution (D-117-04, D-117-05)

### MEASURED: consumer counts — CONFIRMED

`grep -rl "helpers/<name>.ts" tests/`, discounting each module's own self-reference:

| Support module | Consumers | Distribution | CONTEXT said |
|---|---|---|---|
| `source-scan.ts` | **5** | all in `tests/architecture/` | 5 ✓ |
| `ipc-child.ts` | **2** | `tests/integration/{concurrent-install-child,load-reconcile-race-child}.ts` | 2 ✓ |
| `marketplace-seed.ts` | **15** | 13 `tests/edge/handlers/`, 2 `tests/orchestrators/plugin/` | 15 ✓ |
| `notification-boundary.ts` | **26** | 22 `tests/edge/`, 4 `tests/orchestrators/` | 26 ✓ |

The 4 cross-tier `notification-boundary` consumers are `tests/orchestrators/import/execute.test.ts`,
`tests/orchestrators/plugin/bootstrap.test.ts`, `tests/orchestrators/reconcile/apply.test.ts`,
`tests/orchestrators/reconcile/pending.test.ts`. The 2 cross-tier `marketplace-seed` consumers are
`tests/orchestrators/plugin/info.test.ts` and `tests/orchestrators/plugin/list.test.ts`. Those are the
6 D-117-05 names.

### CORRECTION: the edit surface is 50 lines across 35 files, not "~48 across ~45"

```
$ grep -rn 'from "[^"]*helpers/(source-scan|ipc-child|marketplace-seed|notification-boundary)\.ts"' tests/ | grep -v '^tests/helpers/' | wc -l
50
$ ... | grep -l ... | wc -l
35
```

Fewer files than CONTEXT estimated, slightly more lines — several suites import both the value and the
type in two separate statements (the house `import-x/order` rule puts `import type` last).

Three edit sites beyond the imports, all found by grep:

- `tests/helpers/source-scan.test.ts:55` holds the literal **data** string `"tests/helpers/source-scan.ts"`
  as the path a WR-06 case inspects. It must become `"tests/architecture/source-scan.ts"` or the case
  breaks.
- `tests/helpers/{ipc-child,marketplace-seed,source-scan}.ts` and `source-scan.test.ts` open with a
  `// tests/helpers/<name>.ts` path header comment; `source-scan.ts:20` and `:30` also name the
  directory in prose.
- `tests/helpers/notification-boundary.ts` carries no self-path reference.

`tests/helpers/` contains exactly **5 files**: the four support modules plus `source-scan.test.ts`.

### MEASURED: the gate does not see non-`.test.ts` files under `tests/`

`filesBelow(projectRoot, testRoot, (name) => name.endsWith(".test.ts"))`
(`scripts/check-corresponding-tests.mjs:111`) enumerates **only** `*.test.ts`. Support modules under
any root — corresponding or not — are invisible to the correspondence gate. The precedent already in
the tree is `tests/fixtures/bad-imports/edge-imports-bridges.ts`, which produces no violation.

So placing `source-scan.ts` beside `source-scan.test.ts` under `tests/architecture/`, and
`notification-boundary.ts` / `marketplace-seed.ts` under corresponding roots, creates **no new
violation**. `tests/edge/notification-boundary.ts` is likewise unreachable through
`pairForPath` — it hits `Not a corresponding test path` and fails closed (§D).

### MEASURED: the child-process spawn is unaffected

```
tests/integration/concurrent-install.test.ts:52  const CHILD_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "concurrent-install-child.ts");
tests/integration/concurrent-install.test.ts:125 const first = fork(CHILD_PATH, [], { … });
```

`fork` receives an absolute path composed from the **parent test's** directory. Both children already
live in `tests/integration/`; moving `ipc-child.ts` into that same directory changes only the
children's own relative import (`../helpers/ipc-child.ts` → `./ipc-child.ts`). The spawn target does
not move. `tests/integration/load-reconcile-race.test.ts:59` has the identical shape.

### MEASURED: `tests/helpers` appears in no config file

`grep -n helpers` over `eslint.config.js`, `.fallowrc.json`, `tsconfig.json`, `.prettierignore`,
`.pre-commit-config.yaml` and `.github/workflows/` → **no match** in any of them. The two hits in
`sonar-project.properties` (lines 22, 29) are unrelated prose about production helper functions.

The only two references are the npm globs, `package.json:82` (`test`) and `:91`
(`test:coverage:unit`).

**MEASURED: removing `helpers` from the globs is a no-op after the move.**

```
with helpers: 249    without: 248
helpers tests: [ 'tests/helpers/source-scan.test.ts' ]
```

`source-scan.test.ts` moves to `tests/architecture/`, which is already in the glob, so the matched set
is unchanged at 249 before and after. Remove the token for honesty, as CONTEXT says, not for function.

### Rename sequencing — the handoff's rule applies, but narrowly

116-17's finding is that git detects a rename by **content similarity**, so a move-plus-total-rewrite
of the same file registers as delete + create. That rule bites on the *moved file*, not on its
consumers. Concretely:

| Move | Moved-file content change | Rename detected? | Commit shape |
|---|---|---|---|
| `tests/bridges/integration-materialization-gate.test.ts` → `tests/architecture/` | **none** — its imports are already `../../extensions/…` and it has no path header | yes, 100% | pure `git mv` |
| `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` → `tests/architecture/` | 2 import lines, `../../../` → `../../` | yes | pure `git mv` + depth fix |
| `tests/helpers/source-scan.ts` → `tests/architecture/` | header comment lines only | yes | move commit may include the 5 consumer import rewrites — the moved file is what similarity is measured on |
| `tests/helpers/source-scan.test.ts` → `tests/architecture/` | header + the line-55 data string | yes | same commit as its module |
| `tests/helpers/ipc-child.ts` → `tests/integration/` | header only | yes | move + 2 consumer rewrites |
| `tests/helpers/notification-boundary.ts` → `tests/edge/` | none | yes | move + 26 consumer rewrites |
| `tests/helpers/marketplace-seed.ts` → `tests/edge/handlers/` | header only | yes | move + 15 consumer rewrites |
| `index-smoke.test.ts` + `index-handler.test.ts` → `tests/index.test.ts` | total rewrite, 2-into-1 | **no, and it cannot be** | delete + create; do not promise a rename |
| `device-flow-prompt.test.ts` → into `tests/domain/github-auth.test.ts` | merged into an existing 1198-line file | **no** | delete + edit |
| `cascade.test.ts` → into `tests/orchestrators/marketplace/shared.test.ts` | merged into an existing 1220-line file | **no** | delete + edit |

**Sequencing rule for the plan:** each helper gets its own commit containing the `git mv` **and** the
consumer import rewrites, because a commit that moves the module without fixing its consumers does not
typecheck, and DEL-01's one-concern rule is satisfied by "relocate one support module". The moved file
itself stays content-stable, so `git log --follow` works. Do **not** write an acceptance criterion
demanding a rename for the three folds — they are merges and can never show one.

### Fold targets confirmed by import

- `tests/shared/device-flow-prompt.test.ts:30` imports `initiateDeviceFlow` from
  `domain/github-auth.ts` — the fold target is correct. It also imports `../domain/device-flow-fake.ts`
  and `../platform/credential-ops-fake.ts`; after the fold those become `./device-flow-fake.ts` and
  `../platform/credential-ops-fake.ts`.
- `tests/orchestrators/marketplace/cascade.test.ts:7` imports `cascadeUnstagePlugin` from
  `orchestrators/marketplace/shared.ts` — target correct, and the fold is same-directory so its
  `../../../` depths are unchanged.
- Neither fold target imports anything from `tests/helpers/`, so W2 and W3 are file-disjoint.

---

## F. The all-pair run (D-117-10)

### `runPair`, read in full

`scripts/test-coverage-direct.mjs:237-265`. Per pair it `mkdtemp`s a coverage directory under
`os.tmpdir()`, `spawnSync`s `process.execPath` with
`--test --experimental-test-coverage --test-reporter=spec --test-reporter-destination=stdout
--test-reporter=lcov --test-reporter-destination=<tmp>/pair.lcov <testPath>`, `cwd: projectRoot`,
`stdio: "inherit"`; throws `Focused test failed: <testPath>` on a non-zero status; otherwise calls
`assertCompleteCoverage` and writes one line to stdout; `rm`s the temp dir in `finally`.
`main()` loops `for (const pair of pairs) await runPair(pair)` — strictly sequential.

### MEASURED: per-pair wall clock, five named pairs

Timed individually with `date +%s.%N` around each invocation, on **Node v26.7.0** (no Node 24 is
installed — see the baseline section).

| Pair | Test suite size | Wall | Verdict printed |
|---|---:|---:|---|
| `shared/extension-version.ts` | 15 lines | **0.9 s** | `Direct coverage passed: … (branches …)` |
| `shared/types.ts` | 22 lines | **1.0 s** | `… (branches 1/1, …)` |
| `edge/types.ts` | — | **1.1 s** | `… (type-only)` |
| `edge/register.ts` | ~1000 lines | **4.3 s** | `… (branches 15/15, …)` |
| `orchestrators/plugin/install.ts` | 9417 lines | **9.0 s** | `Direct coverage passed: …` |

All five exited 0.

### MEASURED: a 21-pair evenly-spaced sample

Every 10th module from the sorted 204-row list, run sequentially through the real script:

```
sample wall total: 51.846093667s for 21 pairs
```

**2.47 s per pair on this sample.** Multiplying that out gives roughly **8-9 minutes for 204 pairs**
— but that number is **ARITHMETIC, and therefore a guess**, exactly the class of number this milestone
has already been burned by. It is fit for sizing a task timeout and for nothing else. D-117-10 still
requires the real full-run figure read from the runner, and the largest suites (install 9.0 s,
update/reinstall/info are all 7-8k lines) are over-represented in the tail and under-represented in
this sample.

### INFERRED: what concurrency would change

Searched for shared state that would break under parallel `runPair` invocations:

- **Coverage artifacts** — already per-pair `mkdtemp`. No collision.
- **Fixed ports** — `grep -rn "listen(\|localhost:[0-9]\|127\.0\.0\.1:[0-9]" tests/` returns exactly
  one hit, `tests/orchestrators/marketplace/add.test.ts:995`, and it binds a **Unix domain socket**
  whose path is `mp-add-sock-${process.pid}.sock` under `os.tmpdir()`. PID-scoped, and each pair is
  its own process. Safe.
- **`process.chdir`** — three unit suites (`tests/edge/register.test.ts`,
  `tests/orchestrators/plugin/update.test.ts`, plus `tests/e2e/_helpers.ts`), each into a per-case
  `mkdtemp` with the restore registered in `t.after`. Per-process, so safe across pairs.
- **`HOME` / `PI_CODING_AGENT_DIR`** — 53 test files set them; all per-process.
- **Writes into the repository** — `grep -rn "writeFile(\s*path.join(REPO_ROOT"` returns nothing;
  the `process.cwd()` reads that remain are read-only path composition.
- **Lockfiles** — `proper-lockfile` guards a scope root, and every scope root in the unit suite is a
  temporary directory.

**No shared-state hazard was found.** The one genuine cost of parallelism is `stdio: "inherit"`:
the spec reporter's output and the per-pair verdict lines would interleave, so a human could no
longer read the result off the terminal — which is the same reason the result wants an artifact.

### The RESULT artifact (COV-05)

Today nothing is retained: `runPair` writes `Direct coverage passed: <source> (<summary>)` to stdout
and the temp lcov is deleted in `finally`. A terminal scrollback is not a result.

**Recommendation:** have `runPair` append one record per pair to a report file (an NDJSON or JSON
array at a path given by a `--report <path>` argument), each carrying `{ sourcePath, testPath,
verdict, branches, functions, lines }`, and have `--all` assert at the end that the report holds
exactly `productionPaths().length` records, that every production path appears exactly once, and that
no record is missing. That converts "one complete direct coverage record for every inventory row" from
a claim about a terminal into a checkable file, and it survives the interleaving that concurrency
would introduce. It also gives D-117-11's control something to plant against: a deliberately failing
pair must still appear as a failure in the report when runs interleave.

### MEASURED: the type-only tension is real, and it is 7 rows

Driving `assertCompleteCoverage(<path>, "", <repoRoot>)` over all 204 production modules and
collecting the ones that return `"type-only"`:

```
total modules: 204
type-only: 7
   extensions/pi-claude-marketplace/bridges/agents/types.ts
   extensions/pi-claude-marketplace/bridges/commands/types.ts
   extensions/pi-claude-marketplace/bridges/mcp/types.ts
   extensions/pi-claude-marketplace/bridges/skills/types.ts
   extensions/pi-claude-marketplace/edge/types.ts
   extensions/pi-claude-marketplace/orchestrators/import/types.ts
   extensions/pi-claude-marketplace/orchestrators/types.ts
```

These 7 take the `records.length === 0 && isTypeOnlyModule(...)` escape at
`scripts/test-coverage-direct.mjs:212` and pass **unconditionally, with no coverage record at all**.

**The tension, stated rather than resolved.** COV-05 wants "one complete direct coverage record for
each of the 204 inventory rows". Seven rows can never have one: a module that emits no JavaScript
produces no LCOV record, so there is nothing to be complete. `runPair` does still print one *verdict*
line per row (`Direct coverage passed: <path> (type-only)`), so a *record of the verdict* covers all
204 while a *coverage record* covers only 197. Two readings are defensible:

1. Read COV-05 as "one verdict record per row", and mark the 7 with an explicit `type-only` verdict in
   the artifact. Nothing is hidden; the artifact says exactly what was and was not measured.
2. Read it as "one numeric coverage record per row", in which case 7 rows fail it by construction and
   the requirement needs an amendment naming the type-only escape.

Reading 1 is the only one achievable without a production change, and it matches
`.claude/rules/typescript-unit-testing.md`'s own "Type-only modules" pattern ("the paired test module
holds `satisfies` checks and `@ts-expect-error` negatives; `node --test` runs it with zero cases. Do
not add runtime assertions to make it look active"). But this is an operator-visible reading of a
named requirement, not a researcher's call — the plan should state which reading it takes and why.

### NEW FINDING, not in the question set: `npm test` cannot see `tests/index.test.ts`

The `test` and `test:coverage:unit` globs are
`tests/{architecture,bridges,domain,edge,helpers,orchestrators,persistence,platform,shared,transaction}/**/*.test.ts`.
Every alternative names a **directory**; the root-level file matches none of them.

```
$ node -e 'const {globSync}=require("node:fs"); ...'
matched count: 249
includes tests/index.test.ts: false
tests/**/*.test.ts count: 269 includes root: true
```

Confirmed positively as well: with the prototype owner in place, the two-pattern form runs it.

```
$ node --test "tests/index.test.ts" "tests/{architecture,…,transaction}/**/*.test.ts" --test-name-pattern="clean discover"
✔ clean discover (141.979828ms)
ℹ tests 5150   ℹ suites 295   ℹ pass 5150   ℹ fail 0
```

5150 = the 5141 baseline plus the prototype's 9 cases. Note `suites` stayed at **295**: node's
`ℹ suites` counts `describe` blocks, not files, so a root owner with no `describe` leaves it
unchanged. Do not expect the suite count to move as evidence the file ran.

**Consequence if unfixed:** `test:coverage:direct:all` enumerates from `productionPaths()`, not from
the glob, so it would run `tests/index.test.ts` and report the pair green — while `npm test` never
executed a single one of its cases. The pair would be "proven" by a gate the suite does not run.
**Both globs must be amended, and the SUITE-05 evidence must be a suite total that visibly rises.**

---

## G. Ordering and blast radius

`workflow.use_worktrees` is `false` (confirmed in `.planning/config.json`), so executors run
sequentially on the shared tree regardless. The question is not parallelism but **which gate is
measured against which tree**.

### Measured file sets per workstream

| Workstream | Files it touches |
|---|---|
| **W1 entry pair** | new `tests/index.test.ts`; delete `tests/shared/index-smoke.test.ts`, `tests/edge/index-handler.test.ts`; **`package.json` lines 82 + 91** (add the root pattern) |
| **W2 orphan folds** | `tests/domain/github-auth.test.ts` ← `tests/shared/device-flow-prompt.test.ts`; `tests/orchestrators/marketplace/shared.test.ts` ← `.../cascade.test.ts`; move `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` and `tests/bridges/integration-materialization-gate.test.ts` → `tests/architecture/` |
| **W2b gate strengthening** | `scripts/check-corresponding-tests.mjs`, `scripts/test-coverage-direct.mjs`, both `.negative.mjs`, `package.json` scripts if a new verb is added |
| **W3 helpers dissolution** | 4 module moves + `tests/helpers/source-scan.test.ts`; **50 import lines in 35 test files**; **`package.json` lines 82 + 91** (drop the `helpers` token) |
| **W4 all-pair proof** | `scripts/test-coverage-direct.mjs` (report artifact), possibly `package.json` |
| **W5 inventory sweep** | `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/REQUIREMENTS.md`, `.planning/WINDOWS.md` |

### Conflicts, measured

1. **`package.json` lines 82 and 91 are touched by W1 and W3, and possibly W4.** Three workstreams
   editing the same two strings. Sequence them; never dispatch two of them back to back without
   re-reading the file. This is the one hard collision.
2. **`tests/helpers/source-scan.test.ts` is claimed by BOTH D-117-01 (orphan resolution) and D-117-04
   (dissolution).** It is one move that satisfies both. Assign it to **W3** and say so in W2's plan,
   or the two plans will each try to move it.
3. **`scripts/test-coverage-direct.mjs` is touched by W2b and W4.** Sequence, or merge them into one
   plan.
4. **W2's fold targets import nothing from `tests/helpers/`** (measured, §E) — so W2 and W3 do not
   collide on any test file.

### Recommended order

```
W3  helpers dissolution        (largest blast radius; no gate depends on it; leaves 8 violations at 8)
W2  orphan folds               (drops the gate from 8 violations to 1: missing-test: tests/index.test.ts)
W1  entry pair + glob amendment (drops the gate to 0; suite total must visibly rise)
W2b gate strengthening + controls (a check added before the tree is clean has no clean tree to pass on)
W4  all-pair run + result artifact (measures the FINAL tree; must be after every move)
W5  inventory sweep            (D-117-12: last, records measured outcomes)
```

The binding constraints behind that order:

- **W4 must be last of the code workstreams.** It measures all 204 pairs; running it against a
  half-moved tree measures a tree that will not exist.
- **W2b must follow W1, W2 and W3.** A new check's acceptance is "the clean tree passes and the
  planted violation fails". Until the entry pair and the seven orphans land, there is no clean tree,
  and a new check that fires on genuine leftovers is indistinguishable from one that fires on its
  plant.
- **W3 before W2** only because `source-scan.test.ts` belongs to it; the reverse works if that one
  move is reassigned.
- **W5 last** is locked by CONTEXT.

**INFERRED, not measured:** whether the correspondence gate stays green *between* W3's per-helper
commits. It should — the gate enumerates only `.test.ts` files and `source-scan.test.ts` moves from
one non-corresponding-or-orphan position to a non-corresponding root — but the plan should run
`node scripts/check-corresponding-tests.mjs` after each move rather than assume it.

---

## H. The phase-boundary sweep (D-117-12)

### The pair total — exact locations

| File | Line | Current text | Target |
|---|---:|---|---|
| `.planning/ROADMAP.md` | 7 | `**Pair plans:** 204` | unchanged (already correct) |
| `.planning/ROADMAP.md` | 623 | <code>&#124; **Total** &#124; **203/204** &#124; **In Progress** &#124; **-** &#124;</code> | `**204/204**`, `**Complete**`, the date |
| `.planning/STATE.md` | 40 | `pair total swept to 203/204, and the ROADMAP row marked Complete.` | phase-116 history — leave as history, or restate |
| `.planning/STATE.md` | 81 | `Two hundred three of 204 source-test pairs are complete. The one that remains is the extension` | `Two hundred four of 204 …` |
| `.planning/STATE.md` | 450 | `- **One pair remains**: … the pair total is 203/204.` | rewrite for the closed state |

### ROADMAP's two independently-drifting plan counts for phase 117

Confirmed — the handoff's warning holds, and both sites exist:

| Line | Form | Current |
|---:|---|---|
| **579** | prose | `**Plans**: 1 plan` |
| **622** | progress-table row | <code>&#124; 117. Extension Entry and Final Gate &#124; 0/1 &#124; Not started &#124; - &#124;</code> |

A third, related site: line 583 is the single `- [ ] **117-01** …` plan checkbox, and line 43 is the
`- [ ] **Phase 117: …**` milestone checkbox. If the phase ships more than one plan (it will — four
workstreams under DEL-01's one-concern rule), **all four** of 579, 583, 622 and 43 need editing, not
just the two the handoff names. `roadmap.update-plan-progress` mangled ROADMAP.md 31 times out of 31
in phase 116; hand-edit and diff.

### REQUIREMENTS.md — CORRECTED, and the correction is large

`MOD-07` needs **two** edits:

- line **122**: `- [ ] **MOD-07**: All 14 plugin and marketplace lifecycle pairs complete the pair` → `- [x]`
- line **500**: <code>&#124; MOD-07 &#124; Phase 114 &#124; Pending &#124;</code> → `Complete`

`MOD-10` likewise needs two, at line **129** (`- [ ]`) and line **503** (`Pending`), both closing at
the end of this phase.

**The per-pair Status column: CONTEXT and STATE both understated it.** Parsed every
`| P<phase>-<nn> | … | <Status> |` row:

| Phase | Rows | Line range | Status |
|---:|---:|---|---|
| 108 | 23 | 193-215 | all `Complete` |
| 109 | 19 | 221-239 | all `Complete` |
| **110** | **12** | **245-256** | **all `Open`** |
| **111** | **31** | **262-292** | **all `Open`** |
| **112** | **31** | **298-328** | **all `Open`** |
| **113** | **35** | **334-368** | **all `Open`** |
| **114** | **14** | **374-387** | **all `Open`** |
| 115 | 8 | 393-400 | all `Complete` |
| **116** | **30** | **406-435** | **all `Open`** |
| 117 | 1 | 441 | `Open` (legitimately, until this phase closes) |
| | **204** | | **154 `Open`, 50 `Complete`** |

Two corrections:

1. **The count is 153 rows to flip, not "roughly 115".** Phases 110-114 alone are **123** rows.
2. **Phase 116's 30 rows are ALSO `Open`,** despite phase 116 being closed and verified and its
   `MOD-09` marked `Complete` at line 502. CONTEXT's "the per-pair Status column lapsed at Phase 110,
   roughly 115 rows across Phases 110-114" misses this block entirely. Phase 115's 8 rows *were*
   swept, so the drift is not a contiguous run — it is 110, 111, 112, 113, 114 and 116.

Adding P117-01 at close makes it **154** rows.

### WINDOWS.md — CORRECTED

CONTEXT says "23 ledger entries, 14 open". Measured:

```
table rows: 22
Counter({'open': 17, 'fixed': 5})
ids: 1..22
```

Frontmatter agrees: `open_count: 17, waived_count: 0, fixed_count: 5, total_count: 22`. STATE.md's
"17 open Broken Windows entries" is the correct figure. Entries 15-19, 21 and 22 are the seven
D-116-01a coverage shortfalls; entry 20 is the stale `edge/register.ts` comment pair.

**This pair adds no new ledger entry** — `index.ts` reaches 14/14 branches, so there is no shortfall
to pin (§B).

---

## Findings that are production defects, reported not fixed (D-117-13)

None new. The three D-117-13 items stand exactly as CONTEXT records them (WINDOWS entry 20's two
`edge/register.ts` comments; the two stale `edge/completions/data.ts` comments; `BOOLEAN_FLAGS`
re-exported for `tests/architecture/flag-catalog-drift.test.ts`).

One documentation drift found in passing, outside `extensions/`:
`.planning/codebase/ARCHITECTURE.md` describes "the aggregate `bridges/index.ts`" under **bridges/**.
`find extensions/pi-claude-marketplace -name index.ts` shows it does not exist. Recorded, not fixed —
it is a planning doc, not production, and it is not in this phase's scope.

## Project Constraints (from CLAUDE.md)

- Read a file before editing it; trace callers before modifying a function.
- Never commit to `main`; feature work on `features/*`.
- Conventional Commits; title 5-72 chars; body lines ≤ 80.
- Run `pre-commit run --files <changed files>` **before** `git commit`; never `--no-verify`; never
  `--amend` to recover from a hook failure.
- Never rebase, never rewrite history.
- Markdown is formatted by `mdformat`/`markdownlint`, **not** prettier — `format:check` covers only
  `js,json,ts`.
- Merge PRs with `--squash`.
- Version bumps touch `package.json`, `package-lock.json`, `EXTENSION_VERSION`,
  `sonar-project.properties` and `CHANGELOG.md`.
- All disk mutations atomic; no production `process.stdout`/`process.stderr` writes; all user-visible
  output through `ctx.ui.notify` via `shared/notify.ts`.
- `npm run check` must stay green — but see the standing debt: it never reaches the tests in this
  checkout. Run the six gates separately.
- Comments cite decision/requirement IDs, never phase/plan/wave/milestone process references
  (`.claude/rules/typescript-comments.md`).

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`.

### Test Framework

| Property | Value |
|---|---|
| Framework | `node:test` (Node's built-in runner) + `strong-mock` + `node:assert/strict` |
| Config file | none — configured entirely through `package.json` scripts |
| Quick run command | `node --test <one test path>` (0.9-9.0 s per pair, measured) |
| Focused pair command | `node scripts/test-coverage-direct.mjs <source-or-test-path>` |
| Full suite command | `npm test` (5141/5141, 295 suites, measured) |

### Phase Requirements → Test Map

| Req | Behavior | Test type | Automated command | Exists? |
|---|---|---|---|---|
| MOD-10 / OWN-01 | `index.ts` has a mirrored owner with 100% direct coverage | unit | `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/index.ts` | ❌ Wave 0 — proven achievable, prototype preserved in scratchpad |
| OWN-02..06 | correspondence gate reports 204 mirrored pairs, no orphans | structural | `npm run test:corresponding` | ✅ (8 violations today) |
| OWN-02 (proxy) | an owner importing a barrel that re-exports its pair is rejected | structural | new check + `npm run test:corresponding:negative` | ❌ Wave 0 |
| COV-02 | the focused command fails closed on missing / ambiguous / unmapped | structural | `npm run test:coverage:direct:negative` | partial — `found 0` only; `found 2` and `Incomplete direct coverage` have no control |
| COV-04 | every new check has a planting negative control | structural | both `*.negative.mjs` | ✅ pattern exists, must be extended |
| COV-05 | one complete direct coverage record per inventory row | structural | `npm run test:coverage:direct:all` + a report artifact | ❌ Wave 0 — nothing is retained today |
| SUITE-02 | no generic test-support directory | structural | `test ! -d tests/helpers` + `npm test` | ❌ Wave 0 |
| SUITE-05 | the repository gates pass | suite | six commands run separately (see Baseline) | ✅ all green today |
| SUITE-06 | inventory is truthful | doc | manual diff of ROADMAP/STATE/REQUIREMENTS/WINDOWS | ❌ Wave 0 (§H) |

### Sampling Rate

- **Per task commit:** `node scripts/test-coverage-direct.mjs <the pair touched>` plus
  `node scripts/check-corresponding-tests.mjs`.
- **Per wave merge:** `npm run typecheck`, `npm run lint`, `npm run fallow`, `npm test`,
  `npm run test:integration` — each separately, each exit code read.
- **Phase gate:** the six above plus `npm run test:coverage:direct:all` and both negative controls.

### Wave 0 Gaps

- [ ] `tests/index.test.ts` — covers MOD-10, OWN-01, and the entry pair's 14 branches.
- [ ] `package.json` glob amendment — without it the owner never runs in `npm test`.
- [ ] Negative controls for `Expected one LCOV record … found 2` and for
      `Incomplete direct coverage for …`.
- [ ] Negative control for the new proxy/barrel check.
- [ ] The `--all` report artifact and its completeness assertion.

## Security Domain

`security_enforcement` is not disabled in `.planning/config.json`, so the section is included; the
honest content is short.

| ASVS category | Applies | Note |
|---|---|---|
| V2 Authentication | no | no auth surface is added or changed |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | no | no new input surface; the phase adds tests and structural checks only |
| V6 Cryptography | no | — |

No external package is installed by this phase, so the **Package Legitimacy Audit is not applicable**
— `npm install` is not run and no dependency is added. Every tool used (`node:test`, `strong-mock`,
`typescript`) is already a committed devDependency.

Two hermeticity properties the plan should preserve rather than introduce:

- Every new case runs offline. `tests/edge/register.test.ts`'s `installNetworkTrap(t)` (a
  `t.mock.method(https, "request", …)` fail-fast) is the house device; the entry owner should install
  it and assert no count unless a reachable input is measured (see §A).
- Every new case owns a temporary `HOME`, clears `PI_CODING_AGENT_DIR`, and restores through
  `t.after`. The entry owner must do this: `registerHooksBridge` reads the user scope off disk at
  factory time, so a non-hermetic run would touch the operator's real `~/.pi`.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | The prototype's 9 cases are the right decomposition for the final owner | A, B | Low — the *coverage* is proven; the case split is Claude's discretion per CONTEXT, and the plan may reorganise freely as long as the pair still reports 14/14 |
| A2 | The git door in `index.ts`'s import graph is not opened by any input through the captured handler | A | Medium — **NOT MEASURED.** If a reconcile fixture does reach `https.request`, an offline case gains a positive control rather than staying a labelled regression guard. Ask both SC-4 questions before writing the case |
| A3 | The correspondence gate stays green between W3's per-helper commits | G | Low — mechanically it must, but run the gate after each move rather than assume |
| A4 | Reading COV-05 as "one verdict record per row" (so the 7 type-only rows pass) is acceptable | F | Medium — this is an operator-visible reading of a named requirement; the plan should state its reading explicitly |
| A5 | The 204-pair run takes 8-9 minutes | F | Low for sizing, **high if quoted as a result** — the figure is arithmetic from a 21-pair sample. D-117-10 requires the real measurement |

## Open Questions (RESOLVED)

All four were closed by operator decision after research, and each names the plan that implements it.

1. **Which Node runs the all-pair proof?** — RESOLVED by D-117-19: no local install; the run is
   labelled with the runtime it actually used and CI carries the Node 24 wording. Implemented by
   `117-11` Task 2.
   - What we know: no Node 24 is installed; PATH node is v26.7.0, `/usr/bin/node` is v22.22.2; CI
     pins 24 in four places.
   - What is unclear: whether installing Node 24 locally is in bounds.
   - Recommendation: either install one for the measurement, or record the runtime actually used and
     say plainly that success criterion 3's "Node 24" was met in CI rather than locally. Do not label
     a v26 measurement "the Node 24 all-pair result".

2. **How is COV-05 read for the 7 type-only rows?** — RESOLVED by D-117-20: 197 numeric records
   plus 7 named type-only verdicts, no pragma and no weakening of the other 197. Implemented by
   `117-11` Tasks 1 and 2. See A4 and §F. Operator-visible; state the
   reading in the plan.

3. **Does concurrency get added to the all-pair run?** — DELIBERATELY OPEN pending measurement,
   per D-117-11, and closed out by `117-11` Task 2, which records the decision against the number
   the run itself printed. The default disposition is not to add it. D-117-11 accepts either answer but not an
   unmeasured one. §F found no shared-state hazard; the only cost is interleaved output, which the
   report artifact removes. Decide after the real timing.

4. **Where does the ambiguity check live?** — RESOLVED by D-117-21: no path-level ambiguity check
   is added. The barrel rejection gains a `proxy-owned` label in `117-09`, the two reachable
   coverage verdicts gain planting controls in `117-10`, and the mapping-injectivity invariant
   lands with the all-pair run in `117-11`. §D shows path-level ambiguity is unreachable and
   record-level ambiguity is already guarded but uncontrolled. Adding a *new* unreachable check would
   be a gate that cannot fire — the exact defect `import-x/no-cycle` shipped as. Prefer controls for
   the two existing verdicts plus a mapping-injectivity invariant.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Node | everything | ✓ | v26.7.0 (PATH), v22.22.2 (`/usr/bin`) | — |
| **Node 24** | success criterion 3 | **✗** | — | measure on v26 and label it, or install |
| npm | scripts | ✓ | 11.19.0 | — |
| `typescript` | both gate scripts | ✓ | devDependency, resolves from repo root only | run gate scripts with the repo as cwd |
| `strong-mock` | every owner | ✓ | devDependency | — |
| `pre-commit` | commit hooks | ✓ (framework installed; **git hooks are NOT installed in this checkout**) | — | run `pre-commit run --files <paths>` by hand; a clean `git commit` is not evidence |
| `git` | moves, `--follow` | ✓ | — | — |
| network | none | n/a | — | every case is offline by construction |

**Missing with no fallback:** none.
**Missing with fallback:** Node 24 — measure on the available runtime and label the discrepancy.

## Sources

### Primary (HIGH confidence — measured in this tree, 2026-09-03)

- `extensions/pi-claude-marketplace/index.ts`, `bridges/hooks/event-router.ts`,
  `orchestrators/plugin-path.ts`, `persistence/locations.ts`, `shared/session-env.ts`,
  `shared/notify.ts:4113-4135`, `platform/pi-api.ts` — read directly.
- `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:863-947` — the
  `ExtensionAPI` overload set and `ExtensionHandler`.
- `scripts/check-corresponding-tests.mjs`, `scripts/test-coverage-direct.mjs` and both
  `.negative.mjs` — read in full and driven with planted fixtures.
- `tests/shared/index-smoke.test.ts`, `tests/edge/index-handler.test.ts`,
  `tests/edge/register.test.ts`, `tests/helpers/notification-boundary.ts`,
  `tests/edge/handlers/plugin/enable-disable.test.ts:190-209` — read.
- A prototype owner written, run, planted twice and reverted; preserved at
  `/tmp/claude-1000/-home-acolomba-pi-claude-marketplace-unit-test-refactor/4b89fec9-1c29-4a8a-88ef-c3496865a093/scratchpad/proto-index.test.ts.txt`.

### Secondary (MEDIUM — project documents, cross-checked against the tree)

- `.planning/phases/116-edge-surface/.continue-here.md` — the findings table; three of its entries
  were re-measured here (branch instability, probe counts, the `unbound-method` claim) and one
  premise it fed forward turned out narrower than stated.
- `.claude/rules/typescript-unit-testing.md`, `.claude/rules/typescript-comments.md`,
  `.planning/codebase/{STACK,CONVENTIONS,ARCHITECTURE}.md`, `CLAUDE.md`.
- `.planning/{ROADMAP,STATE,REQUIREMENTS,WINDOWS}.md` — parsed programmatically, not skimmed.

### Tertiary (LOW)

- None. No web source was consulted; every claim here is either a command output from this tree or is
  labelled INFERRED / NOT MEASURED.

## Metadata

**Confidence breakdown:**

- Entry-pair feasibility and coverage: **HIGH** — 14/14 reached, two plants RED, both reverted.
- Gate behaviour (A, D): **HIGH** — planted against the gate's own `--root` seam.
- Helpers dissolution mechanics (E): **HIGH** — counts and config references measured; one CONTEXT
  estimate corrected.
- All-pair timing (F): **MEDIUM** — 21-pair sample measured; the 204-pair figure is arithmetic and
  labelled as such.
- Ordering (G): **MEDIUM** — file sets measured, the ordering itself is inferred from them.
- Sweep locations (H): **HIGH** — line numbers parsed, two CONTEXT figures corrected.

**Research date:** 2026-09-03
**Valid until:** the next commit that touches `package.json` scripts, either gate script, or
`extensions/pi-claude-marketplace/index.ts`. The measurements are tied to HEAD `5f799a32`.

## RESEARCH COMPLETE
