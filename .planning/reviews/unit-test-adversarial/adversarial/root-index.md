# Extension entry point — adversarial re-review

**Scope:** `tests/index.test.ts` and `extensions/pi-claude-marketplace/index.ts`, mutation-tested stage by stage against the four collaborators the handler calls (`bridges/hooks/event-router.ts`, `orchestrators/reconcile/apply.ts`, `orchestrators/plugin-path.ts`, `orchestrators/discover.ts`) plus the boundary helper `tests/edge/notification-boundary.ts` and the sibling owner `tests/edge/register.test.ts`.
**First-pass file:** `unit-test-findings/root-index.md`
**Clean files attacked:** 2 (`tests/index.test.ts`, declared clean outright; `extensions/pi-claude-marketplace/index.ts`, declared clean apart from three warnings)
**Existing findings graded:** 3

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 4 |
| New WARNING (missed by first pass) | 4 |
| Existing CONFIRMED | 1 |
| Existing UNDERSTATED | 2 |
| Existing OVERSTATED | 0 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 0 |

The first pass's characterisation of the *technique* holds — the `Proxy`-driven
refusal cases, the exact-name `strong-mock` registration expectations, and the
whole-string notification comparisons are all genuine and all catch the
mutations they claim to. What the first pass missed is that the suite's
coverage is **one-sided**: every case exercises the project scope and the
prompt half of the answer, and the four stages of the handler are proven only
in their single-fault form. Four mutations survive all thirteen cases, and one
of them is an NFR-2 hole in production that the test file's own header comment
records as if it were a design decision.

## New findings — from the clean lists

### `tests/index.test.ts`

- **[BLOCKER] `skillPaths` can be hardcoded empty and every case stays green** — `line 134` of `extensions/pi-claude-marketplace/index.ts`, cases at `tests/index.test.ts:559` and `:578`
  Mutating `index.ts:134` to `skillPaths: []` (dropping `[...discovered.skillPaths]`)
  leaves all thirteen cases green. No case anywhere in this file seeds a skill:
  `seedPrompt` (`tests/index.test.ts:470`) is the only resource seeder, and
  `skillPaths` appears in exactly three places — `EMPTY_DISCOVERY` (line 109),
  the `expectedDiscovery` literal at line 566, and a `resources.skills: []`
  field inside the state fixture (line 500) — always as the empty array.
  Skills are the extension's primary materialized artifact, so the half of the
  handler's return value that matters most is asserted only against `[]`.
  **Fix:** add a `seedSkill(root, name)` helper beside `seedPrompt` that writes
  `<root>/.pi/pi-claude-marketplace/resources/skills/<name>/SKILL.md` (the shape
  `readSkillPaths` at `orchestrators/discover.ts:74-98` accepts: a real
  directory, non-dotted, containing a regular non-symlink `SKILL.md`), and
  extend the case at line 559 to seed one skill and one prompt, asserting
  `{ skillPaths: [skillDir], promptPaths: [promptPath] }` as one
  `deepStrictEqual`.

- **[BLOCKER] Swapping the two `locationsFor` bundles inverts a pinned contract undetected** — `lines 129-132` of `extensions/pi-claude-marketplace/index.ts`
  Mutating the call to
  `aggregateDiscoveredResources(locationsFor("project", event.cwd), locationsFor("user", homedir()))`
  leaves all thirteen cases green. `aggregateDiscoveredResources` iterates
  `[userLocations, projectLocations]` in argument order
  (`orchestrators/discover.ts:25`), and
  `tests/orchestrators/discover.test.ts:80` pins that order as a contract
  ("keeps scope order and sorts within each resource directory") — but it calls
  the function *directly*, so it cannot see an inversion at the only production
  call site. `tests/index.test.ts` is the only file that could, and no case ever
  puts a resource in the user scope, so the ordering is unobservable here.
  This is the "gate that does not gate" shape: a contract that is pinned next
  door and unenforced where it is actually wired.
  **Fix:** in the case at line 559, point the user scope at a temp dir of the
  case's own by setting `process.env.PI_CODING_AGENT_DIR` to a fourth `mkdtemp`
  inside `createHermeticScope` instead of deleting it (`getAgentDir()` reads it
  first — the technique is already used at
  `tests/orchestrators/discover.test.ts:29`), seed one prompt under each scope,
  and assert `promptPaths` as `[userPrompt, projectPrompt]` in that exact order
  with `deepStrictEqual`. The `delete` at line 223 becomes an assignment; the
  restore already registered at line 212 covers it.

- **[BLOCKER] The multi-skip branch of the plugin PATH warning loop has no case, and the inner catch that guards it can be deleted undetected** — `lines 112-124` of `extensions/pi-claude-marketplace/index.ts`, cases at `tests/index.test.ts:614` and `:788`
  Two independent mutations survive every case:
  (a) replacing the `for (const skip of pathResult.skipped)` loop with a
  single `pathResult.skipped[0]` notification, and (b) deleting the inner
  `try/catch` at lines 118-123 so a notify failure falls through to the outer
  `catch (err)` at line 125. `recomputePluginPath` returns up to **two**
  skipped scopes (`orchestrators/plugin-path.ts:94-104` pushes one per scope),
  but the only two cases that reach the loop —
  `seedUnreadableState(scope.cwd)` at lines 617 and 791 — corrupt the project
  scope alone, so `skipped.length` is always exactly 1. Under (b) the
  observable difference is only which `hookDebugLog` line is written, and no
  case asserts those (see the next finding). Both mutations are precisely the
  double-fault the loop and the inner catch exist for: one corrupt scope
  silently swallowing the other's warning.
  **Fix:** add one case that seeds an unreadable `state.json` in **both**
  scopes — the project one via the existing `seedUnreadableState(scope.cwd)`,
  the user one by writing the same bytes to
  `<agentDir>/pi-claude-marketplace/state.json` (reachable once
  `PI_CODING_AGENT_DIR` points at a case-owned temp dir, per the previous
  finding) — and assert `notifications` as a two-element array in user-then-
  project order, matching D-90-04's stated `user before project` ordering at
  `orchestrators/plugin-path.ts:76`. Then add a second case that pairs the same
  double corruption with `refuseEveryNotification`, asserting both warnings
  were *attempted*, which is what pins the inner catch.

- **[WARNING] The three `hookDebugLog` calls are executed but never observed** — `lines 122`, `126`, `152` of `extensions/pi-claude-marketplace/index.ts`
  Deleting any or all of them, changing their tag from `"env"` to the default
  `"hooks"`, or rewording their messages leaves all thirteen cases green. Lines
  126 and 152 are the *only* trace a failed PATH recompute or a failed session-
  env apply leaves anywhere — both catches are otherwise silent — and line 122
  exists, by its own comment, "so the skipped-scope warning does not vanish
  without a trace." The seam is observable: `hookDebugLog` writes to
  `console.error` when `process.env.PI_CLAUDE_MARKETPLACE_DEBUG === "1"`
  (`shared/debug-log.ts:22-26`).
  **Fix:** in the three cases that reach these catches —
  `tests/index.test.ts:715` (recompute refused), `:788` (warning notify
  refused), `:833` (session id refused) — set
  `process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1"` in the arrange phase (it is
  already saved and restored if added to the `tracked` list at line 202),
  install `const debugLines = t.mock.method(console, "error", ...)`, and assert
  the recorded arguments as a whole array against hand-written strings, e.g.
  `["[env] session env apply skipped: session id refused"]`.

- **[WARNING] The `EdgeDeps` the entry point wires into the command are never asserted** — `lines 156-159` of `extensions/pi-claude-marketplace/index.ts`
  Mutating `pluginUpdate: updateSinglePlugin` to any other function of the same
  type, or `gitOps: DEFAULT_GIT_OPS` to any other `GitOps`, leaves every case in
  this file green and every case in `tests/edge/register.test.ts` green too —
  that file builds its own deps in `registerCommandUnderTest()`
  (`tests/edge/register.test.ts:236`). The deps object never appears in the
  captured `CommandRegistration`, which carries only `description`, `handler`,
  and `getArgumentCompletions` (`edge/register.ts:105-113`), so nothing in the
  unit suite can see it. This is the one part of the entry point's promise the
  suite structurally cannot hold, and it should be recorded rather than left
  implicit.
  **Fix:** either state the gap in the file header beside the existing NFR-5
  note (honest, zero cost), or move the production deps literal into
  `edge/register.ts` — give `registerClaudePluginCommand(pi, deps = { gitOps:
  DEFAULT_GIT_OPS, pluginUpdate: updateSinglePlugin })` a default so the wiring
  lands in the module `tests/edge/register.test.ts` already owns. Do not add a
  test-only export to `index.ts`.

- **[WARNING] The `errorMessage` routing at the reconcile catch is unproven** — `line 96` of `extensions/pi-claude-marketplace/index.ts`
  Mutating `errorMessage(err)` to `(err as Error).message` leaves every case
  green: the only thing that throws out of `applyReconcile` in this suite is the
  `Proxy` at `tests/index.test.ts:393`, which throws a real `Error`. The comment
  at `index.ts:93-95` names a specific contract — a non-`Error` throw must
  render its stringified form instead of `reconcile aborted: undefined` — and
  no case exercises it. `shared/errors.test.ts` owns `errorMessage` itself, but
  the *routing* through it is index.ts's and is untested.
  **Fix:** parameterise `eventRefusingCwdRead` with the value to throw (default
  `new Error(...)`, keeping the existing cases unchanged) and add one case that
  refuses `CWD_READ_RECONCILE` with a bare string, asserting the notification is
  `{ message: "reconcile aborted: read refused", severity: "error" }`.

### `extensions/pi-claude-marketplace/index.ts`

- **[BLOCKER] `aggregateDiscoveredResources` is awaited outside every try, so a real failure propagates past `resources_discover`** — `lines 129-132`
  This is the only `await` in the handler with no containment, and it throws by
  design: `orchestrators/discover.ts:44-46` raises
  `AggregateResourcesDiscoverError` for any `readdir`/`lstat` failure whose code
  is not `ENOENT`/`ENOTDIR` — `EACCES` on a mode-000 `resources/skills`
  directory being the ordinary case. `tests/orchestrators/discover.test.ts:207`
  already proves the throw. That contradicts the handler's own comment at
  `index.ts:80-83` ("a catastrophic throw NEVER blocks Pi load … and
  `aggregateDiscoveredResources` still runs") and `.planning/codebase/ARCHITECTURE.md`
  ("`resources_discover` and `session_start` handlers in `index.ts` wrap **every**
  awaited call in try/catch"). It is not a recorded exemption either: the threat
  model that produced this handler
  (`.planning/milestones/v1.12-phases/55-…/55-02-PLAN.md:296`, T-55-02-03)
  mitigates only `applyReconcile`'s throw and asserts the aggregate "is invoked
  unconditionally after"; the aggregate's own throw was never considered.
  Whether Pi's loader tolerates a rejected `resources_discover` I did not verify
  — but the whole point of the surrounding four try/catch blocks is that the
  handler does not depend on that answer.
  **Fix:** wrap lines 129-132 in the same shape as the reconcile stage — a
  `try` around the `await`, a `catch` that emits one raw
  `makeRawNotifyFn(ctx)` line inside its own `try/catch`, and a fallback
  `return { skillPaths: [], promptPaths: [] }`. Then add the case that pins it:
  `chmod 0o000` on the seeded `resources/skills` directory, registered for
  restore with `t.after()`, asserting the empty answer plus the emitted line.
  If the decision is instead that this stage is deliberately uncontained,
  say so at line 129 and delete the contradicting sentence at lines 80-83.

- **[WARNING] `bridges/hooks/event-router.ts:740` cites a test file that does not exist** — `event-router.ts:740`
  The comment pins the WR-05 "no files on a clean reconcile" invariant to
  `tests/edge/index-handler.test.ts`. `ls tests/edge/` shows no such file, and
  it never existed — `.planning/…/55-02-PLAN.md:242` planned it, the coverage
  landed in `tests/index.test.ts:578` instead, and the reference was never
  updated. A second comment in the same file, `event-router.ts:591`, writes the
  factory-time call as `registerHooksBridge(pi, { cwd: homedir() })` — without
  the `ctx` the signature actually demands, which independently corroborates the
  first-pass finding below.
  **Fix:** retarget line 740 at `tests/index.test.ts:578` ("leaves both scope
  roots untouched … (WR-05)"). The file is owned by the bridges-hooks area;
  flagged here because attacking this area is what exposed it.

## Export ownership census

`extensions/pi-claude-marketplace/index.ts` has exactly one export.

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `index.ts` | `default claudeMarketplaceExtension` — factory registration | `tests/index.test.ts:542` (`registers the slash command and the two read-only tools…`), via `loadExtension` at `:235` | owned |
| `index.ts` | `default` — installed `resources_discover` listener | `tests/index.test.ts:559`, `:578`, `:594`, `:614`, `:645`, `:681`, `:715`, `:739`, `:767`, `:788` | owned |
| `index.ts` | `default` — installed `session_start` listener | `tests/index.test.ts:815`, `:833`, `:857` | owned |
| `index.ts` | `default` — `EdgeDeps` passed to `registerClaudePluginCommand` | — | **NO CASE** (see the WARNING above; no seam exists) |
| `index.ts` | `default` — `{ ctx, cwd }` passed to `registerHooksBridge` | — | **incidental** (the call is required for the factory to resolve; neither argument's value is asserted, and both are inert in this suite — `cwd` is a no-op for the user scope per `persistence/locations.ts:145`, `ctx` is never read per the grading below) |

The registration *content* — command description, `getArgumentCompletions`
behaviour, both tool definitions — is correctly delegated to
`tests/edge/register.test.ts:304`, `:335`, `:548`. The weak
`assert.deepStrictEqual(typeof command.handler, "function")` at
`tests/index.test.ts:555` is **not** a coverage gap: this file's promise is
that the entry point registers under the right names, and the boundary's
exact-argument expectations carry that. No finding.

## Branch census

`index.ts` branch by branch:

| Branch | Status |
| --- | --- |
| `catch` on `hydrateProjectScopeForCwd` (71-76) | covered — `tests/index.test.ts:645` |
| `catch` on `applyReconcile` (86-101) | covered — `:681`, `:739` |
| inner `catch` on the last-ditch notify (97-100) | covered — `:767` |
| `for` loop over `pathResult.skipped`, 0 iterations | covered — `:578`, `:594` |
| `for` loop over `pathResult.skipped`, 1 iteration | covered — `:614`, `:788` |
| `for` loop over `pathResult.skipped`, **2 iterations** | **reachable and untested** — both scopes corrupt; see the BLOCKER above |
| inner `catch` on the warning notify (118-123) | covered — `:788` — but see the BLOCKER: the catch is deletable without failing it |
| outer `catch` on `recomputePluginPath` (125-127) | covered — `:715` |
| `catch` on `applySessionEnv` — throwing reader (151-153) | covered — `:833` |
| `catch` on `applySessionEnv` — absent `sessionManager` (151-153) | covered — `:857` (the two inputs share one catch, so only a named case separates them; the suite does this correctly) |
| `aggregateDiscoveredResources` throwing (129-132) | **reachable and untested** — no branch exists to cover; that absence is the production BLOCKER above |
| `severity === undefined` arm inside `makeRawNotifyFn` (`shared/notify.ts:4211`) | **unreachable from this module** — both call sites (96, 114) pass an explicit severity. Owned by `tests/shared/notify.test.ts`; not a finding here |

No compiler-forced unreachable branches (D-116-01a) in this module.

## Grading of first-pass findings

### `extensions/pi-claude-marketplace/index.ts`

- **UNDERSTATED** — *Placeholder `ExtensionContext` cast is a symptom of an
  over-broad consumer parameter* (`line 61`). The diagnosis is exactly right and
  I confirmed it independently: `registerHooksBridge` passes `opts` straight to
  `hydrateCacheFromDisk` (`event-router.ts:729`), which reads only `opts.cwd`
  (`:446`), and `grep -rn "opts\.ctx" extensions/pi-claude-marketplace/bridges/hooks/`
  returns nothing. What the first pass records as one local WARNING is a
  **cluster**: the same forced cast has propagated to five more call sites —
  `tests/integration/hooks-dispatch-end-to-end.test.ts:206`, `:287`, `:347`,
  `hooks-additionalcontext-end-to-end.test.ts:196`, `:312`,
  `hooks-cross-scope-reconcile.test.ts:161`, `hooks-spawn-end-to-end.test.ts:198` —
  and `event-router.ts:591`'s own doc comment already writes the call in the
  narrowed form (`registerHooksBridge(pi, { cwd: homedir() })`) that the
  signature does not permit. Severity should rise to BLOCKER and the ticket
  should be filed against `event-router.ts:707`, not against `index.ts`.

- **UNDERSTATED** — *Double-cast on the `resources_discover` registration has no
  comment* (`lines 30-36`). The first pass filed this "needs verification"; the
  verification largely lands. The peer overload exists
  (`node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:869`),
  `ExtensionHandler` is `(event: E, ctx: ExtensionContext) => Promise<R | void> | R | void`
  (`:863`), and the local `ExtensionContext` is a **direct re-export of the
  peer's** (`platform/pi-api.ts:40-58`) — so the contravariance objection that
  would normally justify such a cast does not apply, and the local
  `ResourcesDiscoverEvent`/`ResourcesDiscoverResult` (`pi-api.ts:90-100`) are
  byte-for-byte structural duplicates of the peer's (`types.d.ts:404-414`).
  Beyond documentation, the cast has a behavioural cost the first pass does not
  name: `platform/pi-api.ts` exists so "peer-version bumps are auditable"
  (`pi-api.ts:3-6`), and an `as unknown as` on the single most important
  registration is exactly the construct that would absorb a peer signature
  change silently. Under the style skill's own BLOCKER rule — "an assertion
  without a valid reason" — this is a BLOCKER, not a WARNING. Note the planning
  record agrees the cast should already be gone:
  `.planning/…/55-02-PLAN.md:236` instructs "drop the `unknown` cast; restore
  the natural `pi.on("resources_discover", async (event, ctx) => ...)`
  signature," and `55-VERIFICATION.md:42` marks it VERIFIED — against a handler
  that still carries it.

- **CONFIRMED** — *Entry-point doc comment states only "why," never "what"*
  (`lines 23-28`). Accurate as recorded; the comment opens on DISP-01
  await-ordering and never says what the factory registers. WARNING is the right
  severity (style skill, "Method descriptions begin with a third-person verb
  phrase"). One addition for whoever writes the sentence: the factory registers
  the hooks bridge, `resources_discover`, `session_start`, the `/claude:plugin`
  command **and** the two MCP tools — and the discover handler runs four stages
  in a fixed order, which is the fact `tests/index.test.ts:111-128` depends on
  and which no comment on the production side states.

## Still clean after attack

`tests/index.test.ts` catches every one of these, which is why the four
surviving mutations above are worth acting on rather than the file being
rewritten:

- **Dropping the `await` at `index.ts:62`.** Caught. `registerHooksBridge`
  awaits `hydrateCacheFromDisk` (`event-router.ts:729`) before its first
  `pi.on` (`:784`), so un-awaited the factory's own `session_start` becomes
  registration call #1 and is consumed by the *first* declared expectation
  ("bridge session start", `tests/index.test.ts:240`). `sessionEnvListener.value`
  stays `undefined` and `loadExtension` throws at `:352`. The header's claim at
  lines 13-17 that the second expectation is load-bearing is true.
- **Reordering any two of the four stages.** Caught by the ordinal constants
  plus `reads: CWD_READS_PER_DISCOVER`. Moving the aggregate above the recompute
  turns the `:715` case's refusal into an uncontained throw; swapping hydrate and
  reconcile turns the `:645` case's expected cascade into the raw
  `reconcile aborted` line.
- **Deleting the `hydrateProjectScopeForCwd` call, or passing it `homedir()`.**
  Caught — `readCount()` falls to 3 against an expected 4.
- **Removing any try/catch except the inner warning catch.** Caught by `:645`,
  `:681`, `:715`, `:767`, `:833`, `:857` respectively.
- **Changing one word, one glyph, one cause line, or the severity of any
  emitted message.** Caught — every notification is compared as a whole
  `Notification` object against a hand-written string
  (`RECONCILE_CASCADE_FOR_UNREADABLE_STATE`, line 131;
  `RECONCILE_CASCADE_FOR_INVALID_CONFIG`, line 139).
- **Emitting a notification twice, or emitting one at all where none is
  promised.** Caught by `createNotificationBoundary`'s exact `times(emissions)`
  on both `ctx.ui` and `ui.notify`; an `emissions` of 0 states no expectation at
  all, so the first unwanted emission fails where it happens
  (`tests/edge/notification-boundary.ts:18-23`).
- **Reading `process.cwd()` instead of `event.cwd`.** Caught — the process is
  moved into a third temp root (`:200`, `:224`) and the `:559` case seeds a
  decoy prompt there.
- **Adding `themePaths` to the returned object, or swapping `skillPaths` with
  `promptPaths`.** Caught by the `deepStrictEqual` against
  `expectedDiscovery` at `:574` (differing key sets fail; the swap moves the
  seeded prompt into the wrong field).
- **Registering under a wrong event/command/tool name, adding a registration, or
  dropping one.** Caught — every name is a hand-written exact argument and
  `verifyBoundary()` runs in every case's assert phase.

Two mutations I tried are **equivalent, not gaps**, and should not be chased:
`locationsFor("user", event.cwd)` at line 130 (the user scope discards its `cwd`
argument outright, `persistence/locations.ts:145`), and `cwd: process.cwd()` at
line 62 (both roots are pristine temp dirs, so the factory-time project hydrate
is a no-op either way).

## Not covered

- Did not run `tsc`, `eslint`, `fallow`, `node --test`, or coverage tooling, per
  the brief's read-only rule. The claim that the `as unknown as` at
  `index.ts:30-36` is removable rests on reading the peer's `.d.ts` and the
  local re-export list, not on a compile.
- Whether Pi's loader survives a rejected `resources_discover` promise is
  unverified; the production BLOCKER above is argued from this repo's own stated
  containment doctrine, not from observed host behaviour.
- `tests/edge/notification-boundary.ts` was read to model the boundary's
  `times()` semantics but is not graded here — it belongs to the `tests/edge/`
  assignment.
- `tests/integration/**` is outside the sweep glob; the six `placeholderCtx`
  sites there are cited as evidence of blast radius only, not reviewed.

## Meta-findings impact

### New cross-cutting evidence

**One-sided scope coverage is a defect class, not a local gap.** Three of my four
new BLOCKERs share one root cause: `tests/index.test.ts` seeds the *project*
scope and never the *user* scope, because `createHermeticScope` deletes
`PI_CODING_AGENT_DIR` (`tests/index.test.ts:223`) rather than pointing it at a
case-owned temp dir the way `tests/orchestrators/discover.test.ts:29` does. Every
two-scope behaviour in the module then collapses to a one-scope behaviour:
argument order becomes unobservable, the skipped-scope loop never iterates twice,
and the `user before project` orderings that D-90-04
(`orchestrators/plugin-path.ts:76`) and `discover.test.ts:80` both pin have no
enforcement at their production call sites. **Any module that reads both scopes
should be checked for the same shape** — the obvious candidates are
`orchestrators/plugin-path.ts`, `orchestrators/discover.ts`,
`orchestrators/reconcile/*`, and `bridges/hooks/event-router.ts`
(`hydrateCacheFromDisk` loops over `SCOPES` identically). The tell is a test
helper that *clears* `PI_CODING_AGENT_DIR` for hermeticity instead of
*redirecting* it; clearing is hermetic but makes the user scope unseedable.

**A contract pinned next door is not a contract enforced at the call site.** The
scope-order finding is a fresh instance of the "gates that do not gate" cluster
in a place nobody looked: not an architecture test that greps the wrong file, but
a *unit* test that pins the right contract on the wrong side of the seam.
`discover.test.ts:80` calls `aggregateDiscoveredResources(user, project)`
directly, so it can never see `index.ts` calling it `(project, user)`. Worth a
sweep: wherever a helper's test states an argument-order or precedence contract,
check that some case exercises the production call site's argument order too.

**A gap can be recorded in a header comment and thereby made invisible.**
`tests/index.test.ts:121-123` states plainly that the fourth `event.cwd` read has
no case "because the resource aggregation is the one stage outside a try, so
refusing it is a throw out of the handler rather than an NFR-2 containment." That
sentence reads as a design fact; it is a description of an unfixed hole. The
first-pass reviewer read that header and passed the file clean. **When an
adversarial pass meets a header comment explaining why something is not tested,
that comment is a finding candidate, not an exemption.**

### Corrections to META-FINDINGS.md

- **"Patterns to propagate" table, row *Planting a real violation to prove
  containment* → `tests/index.test.ts` "plants throwing collaborators for every
  NFR-2 route, including the notify-call-itself-throws case."** The technique is
  a model implementation and should stay in the table, but **"every NFR-2 route"
  is wrong**. `index.ts:129-132` awaits `aggregateDiscoveredResources` outside
  every try; the route exists, it throws by design
  (`orchestrators/discover.ts:44-46`, proven at
  `tests/orchestrators/discover.test.ts:207`), and no case plants it. Suggested
  wording: "plants throwing collaborators for the three contained NFR-2 routes;
  the fourth stage is uncontained in production and unplanted."
- **Master tally.** `root-index.md` is listed as 0 BLOCKER / 3 WARNING. After
  this pass the area carries **4 new BLOCKER + 4 new WARNING**, and two of the
  three existing WARNINGs should rise to BLOCKER. The refreshed audit should use
  roughly 6 BLOCKER / 5 WARNING for this area, not 0/3.
- **"Ranked by leverage" item 1** says `index.ts` "carries two `as unknown as`
  casts, one traced to a sibling's over-broad parameter it never reads." Both are
  worse than that reads. The `placeholderCtx` cast has propagated to **six more
  call sites** across four integration test files, and `event-router.ts:591`'s
  doc comment already writes the narrowed call form, so the narrowing is
  uncontroversial and overdue. The second cast is not a documentation gap at all
  — it defeats the peer-drift auditability that `platform/pi-api.ts` exists to
  provide, and the planning record
  (`.planning/…/55-02-PLAN.md:236`, `55-VERIFICATION.md:42`) shows it was
  supposed to be deleted and was marked VERIFIED as deleted while still present.
  That last point is worth its own line in "Gates that do not gate": a
  VERIFICATION document asserting a cast was dropped, against a file that kept
  it.

### Confirmations

- **"Clean verdicts are not reliable" (Provenance).** Confirmed hard here. The
  first pass rated this "one of the strongest suites in the sweep" and recorded
  zero test findings; four mutations survive all thirteen cases, one of them
  sitting on an uncontained `await` in production. The strength of the technique
  is what made the coverage gap invisible — the file *looks* exhaustive because
  its refusal machinery is genuinely excellent.
- **"Ranked by leverage" item 1, over-wide context parameters.** Confirmed from a
  second angle: `registerHooksBridge`'s `opts.ctx` is grep-provably never read
  anywhere under `bridges/hooks/`, and the cost is now six forced
  `as unknown as ExtensionContext` casts across five files rather than the one
  the first pass saw.
- **"The dominant shape: sibling drift."** Confirmed with a new instance and a
  named target: `tests/index.test.ts:223` clears `PI_CODING_AGENT_DIR` where the
  sibling `tests/orchestrators/discover.test.ts:29` redirects it, and that single
  divergence is what makes three of this area's four BLOCKERs possible. The fix
  is propagation from a known-good sibling, exactly as the meta-file predicts.
- **"Doc comments that lie" (Step 4 of the adversarial brief).** Confirmed twice
  in one file: `bridges/hooks/event-router.ts:740` cites
  `tests/edge/index-handler.test.ts`, which does not exist and never did, and
  `:591` writes a call signature the function does not accept.
