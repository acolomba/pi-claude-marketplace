# Meta-findings — unit test and production sweep

Cross-cutting conclusions from the 45-area first pass **and the 58-report
adversarial second pass that attacked it**. Nothing here comes from a single
reviewer. Each area file reports what one agent saw in one slice; this file
reports what only shows up when you read all of them together, plus the
decisions the fixing pass cannot make for itself.

Read this before the per-area files. Read `_AUDIT.md` for the first pass's
finding-by-finding tally (now superseded in every area — see "Master tally").
The adversarial reports live in `adversarial/`.

## Provenance

- **Scope:** the unit suite only —
  `tests/{architecture,bridges,domain,edge,orchestrators,persistence,platform,shared,transaction}/**/*.test.ts`
  plus `tests/index.test.ts`, and every production module they pair with.
  ~158,000 lines of test across 285 files (261 of which import
  `node:assert/strict`; **zero** import plain `node:assert`).
- **Not swept:** `tests/integration/`, `tests/e2e/`, `tests/live-uat/`. They fall
  outside the `npm test` glob. References to them below are incidental.
- **Method, first pass:** 45 parallel reviewers, one per directory level,
  splitting further where single files exceeded ~5,000 lines. Diagnostic only —
  no file modified, no test run.
- **Method, adversarial pass:** 58 reviewers over the same partition (large files
  split by line range), each briefed to attack the first pass's clean verdicts,
  severities, and causal claims, and to prefer **mutation testing and executed
  probes over reading**. Also diagnostic only.
- **Both passes loaded** the `typescript-unit-testing-review` and
  `typescript-google-style-review` skills.

## Changed since the first pass

The adversarial pass re-reviewed the sweep with instructions to attack its clean
verdicts, its severities, and its causal claims. Aggregate:

- **58 adversarial reports**, ~55 of them carrying recorded finding counts.
- **+221 new BLOCKER and ~645 new WARNING** findings, on top of the first pass's
  ~76/373.
- **~526 first-pass findings re-graded**: ~364 CONFIRMED, ~83 UNDERSTATED,
  ~63 OVERSTATED, 16 REFUTED.
- **First-pass clean verdicts were overturned in the large majority of areas.**
  Representative rates: 5 of 7 production files in `architecture-hooks-gates`;
  6 of 8 gate files in `architecture-boundary-gates`; 7 of 9 in `bridges-skills`;
  6 of 8 in `edge-root`; all 4 test modules plus 2 of 8 production modules in
  `persistence`; 3 of 4 test files and 2 of 7 production files in
  `bridges-hooks-exec-protocol`; both clean-listed files in
  `bridges-hooks-adapters-state` and `bridges-hooks-dispatch` yielded a BLOCKER
  apiece.
- **Four areas the first pass recorded as "0 BLOCKER" or "the strongest tier"
  were overturned outright**: `bridges-skills`, `domain-core`, `shared-concerns`,
  `orchestrators-root`, `root-index`, `bridges-hooks-payloads`.
- **The first pass's severity signal is roughly anti-correlated with evidence
  quality.** In `bridges-agents` both recorded BLOCKERs rested on mechanisms the
  source refutes while every WARNING held. In `orchestrators-reconcile-notify`
  both BLOCKERs were wrong or half-wrong. In `orchestrators-plugin-reinstall` two
  of three BLOCKERs were attributed to a symbol (`reinstallSummary`) that does
  not exist.
- **Thirteen production bugs** were found that the first pass missed, on top of
  the `mcp.json` crash it did find. They are listed first, below.

The lesson for planning is not "the first pass was bad" — its *recorded* findings
held up at ~69%. It is that **a clean verdict, a summary sentence, an inline
"otherwise this file is strong", and an unnamed case inside a reviewed file are
all the same unfalsified negative**, and that is where every high-severity
finding of the second pass came from.

## Production bugs found by this sweep

The production half of the sweep paid for itself several times over. **Fix these
ahead of any test work.** Every entry below was traced to source; the ones marked
"verified" were re-checked during consolidation.

| # | Bug | Site | Effect |
| --- | --- | --- | --- |
| 1 | `mcp.json` `mcpServers: null` / bare string unguarded | `bridges/mcp/stage.ts:93-100`, `unstage.ts:74-82` | `Object.entries(null)` throws; a string is silently enumerated per character, merged, and atomically written with `malformed: false`. Confirmed twice by execution. |
| 2 | Uncontained NFR-2 route in `resources_discover` | `index.ts:129-132` (**verified**) | `aggregateDiscoveredResources` is awaited **outside** every `try`. It throws by design (`orchestrators/discover.ts:44-46`, proven throwable at `tests/orchestrators/discover.test.ts:207`). A throw escapes the Pi lifecycle handler. The threat model considered only `applyReconcile`; the test-file header records the gap as if it were a design decision. |
| 3 | `narrowDisableFailure` missing the `AgentsUnstageFailureError` arm | `orchestrators/plugin/enable-disable.messaging.ts:201` (**verified**) | Disable renders `{unreadable}` where uninstall renders `{source mismatch}` for the same cause. The function's own doc comment states the drift-together invariant it breaks. No test feeds it that error. |
| 4 | Lock-held uninstall renders `{unreadable}` | `orchestrators/plugin/uninstall.ts:168` | `StateLockHeldError` carries no `.code`, so `narrowCascadeFailure` falls through to the permissive tail. `lock held` is in the closed `REASONS` set; `enable-disable.ts:872`, `marketplace/autoupdate.ts:177` and `reconcile/apply-outcomes.ts:378,424` all do it right. |
| 5 | Closed-set reasons classified by `String.includes` over user-controlled text | `orchestrators/plugin/update.ts:675-687` (`reasonsFromTypedError`), `:2899-2924` (`narrowDirectFailReason`) | Proven poisoning: an MCP server named `rollback-server` flips a collision to `{rollback partial}`. Directly violates CONVENTIONS.md's "never narrow on message substring matching". `narrowDirectFailReason`'s own comment says it mirrors `marketplace/update.ts:553-580`, so the class likely spans marketplace and reinstall. |
| 6 | Staging-cleanup leak descriptors discarded | `orchestrators/plugin/update.ts:1400,1404,1413,1414,2100` | `abortPrepared{Skills,Commands}` and `commitPreparedCommands` return `Promise<string \| undefined>`; `update.ts` awaits and drops it at five sites while `install.ts:990` and `reinstall.ts:1515,1519` capture it via `pushLeak`. Compiles clean, no lint fires. Test fixes for the commands-leak branch must be sequenced **after** this. |
| 7 | `writePidTable` takes its defensive copy after the first `await` | `bridges/hooks/async-rewake/pid-table.ts` | The doc-comment aliasing guarantee does not exist — the only caller-mutation pattern a caller can express slips through. Fix: construct the payload above the first `await`. |
| 8 | Unguarded object-literal lookup returns `Object.prototype` members | `domain/components/hook-tool-names.ts:133` (**verified**), `domain/components/hooks/matcher.ts:50` | `(TABLE as Record<string, string>)[name] ?? name` — `"toString"` returns a native function, violating the declared `string` return. The matcher half is author-reachable: `"matcher": "constructor"` in a plugin's `hooks.json` yields `{kind:"tool-set"}` instead of `{kind:"unmapped"}`, so the plugin **installs silently with a dead hook** instead of tripping the D-58-06 unsupported trap. The fix is already in-repo at `hooks.ts:129` (`Object.hasOwn`). Detection: `grep 'as Record<string, ' extensions/`. |
| 9 | `compileIfPredicate` does not reject empty-inner rules, and `Bash()` fails the wrong way | `bridges/hooks/if-field/index.ts` | Doc says it rejects; it does not. `Bash()` is fail-**closed** for plain commands (the hook is silently disabled) and fail-**open** for interpolated ones — the inverse of D-61-02. Verified by execution. |
| 10 | Agents bridge advertises multi-directory discovery that its only feed discards | `bridges/agents/*` vs `pickAgentsSourceDir` | The bridge takes `agentsDirs: readonly string[]`, dedups across directories, emits a warning, and has two paired cases; the orchestrator passes only `componentPaths.agents[0]`. A plugin declaring `"agents": ["custom"]` plus a conventional `agents/` silently installs one of the two. |
| 11 | `void`-switch over a closed union with no default | `orchestrators/import/execute.ts:592-658` (`reconcileExistingMarketplace`) | A fourth `SamePlannedSourceResult` verdict compiles clean and makes a marketplace **vanish** (headerless rows the doc calls unreachable). The fix pattern is 40 lines below in the same file (`:669-683`, `:713-722`). |
| 12 | CR-01 declared-key ≠ manifest-name dead-ends at the plugin tier (**P-1, needs fixture confirmation**) | `orchestrators/reconcile/{plan,apply}.ts` | Code-traced, not executed. The mismatch converges at the marketplace tier and dead-ends at the plugin tier: `"fmt@my-alias"` fails `marketplace not added` on every reload; `"fmt@tools"` is classified dangling on every reload. **Confirm with a fixture before fixing** — no fixture anywhere makes the two names differ, which is why it survived. Three viable fixes with different semantics; see Operator decisions. |
| 13 | Stale peer-dep belief frozen five layers deep | `bridges/hooks/payloads/{pre,post}-compact.ts` + `domain/components/hook-events.ts` + an architecture lock | Doc comments claim "Pi does not expose a trigger source"; the installed peer dep declares `reason: "manual" \| "threshold" \| "overflow"`. Tests **pin the stale behavior** (set `reason:"manual"`, assert `trigger:"auto"`), `NON_TOOL_EVENT_CLOSED_SETS` gives both events empty admissible-matcher sets so a plugin's `trigger:` matcher is refused as unsupportable, and `tests/architecture/hooks-supportability.test.ts` locks the empty sets. Each layer cites the layer below as authority. |
| 14 | `transaction/rollback.ts` has zero production callers | `transaction/rollback.ts` (**verified**) | 75 lines, two exports, one 174-line test, green `fallow dead-code`. `install.ts:1252-1271` re-implements two of its three rules inline and **drops the third** (ES-4 `Error.cause` wrap, still Pending in the v1.3 requirements). Three doc comments name callers that do not exist (`phase-ledger.ts:143`, `errors.ts:295`, `rollback.ts:23-26`). |

Two more that are lower severity but are genuine cross-machine or diagnostic
defects: `bridges/skills/discover.ts` sorts `readdir` output with a
locale-dependent comparator (non-deterministic across machines), and
`serializeBoundedObject` bounds only the **first** oversized field in insertion
order, so a payload translator's object-literal field order decides which fields
a hook handler receives on an oversized payload (`spawn-helpers.ts:66-67`).

## NFR-10 containment — the run's highest-severity cluster

**Escalate this section to the operator before anything else in the test
backlog.** Six independent areas found containment holes, and the first pass's
falsified-hypothesis note ("NFR-10 path containment is thoroughly tested against
real filesystems including symlink escapes") is what kept them invisible. That
note is **true of the `assertPathInside` chokepoint and false of everything that
does not reach it** — and, as of this pass, partly false of the chokepoint too.

| Instance | Site | State |
| --- | --- | --- |
| **`assertPathInside` is bypassable** | `shared/path-safety.ts:47,90` (**verified**: both predicates key on `path.relative(parent, child)`) | `path.relative` collapses `..` **lexically** while the OS resolves it **physically**. Demonstrated on a real filesystem: a write to `<parent>/a/../b` with `a` symlinked lands **outside** `parent` and the check passes. Latent — all ~30 callers pre-resolve by convention, which nothing enforces. No case anywhere plants a `..` segment. This is the chokepoint the other five findings rely on. |
| **`info.ts` re-admits what the resolver refused** | `orchestrators/plugin/info.ts:1308-1327` (`deriveLenientComponentPaths`) → `discoverComponentNames` | Re-derives absolute and `..`-escaping component paths that `resolver.ts:978-997` rejected, then `readdir`s them with **no** `assertPathInside`. The only read site in the file that skips the chokepoint. Pointing at `/etc` renders that directory. The one-line fix changes the bytes pinned at `info.test.ts:6402` — **operator call**. |
| **All 8 commands-staging guards are zero-cased** | `bridges/commands/stage.ts:195,207,210,308,382,389,391,397` | Deleting every `assertPathInside` / `assertSafeName` in the file leaves the suite green; 6 of the 8 label strings have zero grep hits anywhere in `tests/`. The sibling form exists at `skills/stage.test.ts:688`, `agents/stage.test.ts:1923`, and this bridge's own `unstage.test.ts:119-204`. |
| **Skills symlink hardening uncovered** | `bridges/skills/stage.ts` `cp(..., { dereference: false, verbatimSymlinks: true })` | Carries requirement ID T-03-15 and a written threat model; no test touches it, no symlinked `SKILL.md` is ever planted, and the `assertSafeName`/`assertPathInside` guards in commit/replace are uncovered (`unstage.test.ts:113` proves the identical guard). Invisible to an assertion-quality review because the assertions present are excellent — the defect is a missing **input**. |
| **`CLAUDE_ENV_FILE` containment check is deletable** | `bridges/hooks/hook-env.ts:74` | Deleting it leaves three cases green, and `sessionId` interpolates into the path unvalidated. |
| **`pluginDataDir`'s marketplace-arg `assertSafeName` is never exercised** | `persistence/locations.ts:261` | The guard whose own comment explains why `assertPathInside` is insufficient here. Five sibling path getters have it; this one's is unexercised, and `locations.ts:261` is also the only getter of six missing the assertion its siblings carry. |

Two adjacent facts belong with this cluster. First, the `ScopedLocations` brand's
doc comment is **partly false**: `tests/persistence/migrate-config.test.ts:325`
spreads a real bundle with an overridden path, type-checks, and produces a
scope-mixing `ScopedLocations`, because a spread carries the unique-symbol brand
forward. Adding only the `@ts-expect-error` negative would make the comment look
verified when it is not — narrow the claim at `locations.ts:29-31` to the
from-scratch literal first, then pin *that*. Second, the type-verification
modules themselves bypass the brand: `tests/bridges/{skills,agents}/types.test.ts`
write `locations: undefined!` (which types as `never`) at ten sites between them,
so those `satisfies` checks accept any declared type for the field.

**Sweep to run before the fix lands:** every `readdir` / `readFile` / `cp` whose
path derives from marketplace-manifest or `state.json` data, checked for a
preceding `assertPathInside`.

## Master tally

The first pass's `_AUDIT.md` verified **74 BLOCKER + 355 WARNING = 429 findings**
across 41 files (raw 435, minus 6 duplicates), plus three late files
(`platform`, `transaction`, `root-index`) for a working total of roughly
**76 BLOCKER + 373 WARNING**.

The adversarial pass adds **+221 BLOCKER and ~645 WARNING**, and re-grades ~526
of the originals (~63 OVERSTATED, 16 REFUTED, ~83 UNDERSTATED). **Both tallies
are now stale and `_AUDIT.md` must be regenerated from the `adversarial/` files
before any number here is used for planning.** Known corrections the refresh must
apply:

- Every area's first-pass total is a **floor, not a ceiling**. Where the first
  pass was most confident the shortfall is largest: `architecture-boundary-gates`
  went 1→11 BLOCKER, `persistence` 3→10, `root-index` 0→~6.
- Several areas recorded 0 BLOCKER and should not be: `bridges-skills` (5),
  `domain-core` (6), `shared-concerns` (2), `orchestrators-root` (5),
  `bridges-hooks-payloads` (2), `architecture-catalog-uat-a` (2 + 1 promotion).
- One BLOCKER should move down: `marketplace-seed.ts`'s double cast (see
  Calibration).
- One area's BLOCKER count is right but its BLOCKERs are different ones:
  `orchestrators-reconcile-notify`.

**Do not plan by finding count.** The count is dominated by warnings, and several
of the highest-count clusters collapse to a single production change. The next
section is the planning order.

## Ranked by leverage

Ordered by findings-resolved-per-change, not by severity. The first pass's order
was rewritten by this pass: its #1 item was refuted as a *cause* and split in
two, and three new items outrank most of what was there.

### 1. Fix the shared git-ops fake's `structuredClone` (one file, one edit)

`tests/platform/git-ops-fake.ts:129,146,157,162,184` records call options with
`structuredClone`, which throws on the function-bearing `auth` bundle its own
types declare.

**Re-counted during consolidation, single authoritative number:
22 hand-rolled workaround sites across 12 test files** (`grep -rn "const { auth"
tests/`), of which **14 discard the bundle entirely** (`auth: _auth`, 8 files).
This settles the tracker's 20/11 vs 22/12 vs ~15/8 disagreement — 22/12 is right.

| File | Sites |
| --- | --- |
| `tests/orchestrators/plugin/{clone-cache,info,fetch}.test.ts` | 3 each |
| `tests/orchestrators/plugin/{install,reinstall,update}.test.ts` | 2 each |
| `tests/orchestrators/reconcile/apply.test.ts` | 2 |
| `tests/orchestrators/plugin/bootstrap.test.ts`, `tests/orchestrators/marketplace/{add,update}.test.ts`, `tests/edge/handlers/plugin/bootstrap.test.ts`, `tests/architecture/config-state-consistency.test.ts` | 1 each |

This is not duplication — **it destroys an observation.** Because every wrapper
strips `auth` before the fake records the call, `state.calls.clone[i].auth` is
structurally always `undefined` in all twelve files, and
`install.test.ts:6868` asserts that `undefined` inside a `deepStrictEqual` as
though it proved authless cloning. Only `marketplace/add.test.ts:141-149`
reattaches the bundle, so it is the only suite that can assert what auth reached
the wire. Two more suites shape their *fixtures* around the bug instead:
`tests/edge/handlers/marketplace/add.test.ts:15-20` forces every source onto
GitLab because a GitHub source attaches a credential bundle the recorder cannot
clone — so **neither suite can drive a GitHub source at all today**.

Fix: shallow-copy the serializable fields and carry `auth` by reference. Deletes
22 wrappers and nine `makeMockGitOps` re-definitions, and makes credential wiring
observable for the first time. **Credential wiring is currently a suite-wide
blind spot.**

The general rule to propagate: `structuredClone` at a fake's boundary is correct
for plain data and wrong for any field typed to carry a collaborator.
`tests/platform/credential-ops-fake.ts` is safe only because `GitCredentials` is
plain data; any other fake whose recorded options can carry a port, callback, or
`AbortSignal` has this latent.

### 2. Narrow `getAgentDir()`'s environment read (one production change, ~14 helpers)

`platform/pi-api.ts:15` re-exports the SDK's `getAgentDir()`, which reads
`process.env.PI_CODING_AGENT_DIR` **before** consulting `homedir()`. Because the
read is inside logic rather than a parameter, every test that touches a
user-scope path has to mutate a process global — and most of them do it wrong.

**Re-derived during consolidation** (`grep -rn "function withHermeticHome"` plus
per-file `PI_CODING_AGENT_DIR` inspection), settling the tracker's dispute:

- **13 hand-rolled `withHermeticHome` definitions** (12 inside the unit suite;
  the 13th, `tests/integration/transaction-lifecycle-cascade.test.ts`, is outside
  this sweep's reviewed scope but shares the fix).
- **3 neutralize `PI_CODING_AGENT_DIR`** — `tests/orchestrators/marketplace/{list,info,autoupdate}.test.ts`, each save/delete/restore.
- **10 do not** — `tests/orchestrators/marketplace/update.test.ts` (mentions the variable only in a comment), `tests/orchestrators/plugin/{install,update,list,info,uninstall,reinstall,enable-disable}.test.ts`, `tests/architecture/cross-op-convergence.test.ts`, `tests/integration/transaction-lifecycle-cascade.test.ts`.
- Neither prior claim was right: `list-uninstall-a` said 4 marketplace copies
  neutralize it (it is 3 — `update.test.ts` does not); `state-drift` said none do
  (3 do).
- Beyond the 13 named copies, **56 test files touch the variable**, 47 redirecting
  it and `tests/index.test.ts` clearing it. Counting the bespoke variants gives the
  ~17 figure `orchestrators-root` reported and the "13 + a 14th ad hoc"
  (`tests/persistence/locations.test.ts:67`) that `persistence` reported. All three
  counts are consistent; 13 named definitions is the number to plan from.

**Consequence:** every user-scope case in those ten files writes the developer's
real agent directory — including `saveState` overwriting a real `state.json` —
whenever the variable is exported. This is a hermeticity BLOCKER no first-pass
area reported.

**One parameter-narrowing dissolves all of them.** Reference form for the interim
test-side fix: `tests/orchestrators/marketplace/list.test.ts:139-161`. Note the
inverse hazard — the **one-sided scope coverage** class (`root-index`'s naming):
a helper that *clears* the variable is hermetic but makes the user scope
unseedable, so every two-scope behavior collapses to one and scope-swap mutations
survive. That is what collapses three of `root-index`'s four BLOCKERs —
`tests/orchestrators/discover.test.ts:29` redirects instead, and that is the
better form. Any fix under this item must redirect, never clear.

**Extension of this item — `homedir()`-derived reads.** The parameter-narrowing
above reaches only `getAgentDir()`. The ~17 `bridges/mcp/stage.test.ts` cases
that read the developer's real `~/.config/mcp/mcp.json` and `~/.pi/agent/mcp.json`
get there through a bare `homedir()` three call-frames deep, where a per-file
`withHermeticHome` cannot reach (`bridges-mcp`'s finding). Those need the same
treatment — pin the dependency, not the file: thread the base directory (or a
`homedir` port) into the read path. This cluster is BLOCKER-graded and owned
here, not by "Known gaps".

### 3a. Delete the cast clusters — test-only, unblocked today

**The first pass's causal claim is refuted, five times independently.** It said:
"Because no test can construct a full SDK object, every caller fakes one and
forces it past the compiler." Tests *can* construct one; `strong-mock`'s
`mock<T>()` satisfies an arbitrarily wide third-party interface with no
structural literal and no cast. The counter-examples, each in a file that drives
the same over-wide `ExtensionContext` / `ExtensionAPI` parameters:

| Refutation | Evidence |
| --- | --- |
| `tests/edge/notification-boundary.ts:96-98` | `mock<ExtensionCommandContext>` + `mock<ExtensionAPI>`, `exactParams: true`, **26 importing consumers** |
| `tests/shared/notify-context.test.ts:111-113` | 11 cases through `notifyWithContext`, zero casts |
| `tests/architecture/notify-producer-wire-coverage.test.ts:53-59` | zero casts in the whole file, plus a `.twice()` cardinality proof |
| `tests/orchestrators/plugin/reinstall.messaging.test.ts:80-82` | three mocks, no casts, drives the real `notifyWithContext` |
| `tests/edge/handlers/{shared,tools}.test.ts` | zero casts across 53+ cases against the full types |
| `tests/orchestrators/import/execute.test.ts` | zero `as never` / `as any` / `as unknown as` across 4,617 lines |

So the casts are a **doubles choice**, not a compiler constraint. **Corrected
count**: `tests/shared/notify.test.ts` carries **382 `as never` tokens on 187
lines** (measured; the recorded 178 was a line count of one region). The 382 split
185 `ctx` + 180 `pi` + 15 `message` + 2 other. The 367 ctx/pi casts are dissolved
by either fix; the **15 message-position casts are not** — they launder
type-illegal message fixtures past the compiler, and one of them
(`notify.test.ts:5537`) hides a live GATE-01 violation (an `installed` row with no
`severity`, which `TransitionMessageBase` at `notify.ts:684` exists to reject).
Its own sibling at `:5557` already shows the `satisfies` form that fixes it.

**A cast-grep inventory under-counts the cluster.** Two modules carry the
identical over-wide defect with **zero** casts, paying instead in poison-pill
literals: `bridges/hooks/translation-context.ts:54` (~78 lines of throwing-getter
boilerplate, declared clean by two reviewers) and `bridges/hooks/dispatch-exec.ts`
(~42 more). The second detection signal is a hand-built object literal that
`satisfies` a third-party context type.

### 3b. Narrow the production `ctx` / `pi` parameters — independent ticket

Still worth doing on its own merits (a narrow parameter is a narrower promise),
but **it is not the prerequisite for 3a and must not be sequenced as one**. Known
members, each with the members actually read:

| Module | Reads | Cost today |
| --- | --- | --- |
| `shared/notify.ts` / `notify-context.ts` (5 entry points) | `ui.notify`, `getAllTools` | 382 casts in one file, 16 more in `catalog-uat.test.ts` |
| `bridges/hooks/if-field/index.ts:357-400` | `ctx.cwd` only | 7 casts; **also carries a fully dead `_claudeEvent` parameter** — narrow and drop it in one edit |
| `bridges/hooks/settle.ts:166-170` | `pi.sendMessage` | 9 casts, and it *causes* the separately-filed dead `isIdle` stub |
| `bridges/hooks/translation-context.ts` | `cwd`, `sessionManager` | ~78 lines of harness |
| `bridges/hooks/dispatch-exec.ts` | 2 members | ~42 lines |
| `orchestrators/plugin/{install,uninstall,update}.ts` | `ui.notify`, `getAllTools` | `makeCtx` double casts in 7 sibling suites |
| `index.ts` | — | 2 `as unknown as`; the `placeholderCtx` cast has propagated to **6 more call sites across 4 integration files**, and `event-router.ts:591`'s doc comment already writes the narrowed form |
| `bridges/hooks` `registerHooksBridge` | `opts.ctx` grep-provably never read | 6 forced casts across 5 files |
| `edge/handlers/tools.ts:137,175` (`projectRowStatus`) | 10 of 19 declared status arms reachable | 9 dead throw arms **and** 9 propping-up cases — see Operator decision 1 |

The `index.ts` second cast is worse than a documentation gap: it defeats the
peer-drift auditability `platform/pi-api.ts` exists to provide, and the planning
record marks it VERIFIED-removed against a file that still carries it.

### 4. Add the missing injection seams — one ticket, 17 modules

**Calibration ruling applied.** This is **one WARNING-tier design ticket**, not
six BLOCKERs and one grouped WARNING. The 6-vs-1 split is granularity, not
severity: `edge-handlers-plugin.md:49` groups nine handlers into one entry
exactly as the brief instructs, while `edge-handlers-marketplace.md` splits six
instances of the same finding into six. A full mutation catalogue run over all
six marketplace handlers caught every handler-level mutation, and neither loaded
skill's BLOCKER definition reaches a static import.

**Escalate an individual member to BLOCKER only where the missing seam causes an
ownership violation** — the test asserts rows, records, or rendering owned by the
orchestrator's own pairing file. That is the calibration rule `transaction`
proposed and it is the right one: *does the missing seam force the test to assert
another module's contract, or only to build an inelegant double?* Under it, the
edge handlers qualify (they assert contracts owned three layers down) and
`with-state-guard`'s missing port does not.

**How both statements hold at once:** severity attaches to the *symptom*, not the
seam. The seam-addition work itself is one WARNING-tier design ticket over all 17
modules. The ownership violations it currently causes (~15 handler suites
asserting orchestrator-owned contracts) are BLOCKER-graded findings that live in
their own area files — and they are *resolved by the same work*: once the seam
exists, those cases are relocated to the orchestrator pair or deleted as
duplicates. One workstream, two severity labels, no contradiction.

**Count reconciled to 17 modules**: 9 plugin handlers (`list`, `install`,
`uninstall`, `update`, `reinstall`, `enable-disable`, `info`, `pending`, `fetch`)
+ 6 marketplace handlers + `edge/handlers/tools.ts` + `orchestrators/edge-deps.ts`.
The last two were each independently reported as "the 16th"; they are distinct.

Three constraints the tickets must carry:

1. **Injection is only half the pattern.** `domain/resolver.ts`'s
   `ResolveContext.resolveGitPluginRoot` is a textbook injected port whose double
   (`resolver.test.ts:2189`) is a zero-parameter function that discards its
   argument, used by ten cases, with no call-count or argument assertion anywhere.
   Wrong, raw, and duplicate calls all survive. **Every seam ticket must name the
   interaction assertion, not just the seam.**
2. **Adding a seam deletes coverage the orchestrator pair never had.**
   `UpdatePluginsOptions.mapModel` has **zero** occurrences in the 8,502-line
   `tests/orchestrators/plugin/update.test.ts`; its only exercise is
   `tests/edge/handlers/plugin/update.test.ts`, which reaches it *because* no seam
   exists. Same inversion is likely for `partial`, `local`, and `scope`.
   **Sequencing rule: census the option fields the handler currently proves
   end-to-end and back-fill owning cases in the orchestrator's pair first.**
3. **A missing seam can present as an expensive test rather than a missing one.**
   `reinstall.test.ts:4855-5017` is a 163-line child-process + `fs.watch` race
   harness that exists only because `enumerateReinstallTargets` reads `loadState`
   by static import while the transaction path beside it takes an injected one.
   The cheap form is demonstrated twice in the same file (`:5051`, `:6866`).
   Signature to sweep: `grep -rn "spawn(process.execPath" tests/`.

In-repo template: `orchestrators/import/execute.ts` (`ImportDeps` with an
optional `installPlugin` resolved through `installPluginFn(deps)` at `:158-227`).
**Not** `orchestrators/plugin/bootstrap.ts` — see Patterns, below.

### 5. Convert module-global state to factory-owned state

The first pass's framing needs two structural corrections before this is
ticketed.

**(a) Split the heading in two.** Filing a genuine production API beside a
test-only hook risks the fixing pass deleting the API.

| Group | Modules |
| --- | --- |
| **Test-only exports to delete** | `shared/completion-cache.ts` (`resetCompletionCache` — **18 call sites across 9 files** (the audit added `tests/architecture/flag-catalog-drift.test.ts`), zero production callers, honest doc comment; plus two more test-only exports, `MARKETPLACE_NAMES_CACHE_SCHEMA` and `PLUGIN_INDEX_CACHE_SCHEMA`); `bridges/hooks/routing-state.ts` (`resetRoutingState` — imported by **18 test files** — plus `resetEpoch` and the state reader `routingTableEntries`); `bridges/hooks/stage.ts::hookConfigPathFor`; `orchestrators/reconcile/apply.ts:879::surfacePostCommitWarnings`; `edge/handlers/plugin/list.ts:82`; `edge/handlers/plugin/fetch.ts:43`; `edge/handlers/tools.ts::projectRowStatus`/`ToolPluginStatus`; `platform/git.ts::listBranches`/`listRemotes`/`CheckoutOptions.noCheckout`; `domain/manifest.ts::MARKETPLACE_VALIDATOR`; the whole marketplace-names cache tier (`shared/completion-cache.ts:250` + `orchestrators/edge-deps.ts:149` + `LocationsResolver.marketplaceNamesCachePath`); `bridges/mcp`'s `readMarker`/`parseMcpServers`/`deepSubstitute`/`MCP_COLLISION_SLOTS`; `orchestrators/reconcile`'s `PENDING_STATUSES`, `scanForceInstalledBackfills`, `PendingInstallCandidateLocator`, `PendingReconcileOptions` |
| **Production APIs whose state should become factory-owned** | `bridges/hooks/async-rewake/registry.ts` (`shutdownInMemoryChildren` is **called by `event-router.ts:727` on every `/reload`** and documented at `registry.ts:517-522` — the 62 manual reset calls are real, the "test-only" label is not); `bridges/hooks/settle.ts` (`resetSettleState` has exactly one production caller, `event-router.ts:721`) |

**(b) Item 2's title is too narrow.** "Test-only hooks over module-global state"
misses three other shapes of the same guideline clause: **state readers**
(`routingTableEntries`), **path composers** (`hookConfigPathFor`), and
**test-only exports of immutable values or pure functions** (`list.ts:82`,
`fetch.ts:43`). Rename it to **"test-only production exports"**, with the
reset-hook table as its first sub-group.

**Start with `settle.ts`** — its four cells are private to its own closures, it
has one production caller, and the factory refactor makes the cap-latch re-arm
observable, closing a BLOCKER as a side effect. `routing-state.ts` needs a wider
change (18 test files) and should come last. `completion-cache.ts` should be
sequenced *with* `settle.ts`, not after: its module-global maps do not merely
force reset calls, they make a whole class of case **unwritable** — because
`memPluginIndex` is keyed `${scope}::${marketplace}` in process-global state,
every case must pick a unique marketplace name to isolate itself, which is
exactly why the `scope` half of the cache key is unproven repo-wide.

**Do not repeat the "doc comments cut both ways" claim as stated.** Three
independent reviewers confirmed that `routing-state.ts`'s comments **do not
lie**: `:316-318` reads "Its only caller today is test setup, which is what a
reset is for", and `:188-190` reads "the test reset seam is its only caller".
Both are factually accurate. The comment makes a design *argument* ("a public
lifecycle operation rather than a test hole") and contains exactly one false
clause: "the four clears it composes are each already public" —
`clearParsedConfigCache` (`:257`) and `clearRoutingTable` (`:296`) are
module-private, so no caller can compose the reset itself. **Replacement wording:
"doc comment honestly admits the only caller is test setup, but falsely claims the
clears it composes are public — two of the four are module-private."**

**Root mechanism, now named:** `.fallowrc.json` sets `"production": false`
(deliberate, FLOW-06 — nobody is proposing to flip it), so a test import counts as
a real consumer and **no gate in this repo can see a test-only export**. Eight
independent areas hit this. Worse, `transaction` found the sharper form: the
pairing gate (`scripts/check-corresponding-tests.mjs`, in `npm run check`)
guarantees *every* module has a paired test, so `fallow dead-code` can only ever
report module-level death for something the pairing gate forbids. **The two gates
cancel out at module granularity** — which is how a dead production module
(`rollback.ts`) sat green. The durable fix is a read-only
`fallow dead-code --production` **probe** reported separately from the gate.

### 6. Retire the builtin-module-namespace patching idiom (13 files)

**Not represented anywhere in the first pass.** `createRequire(import.meta.url)("node:fs/promises")`
+ `t.mock.method` + `syncBuiltinESMExports()` replaces `fs` bindings for every
ESM importer in the process. Both loaded skills forbid it outright, and it is
invisible to a reviewer grepping for `t.mock.module`. Confirmed at **13 files**
by five independent agents:

`tests/orchestrators/plugin/{install,uninstall,reinstall,fetch,info,enable-disable}.test.ts`,
`tests/orchestrators/reconcile/apply.test.ts`,
`tests/bridges/{hooks/event-router,hooks/stage,skills/stage,skills/unstage,commands/discover}.test.ts`,
`tests/shared/path-safety.test.ts`, plus the shared helper
`tests/orchestrators/plugin/scope-tree-inventory.ts` (whose own header documents
having to bind `readdir` early to dodge its own mocks).

**The root cause is a production import style, not a test choice.** A module that
writes `import { lstat } from "node:fs/promises"` forces the namespace re-sync; a
module that writes `import fs from "node:fs/promises"` and calls `fs.lstat` is
patchable with a plain `t.mock.method`. `shared/fs-utils.ts` is the in-repo proof
— 698 test lines, 8 patches, **zero** re-syncs. **Flip one import line per module
and most of the loader tricks become removable mechanically**; the residue is the
set that genuinely wants a DI port.

This must land **before** the retry-proof pattern is propagated anywhere else,
because the repo's best test technique (`uninstall.test.ts`'s retry matrix,
`reinstall.test.ts`'s `observeReinstallSchedule`) currently rests on this
violation. This is a **distinct operator call from the prototype-surgery decision**
— some uses are unavoidable races (`fetch.test.ts:1263`), most are EACCES failures
reproducible with `chmod` (`fetch.test.ts:1546` is the honest form).

### 7. Replace fragment assertions — but not uniformly

~100+ sites use `.includes()`, `.startsWith()`, `.endsWith()`, or a partial regex
as the sole content check where the whole expected string is computable. The file
table grew substantially:

| File | Scale |
| --- | --- |
| `orchestrators/plugin/list.test.ts` | ~130+ sites |
| `orchestrators/plugin/info.test.ts` | ≥34 of 129 cases (not 33) |
| `orchestrators/plugin/update.test.ts` | ~15 sites across three disjoint sections |
| `orchestrators/plugin/install.test.ts` | ~13-14 sites, plus **9 cases that never capture `notifications` at all** in standalone mode |
| `orchestrators/plugin/enable-disable.test.ts` | 17 sites |
| `orchestrators/marketplace/update.test.ts` | ~23 (not ~20) |
| `shared/notify.test.ts` | ~19, concentrated in lines 1147-4315 |
| `orchestrators/plugin/reinstall.test.ts` | 9 sites |
| `domain/resolver.test.ts` | 19 `notes.some(...)` + 37 `assert.ok(...)` in lines 2000-3949 alone |
| `orchestrators/marketplace/add.test.ts` | 6 sites |
| `orchestrators/plugin/clone-cache.test.ts` | 4 sites |
| `tests/architecture/cross-op-convergence.test.ts` | `:336-345`, on an emission the same file pinned byte-for-byte 60 lines earlier |

**Three gating checks are mandatory before any site is touched.**

1. **Same-payload-sibling check first.** Of eight fragment sites in one
   `notify.test.ts` slice, **six are already byte-pinned by a sibling with an
   identical payload**. Those should be **deleted or folded**, not strengthened —
   converting them uniformly would roughly double the assertion surface of
   `list.test.ts` and `info.test.ts` while adding no protection.
2. **Input-widening caveat.** A whole-value comparison only discriminates the
   fields where the arranged input and the expected literal actually **differ**.
   Two resolver BLOCKERs survive the very exemplars the first pass nominated: a
   hardcoded plugin `name` survives because every fixture uses the same name on
   both sides, and `notes`/`unsupported` ordering survives because every
   exemplar's arrays are single-element. `domain/components/hooks/partition.test.ts`
   is the clean demonstration — every case uses `deepStrictEqual` on the whole
   result and still misses a BLOCKER, because whole-value comparison proves only
   what the input carried (19,531-input brute force executed). **A pass that
   converts assertions without widening inputs produces exemplary-looking files
   that prove nothing about passthrough.**
3. **Re-rate the notify-adjacent files as ownership defects, not escape risks.**
   `tests/architecture/catalog-uat.test.ts` drives `notify()` for 182 states and
   compares the full string against `docs/output-catalog.md`, so 9 of 10 fragment
   sites in one `notify.test.ts` slice are byte-backstopped. The risk is
   overstated; the **guideline violation is not** — those pairs are having their
   coverage duty discharged by an architecture test. See the reconciliation below
   for why this does not contradict the catalog's own production-path defect.

**Ordering is not restored by whole-string equality.** This is the cluster's
biggest blind spot and it is structural: substring assertions delete every
*ordering* guarantee, and rewriting them to whole strings does not bring the
guarantees back, because most fixtures are built in already-sorted order.
`list.ts` alone loses three (marketplace name sort, in-block plugin sort, SC-6
exclusion) and carries three cases whose titles claim to prove sort arms they
cannot observe. **Every orchestrator `.sort(` and `compareByNameThenScope` call
site needs one case whose expected order differs from its arrival order** —
candidates: `reinstall.ts:822`, `update.ts:2727`, `fetch.ts:190`,
`reconcile/{notify,pending}.ts`, `import/execute.ts:510`,
`bridges/hooks/event-router.ts:321`. Reference for the honest form:
`reinstall.test.ts:1353`.

**Four adjacent classes the `.includes(` grep cannot see** — the ~100 count is a
floor:

- **Argument-count-only cases**: `assert.equal(calls[0].arguments.length, 1)` with
  no read of `arguments[0]` (9 sites in `notify.test.ts`).
- **Fragments hidden inside `deepStrictEqual`**: `{ a: text.includes(x) }` compared
  to `{ a: true }` (`wire-protocol.test.ts`, `async-rewake/pid-table.test.ts`).
- **Filtered-then-compared-to-empty**: `deepStrictEqual(filtered, [])` /
  `assert.ok(!x.includes(...))` as the sole content check — passes when the
  producer emits nothing (4 sites in the notify gates alone; grep `, [])` and
  `assert.ok(!` across `tests/`).
- **Decode-before-asserting**: `JSON.parse` the production output, then assert on
  the object — the case never sees the bytes. In `spawn-helpers.test.ts` that one
  choice hides three contracts (maximality, the WR-02 single marker, key order),
  two confirmed survivable by execution. Sweep every test that decodes a value the
  module under test produced: `bridges/mcp/{stage,unstage}`,
  `bridges/agents/frontmatter.ts`, `bridges/skills/frontmatter-degrade.ts`,
  `shared/atomic-json.ts`, `persistence/agents-index-io.ts`, all of
  `bridges/hooks/payloads/`.

**"Reduce the assertion to a projection" is never the remedy.** Several first-pass
entries logged it against `uninstall`/`reinstall`/`fetch`; it would leave
`notifications` unasserted while the boundary still counts an emission, and the
skill classes an assertion-weakening revision as a finding in its own right.

**Counter-examples worth recording so the fixing pass does not sweep them:**
`tests/bridges/skills/` (zero fragments), `tests/domain/` non-resolver files
(zero), `tests/edge/handlers/{shared,tools}.test.ts` (zero in 1,764 lines), all
eight `orchestrators/plugin/*.messaging.test.ts`, and all five
`orchestrators/marketplace/*` test files.

### 8. Restore exhaustiveness — triage per switch by shape

**The blanket claim is false under this repo's compiler settings, confirmed eight
times.** `tsconfig.json:11` sets `noImplicitReturns: true`. A switch whose arms
all `return`, with no code after it, raises TS7030 (and TS2366 for a non-nullable
return type) the moment a union member is added. The repo's own memory records
this.

**Value-returning, therefore already compiler-guarded** (adding `assertNever` is
house-style only): `orchestrators/plugin/install.messaging.ts:366-408`,
`reinstall.messaging.ts:276`, `reinstall.ts:1542-1553` and `:1568-1579`,
`enable-disable.ts:1025-1075` and `:1265-1348`, `update.ts:2584-2627`,
`list.ts:851-889` (**documented as such at `:839-842` — adding an `assertNever`
arm here would give `fallow dead-code` something to flag**),
`plugin-state-classifier.ts:187` (also documented), `shared/notify.ts:2522`
(`renderPendingRow`), `domain/resolver.ts:591` and `:816`, `domain/source.ts:585`
and `:618`, `bridges/hooks/dispatch.ts:110`, `:395`, `:475`.

**Statement-position or code-after-switch — the real silent-omission hazard**:
`orchestrators/import/execute.ts:592` (production bug 11 above),
`domain/github-auth.ts:370` (the function returns *after* the loop, so a new
`PollResult` member compiles clean and produces a **silent hang until the
device-code deadline**), and `orchestrators/reconcile/{plan,apply}.ts` (confirmed
to carry no `default:` or `assertNever`; their return shapes were not checked and
must be before they are planned).

**Two fix-form corrections that change the work:**

- **The house pattern is a value-returning signature, not `assertNever`.** On a
  provably-closed union a `default: assertNever(x)` is itself dead code; making
  the function return a named bucket type turns a missing arm into TS2366. The
  worked example is in the same file as the bug (`import/execute.ts:669-683`,
  `:713-722`).
- **A bare `never` pin plus `continue`/`break` preserves the silent drop** that
  makes the reconcile instances BLOCKERs, and `assertNever` **throws inside
  `resources_discover`, where NFR-2 forbids it**. The house template for this
  exact situation is pin-and-land: `bridges/hooks/settle.ts:211-217`.
- **Prerequisite:** `assertNever` throws `new Error("Unexpected value: " + String(x))`
  (`shared/errors.ts:26`), which for any object is the constant
  `"Unexpected value: [object Object]"`. Nine cases in one notify slice assert
  exactly that string, so **any** `assertNever` anywhere in the call chain
  satisfies them. Adding arms is only half the value if the tests proving they
  fire cannot tell which one fired. **Fix `assertNever` to throw a typed
  `UnexpectedValueError` carrying `readonly value: unknown` and a site tag
  first** — matching `shared/errors.ts`'s own stated convention. Template for the
  resulting case: `tests/shared/errors.test.ts:1420`, which plants
  `{ kind: "future" } as never` and asserts the exact message.

**The class is wider than `switch` statements.** Three other spellings of the same
silent omission:

- **`if`/`else` chains plus a duplicated allow-list** — `marketplace/add.ts:336-391`,
  invisible to a switch-scoped audit.
- **Subset-only `satisfies`** (`TUPLE as const satisfies readonly Union[]`) — the
  repo's dominant closed-set pin. It errors in only two of four drift directions,
  and **not** in the direction two doc comments explicitly claim
  (`domain/components/hook-events.ts:59-62`, `shared/concerns/hooks.ts:19-23`,
  both verified false with the repo's own `tsc`). Four closed sets are properly
  protected (`REASONS`, `STATUS_TOKENS`, `PLUGIN_STATUSES`, `MARKETPLACE_STATUSES`);
  every other appears to rely on the subset form alone. In-repo template:
  `_ReasonsCoverageProof` (`shared/notify-reasons.ts:266-270`), plus the
  bidirectional-`extends` exactness check at
  `tests/shared/notify-reasons.test.ts:43-48`.
- **Closed sets pinned negatively in tests** — `hooks-foundation.test.ts:207` pins
  `UNSUPPORTED_COMPONENT_KINDS` with `!includes("hooks")`, eight lines after
  pinning its sibling with a full closed-tuple compare. Two of eight members are
  unpinned repo-wide, and the set is security-relevant by its own doc comment
  (T-02-25).

Widen item 8's title to **"closed sets without a bidirectional pin"**.

### 9. Audit every architectural gate — see the dedicated section below

Now ~20+ instances with a named root cause and a written acceptance criterion.

### 10. Inject a clock (15 hidden `new Date()` reads)

`grep -rn "new Date()" extensions` returns 15 sites, all in orchestrators and
shared state writers: `plugin/install.ts:1180,1389,1437`,
`plugin/update.ts:1713,1983`, `plugin/enable-disable.ts:365,400`,
`plugin/reinstall.ts:1409`, `marketplace/add.ts:700,863`,
`marketplace/update.ts:472`, `shared/completion-cache.ts:343,358`,
`bridges/hooks/async-rewake/registry.ts:319`. Three suites already fake `Date` to
work around it (`reconcile/backfill.test.ts` at 7 sites,
`marketplace/update.test.ts`, `plugin/bootstrap.test.ts`), which the guidelines
call a finding in itself. Same shape as item 5 — a hidden dependency forcing a
test-side workaround — and one injected `nowIso` parameter per writer dissolves
it.

The sibling of this is the **`homedir()`-inside-business-logic** cluster:
`plugin/{install.ts:1088, update.ts:2048, reinstall.ts:1347, info.ts:397}` and
`bridges/hooks/event-router.ts:{177,573}` all build
`{ homedir: homedir(), cwd, projectRoot: cwd }` inline. Fixing one verb makes the
verbs disagree about how the hooks `if:` predicate resolves `~`.

### 11. Type `JSON.parse`-derived fields as `unknown`

The `mcp.json` crash is not two oversights. `bridges/mcp/types.ts:18` declares
`mcpServers?: Record<string, unknown>` on a type reached by casting raw
`JSON.parse` output (`stage.ts:89`, `unstage.ts:69` — `parsed as RawMcpDoc`), and
the plain-object guard is hand-written **10 times inside `bridges/mcp/` alone**
plus twice in `orchestrators/import/`. The two sites that omitted it are exactly
the two bugs — and the omission **type-checked**. Widen the fix from "patch the
two guards" to **"type the field `unknown`, extract one shared predicate, and let
the compiler find every site"**, then sweep `persistence/state-io.ts`,
`persistence/config-io.ts`, `domain/manifest.ts`, and the hooks config parsing for
the same shape.

### 12. Consolidate the duplicated helpers

Beyond `withHermeticHome` (item 2): `makeMockGitOps` is defined **9 times** with a
shared body (dissolves with item 1); `seedMarketplace` **10 times**; the
`PI_CLAUDE_MARKETPLACE_DEBUG` capture block is copy-pasted **18 times across 11
files** (~230 lines, and one `captureDebugLines(t)` helper would fix the
`hookDebugLog` coverage gap as a side effect); the hand-built
`ResolvedPluginInstallable` literal appears in **11 files** and wants one seed
function owned by `domain/resolver.ts`; `stripComments` is hand-rolled in **5**
architecture files; `firstValidationErrorDetail` is byte-identical in **3**
persistence modules (and passes `fallow dupes`, which is identifier-sensitive);
`dependenciesFromInstall`/`dependenciesFromInstalled` duplicate a closed-set
derivation across `reconcile/` and `import/`; the same 16-row input table appears
in `tests/shared/concerns/soft-dep.test.ts:14-128` and
`tests/shared/notify-reasons.test.ts:141-250` (production cause:
`companionSeverity` re-implements the `softDepMarkers` predicate); the 10-entry
translator dispatch table is duplicated verbatim in `dispatch-exec.ts:113-123` and
`async-rewake/registry.ts:102-114`; and six modules copy-declare the same
`{ mode: "standalone" } | { mode: "orchestrated" }` union, each exported under a
different name with **no consumer outside its own module**.

### 13. Module splits — see Operator decisions

## Gates that do not gate

The first pass listed five instances. **The count is now above twenty**, and the
class has a named root cause and a testable acceptance criterion.

**Root cause (from `architecture-state-drift-gates`, confirmed by
`architecture-boundary-gates`):** every gate pattern was written against the one
spelling that existed at authoring time and was never proven against the spelling
the guarded production code is actually written in. This is sharper than the
repo's own "plant the violation" rule — three of the four state-drift gates *do*
plant violations, and would still pass a planted-violation test written the
obvious way. `config-state-write-seams.test.ts` plants five synthetic offenders
and three benign controls, textbook, and is still bypassable by an entire write
API it never considered. **Planting proves the pattern fires on the spellings the
author imagined; it says nothing about the spellings they did not.**

**Acceptance criterion for the audit workstream (adopt verbatim):** every
scanning gate must (a) assert it visited a named real file or a plausible file
count, and (b) carry synthetic offender **and** benign rows written against its
own pattern constants, **including the spelling the guarded production code uses**.
In-repo references: `no-split-01-cast-reads.test.ts:131-185` for (b),
`import-boundaries.test.ts:234` for (a). Add three audit questions:
*can this assertion fail at all?*, *does the production path still route through
the seam this gate scans?*, and *does any comment claim membership in a gate whose
target list does not include the file?*

| # | Gate / mechanism | Why it does not gate |
| --- | --- | --- |
| 1 | `no-credential-leak.test.ts` | Understated four ways: 4 of 7 scans use a bounded-prefix regex the file's own docstrings prove bypassable (two siblings were already patched; the fix never propagated); two `assert.ok(true)` vacuous ENOENT skips; the regex misses the live camelCase `accessToken`; and four scans anchor on `new Error(` while `domain/github-auth.ts:213` throws a `TypeError`. Security-relevant. |
| 2 | **New class — gates anchored on `new Error(`** | CONVENTIONS.md makes typed `Error` subclasses the house style and `shared/errors.ts` defines a dozen. One substitution fixes it: `new\s+[A-Z]\w*Error\s*\(`. Check `notify-grammar-invariant.test.ts`, `partial-vocabulary-guard.test.ts`, and any `*.messaging.test.ts` asserting error text by construction form. |
| 3 | `no-hooks-strict-additional-properties.test.ts` | Greps `domain/components/hooks.ts`, which commit `73d9c8b4` emptied of every TypeBox literal (they live in `hooks/schema.ts:20/44/57`). Confirmed from both sides. |
| 4 | NFR-5 no-network gate — **five missing targets, not two** | `marketplace/{list,remove,autoupdate}.ts` and `orchestrators/{edge-deps.ts, plugin/git-source-probe.ts}` are absent from `FORBIDDEN_TARGETS`. Three of them *claim* membership in their own headers (`list.ts:7-9`, `autoupdate.ts:60-61`, `git-source-probe.ts:13-15`), and `marketplace/info.ts:5-6` misattributes its gate to a test file that performs no source scan. |
| 5 | Same gate — **dynamic imports evade it** | `assertNoForbiddenSurface`'s import clause matches only `/from\s+["'][^"']*platform\/git[^"']*["']/`. `await import(".../platform/git.ts")` evades it on **all 12 targets**, and `reconcile-planner-purity.test.ts` shares the hole. *Reconciled:* `fetch.ts:464` was reported as a live violation — **refuted**, it imports `domain/resolver.ts`, and `fetch.ts` is correctly gated with an honest header. It stands as **proof that the dynamic-import form is idiomatic inside a gated file**, which is what makes the hole live. |
| 6 | Same gate — ENOENT skip | `:38-40` documents skipping missing targets with an informational marker, so a renamed or moved file silently stops being gated — the `73d9c8b4` failure mode again. The shared helper's WR-06 already deleted that path; the comment describes a retired design as current. |
| 7 | `import-boundaries.test.ts` | Reads the **first** raw ESLint block, so a later block setting the rule `"off"` leaves D-11 green; a duplicated zone masks a deleted one; and a static config-string check stands in for a real planted-cycle test. |
| 8 | `no-shell-out.test.ts` | Walker mutable to yield nothing (204 files → 0) and stay green; any of six regexes replaceable with a non-matching one. |
| 9 | `no-split-01-cast-reads.test.ts` | Recursion removable (57 orchestrator files → 6), green. |
| 10 | `scope-fences-63.test.ts` | Skips missing directories, so a rename greens the gate over zero inspected targets. Live BLOCKER because the hand-rolled walker lacks `source-scan.ts`'s WR-06 fail-on-missing-target. |
| 11 | `manifest-read-seam.test.ts:32` | Regex requires the filename **after** `readFile(`; the canonical seam (`domain/manifest.ts:53`) is written path-first, so the gate cannot flag its own subject. |
| 12 | `scope-order-drift.test.ts:57-58` | Rank regex requires `\d+ : \d+`; the house idiom is `? -1 : 1` (`notify.ts:4196`). **Demonstrated live escapee**: `list.ts:1167` re-derives the rank as a `Record<Scope, number>` and hand-rolls the comparator twice. Its header also cites an ESLint rule (`msg-gr-3-per-scope`) that was deleted, so the narrow regex is now the whole gate. |
| 13 | `config-state-write-seams.test.ts:102-104` | Sees only the `atomicWriteJson` spelling; a raw `writeFile(loc.stateJsonPath, …)` evades it, with no ESLint or fallow backstop. |
| 14 | `cross-op-convergence.test.ts` | The git fake records calls; nothing reads `state.calls`. |
| 15 | `config-state-consistency.test.ts:570` | A bare `!== undefined` on CR-02's own subject. |
| 16 | `partial-vocabulary-guard.test.ts` | Two holes. It never scans `tests/` — its own forbidden patterns match **127 lines across 9 unit-test files**, including `install.test.ts:4149` where the comment says `(unsupported)` and the assertion four lines down matches `(partially-available)`. And its force-family regexes require a separator (`/force[- ]install/i`), so they are blind to `ForceInstall`/`forceInstall` — **21 live violations inside `extensions/`**, including two production exports and `renderForceInstalled`, which is typed `RenderFn<PluginPartiallyInstalledMessage>` and registered under `"partially-installed"`, so identifier and rendered token disagree in one 3-line span. Plus ~99 retired-vocabulary hits across 8 unit-test files. |
| 17 | `notify-will-reload-agreement.test.ts` | Renders only one side of the agreement it is named for. |
| 18 | `notify-grammar-invariant.test.ts` | Skips its own assertions when severity is not stamped; `:458` guards its loop with `assert.ok(lines.length > 0)` while the structurally identical loops at `:419` and `:593` in the same file do not. Its `SUMMARY_GRAMMAR` regex also rejects an `"An"` branch that exists at `notify.ts:3009` — a gate contradicting a live-looking branch, with neither side noticing. |
| 19 | `hooks-dispatch.test.ts:42` | Filters ESLint config blocks by a substring of the block's own `files` glob, so a blanket `files: ["**/*.ts"]` override — the single most dangerous configuration — is the one it cannot see. **No gate anywhere scans the extension tree for `console.log/warn/debug`.** Any gate that enumerates config entries by a filter derived from those entries has the same inversion. |
| 20 | `flag-catalog-drift.test.ts:103-114` | **Tautological**: both sides call `parseFlagNames("list")`. Cannot fail under any input — stronger than a mis-aimed grep — and it is the sole justification for a production export (`list.ts:82`) whose doc names a nonexistent completions consumer. A first-pass reviewer cleared it as "not inert". |
| 21 | `hooks-foundation.test.ts:207` | Pins a closed set with `!includes("hooks")`, which passes for any content. |
| 22 | `dispatch-exec.ts:228-239` `REQUIRED_EVENT_FIELDS` | Understates exactly **6 of 10** translators (SessionStart/SessionEnd miss `reason`; PostToolUse/PostToolUseFailure miss `content`; Stop/StopFailure miss both payload fields), and the paired test asserts against a `TRANSLATOR_CASES` table that is a **hand-copy of the production table** — so it ratifies the drift. The contradiction is visible within one row (`:747` `requiredFields:[]` vs `:753` `eventFields:{reason}`). The WR-03 diagnostic is silent for exactly the corruption its docstring promises to signal. |
| 23 | `catalog-uat.test.ts` — **production-path mismatch, a new sub-class** | The repo's binding user-contract gate drives ~140 of its 182 examples through `renderPluginRow`, a file-private function with **no production call site that carries a plugin row**; production renders those rows through the per-command `*_RENDER` maps, as `update.messaging.ts:56-59` states outright. The gate runs, passes, and pins bytes nobody sees. Distinct from every scan-target mismatch above: the gate scans the right file and calls the wrong seam. |
| 24 | `catalog-uat.test.ts` driver | Zero planted-failure cases — `checkCatalogExample → return []` leaves the gate green. `formatCatalogFailure` and both failure arms of `checkSeverityArg` would read 0% in a direct-coverage run. |
| 25 | `usage-error` catalog state | Documented bytes, no byte lock, and stale against `edge/router.ts:91-105`. (The exclusion *mechanism* is sound — two of three excluded states are honestly re-gated by `hooks-cap-notify.test.ts`; the base rate here is 1 in 3.) |
| 26 | `clone-cache.test.ts:1569` | A re-export identity test that compares `fn.name === "resolveGitSubdirRoot"` — a string a locally-declared replacement also satisfies. The rule already prescribes `assert.strictEqual(reExport, source)`. Sweep the bridge and orchestrator barrels for `.name` standing in for binding identity. |
| 27 | **Citations to test modules that do not exist — 9+ sites** | `tests/architecture/markers-snapshot.test.ts:18` cites the deleted `no-legacy-markers.test.ts` as the reason not to cover 5 ES-5 literals, which are therefore unguarded (and `docs/messaging-style-guide.md:174` + `docs/output-catalog.md:2890` repeat the claim); `shared/notify.ts:374` → `tests/shared/notify-v2.test.ts`; `orchestrators/plugin/info.ts:1124`, `catalog-uat.test.ts:3532` and `marketplace-seed.ts:10` → `info-manifest-absent.test.ts`; `docs/output-catalog.md:2865` → `device-flow-prompt.test.ts`; `install.messaging.ts:476` names the wrong directory; `bridges/hooks/event-router.ts:740` → `tests/edge/index-handler.test.ts`, which never existed. **A ~15-line check that every `tests/…` path cited under `extensions/` and `docs/` resolves would have caught all of them.** |
| 28 | **Comments naming a gate that does not exist** | `glob.ts:15-17` and `:42-44` twice name "the architecture test" as pinning the truth table, and use that claim to justify accepting a documented `O(text.length ** N)` worst case — no architecture test touches the glob engine. `hook-if-targets.ts:23-25` claims an architecture test pins key order; none references the module. `list.ts:670-676` names a specific parity guard as the reason an export is legitimate; it does not exist, and a first-pass reviewer recorded the export verified-clean on the strength of that sentence. **Two of two, then three of three, checked headers were false.** Grep `extensions/**` for `architecture test`, `the gate`, `pinned by`, `is the regression gate`, `CI fails`. |
| 29 | `fallow` `production: false` | Green because tests hold the corpse up. Eight independent sightings; see item 5. |
| 30 | `fallow dupes` | Identifier-sensitive (a byte-identical triplicate differing by one constant name passes) and `threshold: 3` misses one-line clones — `list.ts:631` and `:1489` are identical bodies with 18 lines of JSDoc arguing they differ. |
| 31 | `fallow` and dead fixtures | Nine unreferenced JSON files under `tests/persistence/fixtures/` survived a schema-change commit. Fallow walks the TypeScript import graph only. |
| 32 | **Closed sets enrolled in no gate at all** | `Dependency` (SNM-06, `soft-dep.ts:22`) and `ClaudeHookEvent` (SURF-02, `hooks.ts:13-23`) appear in zero files under `tests/architecture/` while four peer closed sets get three layers each. Pair the recommendation with "audit every closed set against whether any gate scans it." |
| 33 | `test:coverage:direct` is not in the check chain | The script exists and is strict (`scripts/test-coverage-direct.mjs:279-306` fails a pair when `hit !== found` for lines, functions **and** branches), but `npm run check` runs only `test:corresponding`, `test:corresponding:negative` and `test:coverage:direct:negative` — **the gate's negative control is gated, the gate is not.** Arguably the highest-leverage item here: it is the only gate that would have found the transaction branch gap automatically. |
| 34 | A VERIFICATION document that did not verify | The planning record marks an `index.ts` cast VERIFIED-removed against a file that still carries it. |
| 35 | Contract delegation nobody checked | `git-ops-contract.ts:43` delegates option forwarding to `git.test.ts`, which does not prove it — invisible because both files look complete alone. `device-flow-contract.ts:60-62` makes the same kind of delegation. |
| 36 | Gates that gate **twice** | `tests/shared/markers.test.ts` and `tests/architecture/markers-snapshot.test.ts` assert the same two strings; `extension-version.test.ts` and `extension-version-sync.test.ts` overlap the same way — release-checklist sites without added coverage. |

**Reconciling items 23 and the notify backstop.** These are both true and they
describe different surfaces. `catalog-uat.test.ts` **does** byte-gate `notify()`
*the function* for 182 states — which is why the fragment-assertion risk in the
notify-adjacent files is overstated (item 7, check 3). It **does not** exercise
the path production takes for cascade rows, because orchestrators now render
through `notifyWithContext` + per-command `*_RENDER` maps. `shared-notify-c`
closed this by grepping all 20 `notify(` call sites: **only
`edge/handlers/plugin/enable-disable.ts:68` reaches the central switch with a
populated row**, so `notify()`'s cascade arm is production-dead for 18 of 19
plugin statuses. Thousands of test lines across all three notify slices and ~140
catalog examples assert a retired dispatcher. **Both facts stand; the operator
decision below turns on the second.**

## Patterns to propagate

Still the sweep's most useful result: in almost every case the correct form
already exists in-repo, so the fixing pass is propagation, not invention. The
table below is the **corrected** version — refuted rows removed, qualified rows
marked, and confirmed-strong rows added.

### Corrections to the first pass's table

| Row | Correction |
| --- | --- |
| "Injected orchestrator dependency → `orchestrators/plugin/bootstrap.ts`" | **REMOVE `bootstrap.ts`.** It statically imports both orchestrators it composes (`:41`, `:42`); its `BootstrapOptions` carries only `ctx`/`pi`/`cwd`/`gitOps`, and `gitOps` is a platform seam (D-12), not an orchestrator seam. `edge/handlers/plugin/bootstrap.ts:24-27` statically imports it in turn. **The genuine template is `orchestrators/import/execute.ts` (`ImportDeps`, `installPluginFn(deps)` at `:158-227`).** |
| "Strict interaction mocking → `tests/edge/handlers/plugin/**`" | **Narrow to `tests/edge/handlers/plugin/import.test.ts`.** Only 3 of 12 files in that glob use `strong-mock` at all; the other nine cannot, because there is no seam. |
| "Strict interaction mocking → `tests/orchestrators/**` top level" | **Qualify three ways.** (a) `marketplace/add.test.ts`'s `makeCtx` puts `verify()` **inside** the notify stub, so it never fires when fewer notifications are emitted than arranged — six cases carry never-met expectations. **Fix `makeCtx` before propagating anything from this file.** (b) `plugin/info.test.ts` is an explicit **non-reference**: every `verify()` hides in a shared `withHermeticHome` `finally`, and it hand-rolls an `InfoCloneCacheSeam` with a manual counter where a `strong-mock` belongs. (c) `import/execute.test.ts` builds one correct mock at `:389` and hand-rolls seven recorders for the same two collaborators. `plugin/list.test.ts:82-96` and `auth-host.test.ts` *are* genuinely good. |
| "Shared source-scanning helper → 5 architecture files hand-roll their own `.ts` walker" | **Two errors.** `source-scan.ts` exports **no walker** (`REPO_ROOT`, `stripComments`, `assertNoForbiddenSurface`), so the recommendation as written is unexecutable. The count of five belongs to a different duplication — five files hand-roll **`stripComments`**. Restate as: "9 architecture files re-implement one or more of `source-scan.ts`'s three exports; 5 duplicate `stripComments`; **a shared recursive walker with a visited-count guard has to be written, not adopted.**" Add that `assertNoForbiddenSurface` carries a WR-06 fail-on-missing-target guarantee every hand-rolled copy lacks — migrating is a **correctness** fix, not a DRY fix. `source-scan.ts`'s own comment-stripping is never proven (deletable, 4 cases green). |
| "Offline fake that fails loudly → `tests/orchestrators/plugin/fetch.test.ts` — adopt this in the other git fakes" | **The allow-list is a first-class option of the shared fake** (`createGitOpsFake({ allowedRemoteUrls })`, enforced by `requireRemote` at `git-ops-fake.ts:117-121`), not a local invention. Already adopted in `install`, `update`, `reinstall`, `info`, `add`, `import/execute`, `reconcile/apply`. **The real task is auditing which call sites OMIT the option**, which is a much smaller job. Confirmed three times independently. |
| "Planting a real violation to prove containment → `tests/index.test.ts` … every NFR-2 route" | **"Every" is wrong.** Three of the four routes are planted; the fourth (`aggregateDiscoveredResources`) is uncontained in production and unplanted — production bug 2. Reword to "the three contained NFR-2 routes". The Proxy refusal machinery and exact-name `strong-mock` are genuinely strong (9 mutation families caught) and stay in the table. |
| "Shared real/fake adapter contract → `tests/domain/device-flow-contract.ts`" | **Qualify:** model **negative control** (the expected-failure set is exactly right against all ten cases), **incomplete category coverage** — it records only one of six required categories as inapplicable, covers neither overwrite nor deletion, and has no participant inventory. Copy the pattern, not the gaps. |
| "`tests/platform/{git-ops,credential-ops}-contract.ts` also do this well" | **`credential-ops-contract.ts` survives attack and stands. `git-ops-contract.ts` needs a caveat**: sound machinery, incomplete category documentation, and its one delegation (option forwarding) is unfulfilled by the production owner. |
| "`clone-cache.test.ts` vs. its 4 siblings (loose `assert.equal`, ~15 `mkdtemp` directories never cleaned up)" | **The loose-equality half is struck** (see below). The temp-dir half is real but the number is wrong: **53 directories per run from 6 call sites**, not ~15. The accurate sibling-drift claims for this file are: no AAA comments in 32 of 55 cases (siblings at 100%), `void test(` at 55 sites (zero elsewhere repo-wide), `Pitfall:` titles at 3 sites, and no `t.after` cleanup where all four siblings have it. |
| `tests/helpers/` paths in `CONVENTIONS.md` | **The directory does not exist.** CONVENTIONS.md — loaded on every session — cites `tests/helpers/credential-mock.ts` and `tests/helpers/source-scan.ts`; the real paths are `tests/architecture/source-scan.ts` and `tests/platform/*`. Any instruction derived from it about test-support location is wrong. |
| "Move `tests/edge/notification-boundary.ts` to `tests/shared/`" | **STRIKE from the backlog.** It reverses D-117-04/05 (commit `50296404`) and targets a directory the review skill bans. |

### Confirmed-strong patterns to add

| Pattern | Reference implementation |
| --- | --- |
| Mocking a wide third-party host interface with zero casts | `tests/edge/notification-boundary.ts:96-98` (26 consumers; documents *why* an absent expectation, not `times(0)`, is the real zero); `tests/architecture/notify-producer-wire-coverage.test.ts:53-59`; `tests/shared/notify-context.test.ts:111-117`; `tests/orchestrators/plugin/fetch.test.ts:101-118` (with a locally-declared narrow `NotificationUi` type — the reference for the `ctx`-narrowing conversion, and its own sibling `enable-disable.test.ts:45-56` is the counterexample) |
| Interaction proof by expectation cardinality | `tests/shared/notify-context.test.ts:115-117` (`.thenReturn([]).twice()` + `verify(pi)`) — proves a documented once-per-invocation discipline that is otherwise asserted nowhere |
| Whole-message assertion against an **independently maintained document**, gated both directions | `tests/architecture/catalog-uat.test.ts:5228` + `:5374` — stronger than `*.messaging.test.ts` because the expected bytes live in a document maintained for humans (independent parser re-implementation reproduced 182 = 182, no orphans, no duplicates, and all 11 production mutations caught) |
| Whole-message assertion against hand-written strings | any `*.messaging.test.ts` (all 8 plugin ones verified: zero fragments, ~60 hand-written rows, a full 16-line cascade at `reinstall.messaging.test.ts:535-553`); plus `tests/orchestrators/reconcile/apply.test.ts` (49 cases, complete cascade string + severity, in a non-messaging suite) |
| Whole-**file** byte assertion on a generated artifact | `tests/bridges/agents/frontmatter.test.ts:313-479`; `tests/bridges/skills/{frontmatter-degrade,rewrite-frontmatter}.test.ts` (30+ rows byte-for-byte) |
| Whole-**bytes** comparison including the cap boundary | `tests/bridges/hooks/spawn-helpers.test.ts:193-229` (cap-1 and cap exactly) — note the other eight cases in the same file do the opposite |
| Parity proof without two independently drifting literals | `tests/orchestrators/plugin/install.test.ts:1794` (normalize the varying token out, carry a control arm that proves the path was reached); `tests/orchestrators/plugin/update.test.ts:4616` + `:4740-4744` (whole-body literal **plus** row-against-row identity, which catches drift moving two rows the same wrong way) |
| Proving a compile-time type guarantee | `tests/domain/resolver.test.ts:3836-3930` (`satisfies` on both discriminants + **five** `@ts-expect-error` negatives). This is the in-repo answer for the `ScopedLocations` brand and the `requireInstallable` gap — propagation, not invention |
| Bidirectional closed-set pin | `shared/notify-reasons.ts:266-270` (`_ReasonsCoverageProof`); exactness form at `tests/shared/notify-reasons.test.ts:43-48`; enumeration-and-order lock at `tests/architecture/compat-01-no-expansion.test.ts` |
| Boundary predicate pinned from both sides | `tests/domain/name.test.ts:48-133` (`safeNeighbor` — each rejected input paired with an accepted input one character away; it is what catches `code < 0x20` → `code <= 0x20`) |
| Quiet-on-noop proof by inode/size/mtime comparison | `tests/bridges/mcp/unstage.test.ts:297-310` (10 cases) — stronger than "assert the file is unchanged", and several bridges make the same promise |
| Cross-collaborator order proof via one shared log | `tests/transaction/phase-ledger.test.ts` (across ledger phases); `tests/transaction/with-state-guard.test.ts:97-164` (across injected collaborators — a first-pass reviewer mistook this for a hand-rolled double); `tests/shared/fs-utils.test.ts:324-361` (6-entry log proving reverse-order removal, reverse-order restore, and cleanup ordering in one assertion); `tests/index.test.ts` (shared `event.cwd` read counter) |
| Retry / idempotence proof | `tests/orchestrators/plugin/uninstall.test.ts` (order + complete filesystem residue via `retryTree` + convergence, at 13 injection points); `tests/orchestrators/plugin/reinstall.test.ts` `observeReinstallSchedule` (one ordered log across three fs primitives and two collaborators, compared whole in 13 cases); `install.test.ts:3652`/`:3766` (whole-outcome + silence proof + ordered schedule + whole-tree inventory + **idempotence by re-running and comparing state bytes**). **Precondition: item 6 — all three currently buy their power with a builtin-namespace patch.** |
| Silence proof (a module does not touch a port) | `tests/orchestrators/reconcile/notify.test.ts`; `tests/edge/router.test.ts:353` with the written argument at `:8-11` for why `times(0)` will not do; `tests/orchestrators/auth-host.test.ts:75,712,731`; and the non-`strong-mock` form, `assert.deepStrictEqual(notifications, [])`, at 8 sites in `uninstall.test.ts` and 9 in `reinstall.test.ts` |
| Fail-loud fake for a non-git collaborator | `tests/bridges/hooks/dispatch.test.ts:213-226` (`createRecordingExecutor` rejects any unplanned `pluginId`, and three cases rely on that rejection as proof a matcher did not fire); `tests/domain/github-auth.test.ts:60`; `tests/domain/device-flow-contract.ts:113,118` |
| A gate that documents its own positive control — **including when it has none** | `tests/edge/handlers/marketplace/add.test.ts:28-38` (measured: 7 rows go red with the `gitOps` forward deleted) and `update.test.ts:129-153` (measured: it cannot, and says so). The strongest form of "plant the violation" in the sweep |
| Reaching a defensive branch without global surgery | `tests/platform/pi-api.test.ts:247,331` (throwing getter on a **local** fixture object); `tests/bridges/hooks/if-field/glob.test.ts:251-275,704-719` (`Reflect` on case-owned compiled objects); `tests/edge/completions/data.test.ts:307` (legal sparse array through the public parameter) |
| Planting an out-of-band discriminator to prove an `assertNever` arm fires | `tests/shared/errors.test.ts:1420` — **but see item 8's prerequisite**: today the thrown message cannot distinguish which arm fired |
| Network trap declared as a hermeticity device, not an offline proof | `tests/edge/completions/{data,provider}.test.ts` headers — states plainly that it is not an offline proof, that no case asserts a count, and *why* `https.request` and not `globalThis.fetch` is the watched door, with the measurement that settled it |
| Typed `satisfies` stubs imported from the modules production imports them from | `tests/edge/types.test.ts` — the in-repo answer to `marketplace-seed.ts`'s double cast: a seam change becomes a compile error rather than a stale hand-copy |
| Barrel runtime-export-surface pin | `tests/bridges/skills/index.test.ts:40-41,53-63`; alternate form at `tests/bridges/hooks/index.test.ts:29-32`. **3 of 5 bridge barrels have neither** |
| Field-level `readonly` negatives on a type-only module | `tests/bridges/agents/types.test.ts:219-241`, `tests/bridges/mcp/types.test.ts:229-245`. **`commands` and `skills` have only array-mutability checks** |
| Shared boundary factory replacing byte-identical copies | `tests/edge/notification-boundary.ts:1-9` documents WR-08 — four suites carried byte-identical copies and were consolidated; it now has 26 consumers. The repo's own worked precedent for the dominant sibling-drift shape, **and the drift is not finished** (`tools.test.ts:326-353`, `backfill.test.ts:79-94`) |
| Root-uid guard on `chmod`-based EACCES provocation | `tests/orchestrators/reconcile/apply.test.ts:200-206` (explicit `process.getuid() === 0` refusal). One-line copy; many `chmod 0o000`-style cases lack it |
| Mutation-verified pair | `tests/bridges/hooks/async-rewake/ring-buffer` — survives 12 named mutations at 100% branch coverage with one equivalent mutant recorded |
| Closed-set census as a review technique | Extracting a production closed set and diffing it against the corpus found 11 of 44 `Reason` members undocumented in a 4,800-line file that reads as uniformly excellent. Targets: `domain/resolver.ts`'s union and note kinds, `shared/errors.ts` + `errors-bridges.ts`, `shared/notify-reasons.ts` topic groups, `edge/flag-catalog.ts` |
| Table-row census as a review technique | "Delete each row — does a case fail?" found **9 of 25 matchers unreachable** in `stop-failure.ts` under 31 cases that read as thorough. Targets: `hook-tool-names.ts`, `shared/git-failure-classifiers.ts`, `shared/probe-classifiers.ts` |

### The dominant shape: sibling drift — and its intra-file variant

Confirmed as the dominant shape by essentially every area, with one important
refinement: **the drift is very often *within a single file*, sometimes within a
single `switch`, and that variant is invisible to a "compare against the sibling
file" fix strategy.** Instances: `no-credential-leak.test.ts:43` uses
`access_token` while the same file's six other scans use `access_?token`;
`notify-grammar-invariant.test.ts:458` guards a loop its two structural twins
200 lines away do not; `install.test.ts` holds the byte-exact form at six sites
and fragments a few hundred lines away; `deriveSourcePluginRoot`'s three result
arms assert their note in two of three; `spawn-helpers.test.ts` compares whole
bytes in two cases and decodes in eight; `dispatch.ts`'s `reduceBucket` has the
`assertNever` default its three sibling switches omit; `errors.ts` disagrees with
itself (three classes freeze a defensive copy, three alias the caller's array).

Two consequences:

- **Convert weak cases to the strongest form already in the same file *before* any
  module split**, or the split separates the strong and weak cases for the same
  contract into different files and hides the drift.
- **Before normalizing a divergent file, check which side is right.**
  `user-prompt-submit.test.ts` is the only one of ten payload tests pinning JSON
  key order — and key order is a real wire contract (`spawn-helpers.ts:67`), so
  the outlier should be propagated to nine siblings, not normalized away. The
  first pass filed it as a refactor candidate.

## Struck findings and spurious classes

**Delete these from the backlog and from the finding vocabulary.**

1. **"Loose `assert.equal` / `assert.deepEqual`" — SPURIOUS repo-wide.** Eight
   independent confirmations, re-verified during consolidation:
   `grep -rl 'from "node:assert"' tests/` returns **0** files;
   `grep -rl 'from "node:assert/strict"' tests/` returns **261**. Under
   `node:assert/strict`, `equal` **is** `strictEqual` and `deepEqual` **is**
   `deepStrictEqual` — the same function object. **Every finding whose stated
   defect is assertion looseness is a naming nit with zero behavioral risk.**
   Named carriers to correct: this document's own `clone-cache.test.ts` bullet;
   `adversarial/architecture-boundary-gates.md:613`, which grades the class
   **CONFIRMED** (29 sites) and is overridden by this ruling;
   `adversarial/architecture-notify-gates.md:175`, which already grades it
   REFUTED with the correct mechanism (no correction needed there — it is the
   reference grading); four findings in
   `orchestrators-marketplace-rest`, and 36 of 40 sites attributed to
   `install.test.ts`'s "weak era". A fixing pass told to hunt loose equality will
   waste its budget.
2. **"`catch (error: unknown)` is house style" — a false-convention artifact in
   five area files.** `grep -rn "catch (error: unknown)" extensions` returns
   **0**; `grep -rn "catch (err)"` returns **191**; `CONVENTIONS.md` contains no
   catch-binding rule at all, and `useUnknownInCatchVariables` already types the
   binding `unknown` under `"strict": true`. `adversarial/bridges-hooks-adapters-state.md:159`
   asserts CONVENTIONS.md documents it, which is false. The rule *is* in the
   google-style skill, so it is a legitimate **one repo-wide style decision
   affecting 191 sites** — not a per-file WARNING. Re-grade all five carriers
   OVERSTATED.
3. **Item 1's causal claim ("no test can construct a full SDK object")** —
   refuted five times; see item 3a.
4. **"`routing-state.ts`'s doc comment actively misdescribes"** — struck; three
   confirmations, replacement wording given in item 5.
5. **"`bootstrap.ts` is the injection template"** — refuted; see Patterns.
6. **"NFR-10 path containment is thoroughly tested"** — moved out of the
   falsified-hypothesis list; see the NFR-10 section.
7. **"Direct per-pair coverage was never measured"** — contradicted; see Known
   gaps.
8. **`bridges/mcp`'s first-pass `sourcePath`-fallback BLOCKER** — misdiagnosed:
   the branch is unreachable (all three call sites pass it). Production dead code,
   not a missing assertion.
9. **Both first-pass BLOCKERs in `bridges-agents`** — rest on refuted mechanisms
   (`stage.test.ts:1383` kills the claimed mutation; `finalizeAgentsReplacement`
   has no force branch).
10. **Both first-pass BLOCKERs in `orchestrators-reconcile-notify`** — one refuted
    outright (`reasonAsContent` is covered at `notify.test.ts:484`, in the very
    block the finding claims to have searched), one half-refuted
    (`backfill.ts:440`'s validator branch is unreachable through the public
    surface, so the prescribed case cannot exist).
11. **Two of three first-pass reinstall BLOCKERs** — attributed to a
    `reinstallSummary` symbol that does not exist. The `GAP-12` and `GAP-14` fix
    instructions are also **wrong as written** (`GAP-12`'s `assert.match` would go
    red; `GAP-14`'s rationale is wrong twice).
12. **`marketplace-seed.ts`'s double cast: BLOCKER → WARNING** (see Calibration).
13. **The `{ cause }` options-bag fix is a measured regression** wherever the class
    also declares `override readonly cause`. Under Node's type stripping the class
    field re-initialises `cause` to `undefined` after `super()` returns;
    `declare override` is a syntax error and dropping `override` fails
    `noImplicitOverride`. Two production classes carry the shape
    (`shared/completion-cache.ts:154-161`,
    `orchestrators/reconcile/apply-outcomes.ts:405-410`). **Any area file
    prescribing the options-bag form must be read as "delete the field declaration
    first".** The first pass prescribed exactly this fix in `edge-completions`.
14. **`env = process.env` as a parameter default** — the first pass's proposed fix
    for one shared-core finding violates the skill's own live-boundary rule. And
    its EISDIR-unlink assertion is Linux-only.
15. **The resolver `/dev/null` finding is mis-severed** — it is a `stat` of a fixed
    path, not a hermeticity break, and the proposed remedy would delete the only
    cover of `defaultStatKind`'s neither-arm.
16. **`domain/components/hooks/matcher.test.ts`'s Set-order BLOCKER → WARNING** —
    `piTools` order is not a contract; the only consumer calls `.has()`.
17. **`module-scope void (satisfies T)`** is established convention
    (`index.test.ts:29-72`), not a finding.
18. **The 31 `CLOSED_VOCAB.has(...)` runtime assertions in the stop-failure tests**
    duplicate a guarantee `hook-events.ts:195-198` states is already enforced at
    compile time — 31 lines of maintenance, zero discrimination. (The repo's own
    "don't test what a gate already guards" lesson.)
19. **`compat-01-no-expansion.test.ts`'s "model for the rest of the area" verdict**
    holds, with two one-line staleness edits owed (`:56-58`, `:219`).

## Calibration rulings

Severity was reserved to consolidation. These are settled; do not re-litigate them
per area.

- **Injection seam, 6 BLOCKERs vs 1 grouped WARNING** — **granularity, not
  severity.** One WARNING-tier design ticket over 17 modules, ranked high on
  leverage. Escalate individual members to BLOCKER only where the missing seam
  causes an ownership violation (the calibration rule from `transaction`). See
  item 4.
- **`marketplace-seed.ts:95`'s double cast — WARNING, not BLOCKER.** `saveState`
  runtime-validates against `STATE_VALIDATOR` and throws
  (`persistence/state-io.ts:486-491`, verified), so a wrong shape cannot reach
  disk silently; it surfaces as a runtime throw at seed time. The cast strips
  *compile-time* checking only. **Keep the priority high** on blast radius: 8 of
  12 plugin-handler suites and 5 of 7 marketplace-handler suites route every
  fixture through it, underneath the primary assertion of ~70 cases. In-repo
  answer: `tests/edge/types.test.ts`.
- **`notify.ts`'s wide parameters — WARNING, not BLOCKER**, and moved down the
  sequencing. The de-casting work is unblocked today (item 3a); the narrowing is a
  design improvement (item 3b).
- **The hooks-schema gate severity disagreement — RESOLVED, remove from
  Decisions.** Both reviewers' facts hold. It is not a standalone severity vote: it
  is one instance of a repeatable post-split failure mode with at least three
  siblings from the same commit (the HOOK-03 rationale still lives in the old file;
  `HOOKS_CONFIG_SCHEMA`'s only cases stayed in an architecture test rather than
  moving to the new module's pair; the `NON_TOOL_EVENT_CLOSED_SETS` completeness
  invariant that makes `partition.ts:55`'s cast safe is invisible from the file
  that depends on it). **Convert it into a post-split checklist** (below) applied
  to all six proposed splits. The single rewrite through `assertNoForbiddenSurface`
  over **both** files is the right fix, not a path-string edit.
- **`platform.md`'s tally is superseded** (1/9 → roughly 5/21 with one original
  re-scoped); **`root-index.md`'s** is 0/3 → roughly 6/5; **`transaction.md`'s** is
  1/6 → roughly 4/12.
- **General:** per-area severity was never globally calibrated and the bias is not
  uniformly toward under-rating — it tracks whether the reviewer checked the
  consumer. `domain-components-hooks` recorded one BLOCKER that should be a WARNING
  while missing two real ones. **Do not average severities across files, and do not
  sort the backlog by severity alone.**

## Decisions the fixing pass cannot make

Escalate all of these before work starts.

### 1. Unreachable branches, prototype surgery, and their several resolutions

The first pass framed this as a binary over four files. **Both halves are wrong.**

**The file list is wrong and must be re-derived by grep, not copied.**
`bridges/hooks/if-field/{bash,glob}.test.ts` do **not** patch prototypes —
`bash.test.ts` contains no `prototype`, `t.mock`, or `Reflect` at all, and
`glob.test.ts`'s `Reflect` use is on case-owned objects and is the **good**
pattern. The actual patcher in that directory is `if-field/index.test.ts`
(`String.prototype.endsWith`, `RegExp.prototype.exec`). The real set is at least
eight files and includes two that were reported **clean**:
`bridges/commands/{stage,discover}.test.ts`, `bridges/hooks/if-field/index.test.ts`,
`bridges/skills/{frontmatter-degrade,rewrite-frontmatter}.test.ts` (`String.prototype.split`,
both clean-listed), `bridges/agents/frontmatter.test.ts:281-291` (**`Object.prototype`
pollution**, not merely replacement), `shared/notify.test.ts:6250`
(`String.prototype.lastIndexOf`), `edge/completions/normalize.test.ts`,
`orchestrators/marketplace/add.test.ts:1503,1561` (`Symbol.hasInstance` returning a
rotating prototype), `orchestrators/marketplace/remove.test.ts`. Repo-wide,
`Object.defineProperty` counting getters appear in **16** files.

**The binary framing is unexecutable.** Cases split at least five ways, and each
wants a different answer:

| Sub-class | Answer | Instances |
| --- | --- | --- |
| (a) Genuinely dead defensive code | Delete production line **and** case; no decision needed | `commands/discover.ts:178`'s `?? ""`, `commands/stage.ts:204`, `:102-111`; `marketplace/remove.ts:468-471`'s `: undefined` arm (**resolved**: `state-io.ts:326-365`'s `normalizeStoredSource` throws for any stored kind outside `{path, github, url, unknown}` and `tx.state` always arrives via `loadState`, so it is unreachable by real input — the first pass's "seed a future kind" fix provably does not work); `if-field/index.ts:282-287` and `:295-300` (provably unreachable by well-typed input); `edge/handlers/marketplace/update.ts:41` (the test **measured and documented** its unreachability in 19 lines instead of deleting it, and two sibling files already show the removed form); `domain/resolver.ts`'s four dead regions (`addUnsupportedKindNotes`'s `dirty` return, five `...partial.notes` spreads, `ifCtx`, `noopCompileIf` — **none is propped up by any test**; ordinary deletions the fixing pass can make without escalation) |
| (b) Compiler-forced narrowing (D-116-01a) | The production line **cannot** be deleted; only the case is in question | `commands/discover.ts:288-290` (`instanceof` narrowing for `badNameWarning(err: CommandNameError)` — deleting it breaks the build); the `bridges/skills` instances (forced by `noUncheckedIndexedAccess`, so "delete the dead branch" is unavailable there); `edge/handlers/shared.ts:53-55`, handled correctly and honestly at `shared.test.ts:18-23` |
| (c) Reachable without lying | Rewrite the case the hard way | `commands/stage.test.ts:659-672`, `:993-1009` — both drivable by a real filesystem obstruction the way `unstage.test.ts:213` does |
| (d) **Artifact of an over-wide exported signature** — a *third reading* the first pass does not have | **Narrow the signature; branch and test both disappear, no judgment call** | `edge/handlers/tools.ts::projectRowStatus` declares 19 status arms where its only call site can pass 10; nine surplus arms and nine propping-up cases exist purely because the export is wider than the caller. **Test the prototype-surgery files against this reading first — some may just be over-wide signatures.** Same shape at `domain/components/hook-events.test.ts:103-118`, where widening the parameter to `string` makes the cases legitimate *and* matches how two production call sites already use the function |
| (e) **Reachable through public behavior after a small restructure** — a *fourth* option | Restructure so the branch is genuinely reachable, which is what the guidelines actually ask for | `bridges/agents/frontmatter.test.ts:278-310` (`FoldState.foldedValue` disappears), `convert.test.ts:498-538` (`mapTools` returning `sourceLabel` makes it reachable) |

**Two new sub-classes to fold in**, both with the same decision and different
blast radius:

- **Monkeypatching a production module singleton.** Three instances in
  `persistence` alone (`config-io.test.ts:269`, `state-io.test.ts:856-857,884`,
  `agents-index-io.test.ts:437`), all `t.mock.method(<TypeBox JIT validator>,
  "Errors", () => [])` to reach a `(no detail available)` fallback that is
  demonstrably unreachable (`Compile(...).Errors(v)` cannot be empty when
  `Check(v)` failed). Every `export const X_VALIDATOR = Compile(X_SCHEMA)` plus a
  private `first…ErrorDetail` fallback is a candidate.
- **Getter-based discriminator mutation.** `tests/shared/notify.test.ts:91-104`
  builds an object whose `kind` getter returns a different value on each read, so
  a message is one variant when `notify()` narrows it and another when
  `computeSeverity` re-reads it; the same trick is applied to `plugin.status` at
  `:6317-6324`. Six cases depend on it, two on undocumented read-counts derived
  from comparison order inside `isInfoKind`. **It leaves no global side effect, so
  grepping for `prototype` will not find it** — grep `Object.defineProperty(` in
  test files.

**Two instances that need the decision without any surgery at all:**
`async-rewake/registry.ts:370`'s `exitOutcome ?? { code, signal }` and
`pid-table.ts`'s three `assertPathInside` calls (documented as defense-in-depth in
the file's own header), both green when deleted. Same for
`shared/fs-utils.ts:311-312`, reachable only by passing a dirent from a different
directory. These are the cleanest test of the underlying question.

**Start from the existing framework.** `.planning/WINDOWS.md` holds a formal,
ratified seven-entry D-116-01a ledger (entries 15-19, 21, 22), which bans coverage
pragmas outright and carries a written argument per entry. **Entries 21
(`edge/args.ts:34`) and 22 (`edge/handlers/shared.ts:53`) are misclassified as
COMPILER-FORCED**: both are `while (i < tokens.length)` index loops over densely
built `string[]`s, and a `for…of` plus one small state flag removes the guard with
no assertion and no behavior change. The other five look genuinely forced. Route
the operator decision **with the ledger**.

**A related, separate call:** *is defence-in-depth re-validation exempt from the
100%-branch rule?* `ARCHITECTURE.md` endorses the pattern ("re-validated
defensively at consumption sites even after an earlier validation pass") while the
testing guidelines forbid uncovered branches. That governs far more than the two
`reconcile` sites that raised it.

### 2. Module splits — and the post-split checklist that must ride with them

Six modules drew split recommendations with named seams: `domain/resolver.ts`
(6 responsibilities), `shared/notify.ts` (**4,217 lines**, not 4,039 — three
independent `wc -l` confirmations; `ARCHITECTURE.md` carries the same stale
figure), `orchestrators/plugin/{install,update,reinstall,info}.ts` (7k-9.4k test
lines each), plus `tests/architecture/catalog-uat.test.ts` (5,442 lines →
parser + fixture modules + driver — **20 sections, not 18**).

**Five sequencing constraints, each of which invalidates a naive split order:**

1. **`catalog-uat.test.ts`'s split and its render-path fix are ONE change**, and
   the render-path fix defines the split's interface (the fixture modules carry
   per-command context, so a section→emitter table is part of the split). Splitting
   first means writing 20 fixture modules against the wrong seam and rewriting them.
2. **`domain/resolver.ts`'s three one-line BLOCKER fixes come first**; moving 2,500
   lines first turns them into three merges into three new files.
3. **`install.test.ts`'s assertion conversion comes first** — the strong and weak
   cases for the same contract currently sit in one file and the split would
   separate them.
4. **`reinstall.test.ts`'s seven duplicate pairs come first** — deleting four cases
   removes ~330 lines and makes the seams obvious. (New class: **"superseded
   chapter" duplication** — one file containing two generations of its own test
   strategy, 2,000 lines apart, where the later chapter asserts a strict superset.
   Locate others with `grep -rln "retry proof" tests/`.)
5. **A split adds a named seam to `install.ts` the first pass missed**:
   `makeInstallCloneProbe` + `deriveInstallVersion` (`install.ts:549-647`) →
   `install-clone-probe.ts`. It has no dependency on the ledger, the lock, or the
   state snapshot, and extracting it converts eleven disk-backed end-to-end cases
   into stub-seam unit tests.

**Post-split checklist (mandatory, derived from the `73d9c8b4` casualties).** After
any module split, re-point: **(a)** every source-scanning gate that names the old
path; **(b)** every doc comment describing a literal that moved; **(c)** the test
ownership of every export that moved; **(d)** every completeness invariant that a
cast in the *old* file depends on. The hooks-schema split produced at least four
casualties on these four lines, and the six proposed splits will manufacture the
same class unless the checklist is applied as they land.

**One blocker for a prescribed fix.** `HOOK_ENTRY_SCHEMA`'s static type rejects the
unknown group-level fields its runtime schema accepts (verified with `tsc`), so
"append `satisfies <Type>`" is **unexecutable** for lenient rows. Check every
instruction to add `satisfies` against a TypeBox-derived type.

### 3. `apply.test.ts`'s deliberate deviation — and a second member

`orchestrators/reconcile/apply.test.ts` uses real orchestrators instead of
`strong-mock`, documented as D-115-03, and demonstrably catches the
parameter-threading bugs it exists to catch. **Do not "fix" this into
conformity.** Independently re-confirmed from a second angle: the
`createNotificationBoundary` sizing means a dropped
`notifications: { mode: "orchestrated" }` on any of the five orchestrator calls
throws at the call site rather than being counted afterwards, and the DFEN-04/05
pair really does catch two option-threading bugs.

**Add `tests/orchestrators/plugin/bootstrap.test.ts` to the same list.** It cites
D-115-03 in its own header and drives the real `addMarketplace` +
`setMarketplaceAutoupdate` against a case-owned temp tree with only the git remote
faked; its per-case assertion set (complete notification list + complete state +
complete config bytes + complete scope tree) is what makes the deviation pay.

### 4. `notify()`'s cascade arm is production-dead — decide before any case rewrite

All 20 `notify(` call sites were grepped. **Only
`edge/handlers/plugin/enable-disable.ts:68` reaches the central `renderPluginRow`
switch with a populated row**; production renders the other 18 of 19 plugin
statuses through per-command `*_RENDER` maps. Thousands of test lines across three
`shared/notify` slices and ~140 catalog examples assert a retired dispatcher, and
`notify.ts:2013-2022`'s comment names the wrong surviving caller (which is how ~60
cases accumulated on a path with one production arm). Two "SOLE composition site"
claims in the same file are already false in the other direction —
`partiallyInstalledRow` (`notify.ts:2246`) is bypassed by `list.messaging.ts:124`
(**and that surface's own test pins the divergence**), and `installedLikeRow`
(`:2287-2299`) is not called by `renderPluginRow`'s `installed`/`updated`/
`reinstalled` arms, each of which inlines its own `joinTokens([...])` block.
`reconcile.messaging.ts:182-190` re-inlines `renderUninstalledRow` while both
siblings call it.

**The decision:** retire the central switch and re-point the catalog gate at the
production seam, or restore the D-11 "call, never duplicate" contract by making
the render maps call the composers. **Either answer changes what a large fraction
of the notify and catalog test corpus should assert, so it must be settled before
any of that corpus is rewritten.** Whichever is chosen, add one architecture case
that renders each shared status through **both** the command map and
`renderPluginRow` and compares the strings.

### 5. CR-01 / P-1 — the reconcile plugin-tier dead end

Three viable fixes with different user-visible semantics: resolve plugin keys
through the claim map, record marketplaces under the declared key, or reject the
alias at add time. **Confirm with a fixture first** (see production bug 12). Not a
test finding; the fixing pass cannot settle it.

### 6. OUT-07 cardinality — one design question, asserted in ~40 places

Of ~40 `notifyWithContext` call sites repo-wide, exactly **three** pass a
`cardinality` (`import/execute.ts:1204`, `plugin/fetch.ts:194`,
`plugin/reinstall.messaging.ts:199`). Every other bulk surface omits it while
several of their headers claim Plural, and `composeTally` (`notify.ts:3141`)
returns `""` without it. Consequence: **`Messaging.label` is unread on all of
them, so every `*.messaging.test.ts` label assertion pins a value no user-visible
byte depends on.** Settle once, centrally.

### 7. Builtin-namespace patching (item 6) — its own operator call

Distinct from the prototype-surgery decision, five independent confirmations of
the 13-file count, and it gates propagation of the repo's best test technique.

### 8. `makeMock*` naming — an unresolved convention conflict

`CONVENTIONS.md` records "Mock factories use `makeMock*` prefix"; the unit-testing
skill says a double is "named for its role only — no `mock`/`fake`/`stub` in the
name". `makeMockGitOps` / `makeMockCredentialOps` / `makeMockDeviceFlowHttp` all
return **fakes**, so the name is doubly wrong under the skill. ~9 files. Settle
before any renaming pass.

### 9. Turning on `test:coverage:direct` — its own workstream

The one-line change (`hit === found` already enforced) will go red broadly. Decide
whether it lands as a pre-commit hook on changed pairs, a CI job, or both, and
budget the triage.

## Suggested sequencing

Steps 1-9 are production changes that make step 10 smaller. Doing 10 first means
redoing it.

1. **Fix the `mcp.json` crash** — with the type-level fix (item 11), not the
   two-site patch. Shipping bug, independent of everything else.
2. **The NFR-10 containment cluster**, starting with `assertPathInside` — it is
   the chokepoint the other five findings assume works.
3. **The remaining production bugs** in the table above.
4. **Decide operator items 1-9.** They gate what follows.
5. **Two small production edits with the largest test-side payoff**: the
   `git-ops-fake` `structuredClone` fix (item 1) and the `getAgentDir` parameter
   narrowing (item 2).
6. **Fix `assertNever` to throw a typed, discriminating error** — prerequisite for
   the exhaustiveness work and for nine existing cases to mean anything.
7. **Do the module splits**, with the post-split checklist and the five sequencing
   constraints.
8. **Add the injection seams** (item 4), back-filling the orchestrator pairs first.
9. **Convert module-global state to factory-owned**, starting with `settle.ts` +
   `completion-cache.ts`; retire the builtin-namespace patching by flipping the
   production import style first (item 6).
10. **Then the test-level work** — de-cast via the boundary factories (item 3a),
    fragment assertions with all three gating checks (item 7), exhaustiveness
    triaged per switch (item 8), the duplicated helpers (item 12), ordering
    fixtures, and the sibling-drift propagation.
11. **Separately and in parallel: the gate audit** (with the acceptance criterion),
    and wiring `test:coverage:direct` into the chain.

## Known gaps in this sweep

State plainly rather than assume clean.

- **Direct per-pair coverage HAS been measured — the first pass's claim to the
  contrary is contradicted by an artifact in the tree.**
  `coverage/all-pairs-report.ndjson` holds **204 rows: 190 `complete`, 7
  `type-only`, 7 `accepted-shortfall` with `exitCode: 1`**. **All seven shortfalls
  are in `edge/`**: `edge/args.ts`, `edge/completions/{data,provider}.ts`,
  `edge/handlers/marketplace/update.ts`, `edge/handlers/plugin/{import,pending}.ts`,
  `edge/handlers/shared.ts`. Regenerate with
  `npm run test:coverage:direct:report`. Every coverage claim in every area file
  can now be checked against measurement.
- **Coverage is not a substitute for the mutation questions, and the sweep
  produced four independent proofs of that.** 100% branch coverage would not have
  caught either BLOCKER in `orchestrators-plugin-install-a`; `domain/resolver.ts`'s
  six surviving mutations all sit on always-executed code; `execute.ts:742`'s
  `||=` reports both arms hit while the mutation survives; and
  `phase-ledger.ts` holds both arms of all ten branches while its AS-4
  prepend-to-index-0 ordering rule survives inversion and a dropped `await` at
  `with-state-guard.ts:72` creates no branch at all. **A green direct-coverage run
  is not evidence that combinations, orderings, or `await` placement are tested.**
  A related structural blind spot: **same-typed straight-line wiring** reads 100%
  and proves nothing — `register.ts:79-98` maps 19 keys to 19 values of one type
  (swaps compile; enable/disable differ by a boolean; 15/15 branches green), and
  `install.ts:1260`'s five-element `Phase<C>` array has the same property.
- **Integration, e2e, and live-uat suites were still not reviewed.** They fall
  outside the `npm test` glob. Two live escapes were nonetheless found from inside
  the unit suite: a **real network call** (an `Orchestrated-PI-4` fixture in
  `install.test.ts` parses as installable, issues a real clone probe, and passes
  because the remote 404s) and ~17 `bridges/mcp/stage.test.ts` cases that read the
  developer's real `~/.config/mcp/mcp.json` and `~/.pi/agent/mcp.json` (the
  latter cluster is owned by leverage item 2's `homedir()` extension, not here).
- **Clean verdicts have now been attacked and mostly overturned** — but the
  adversarial pass introduces its own unfalsified negatives, and it named four
  distinct forms the brief did not anticipate: an area with an *empty* clean list
  is no safer (the unfalsified negative is the reviewer's attention); a first-pass
  **Summary sentence** ("Structurally the suite is sound") is a third class; an
  **inline reassurance** ("otherwise this file is strong") is a fourth; and inside
  a single 5k-9k-line file, the **cases the reviewer did not name** are the
  unfalsified negative. One usable triage signal: **where an area's findings are
  dominated by a single cosmetic class, treat its clean list as unreviewed rather
  than merely unverified.**
- **A partition boundary manufactures false positives as well as false negatives.**
  Two mutations raised in `info-a` were killed by reading outside the slice.
- **`_AUDIT.md` and `_CLEAN-LIST-REPAIR.md` both predate this pass** and need
  regeneration.

## Notes on the method

- **Reviewing production alongside tests was worth it, and this pass raised the
  return.** Fourteen production bugs, the highest-leverage fixes, and the NFR-10
  cluster all came from reading the production branch against the test inputs. A
  test-only sweep would have produced a long list of assertion warnings and missed
  every cause.
- **Mutation testing beat reading, decisively.** Almost every new BLOCKER is a
  named surviving mutation. In `bridges-hooks-if-field`, the first pass recorded
  *zero* clean files and wrote 14 findings — not one of which names a surviving
  mutation — and the second pass still found 5 BLOCKERs in files it had already
  opened. **A file with findings recorded is not thereby a file whose behavior was
  probed.**
- **Executing a throwaway probe was the highest-yield technique.** Re-implementing
  a test's parser offline and running five mutations against the real corpus turned
  three "looks fine" guards into measured survivors in about ten minutes; a
  19,531-input brute force settled a partition contract; a closed-set census found
  11 of 44 undocumented `Reason` members that reading found nothing about; a
  table-row census found 9 of 25 dead matchers under 31 thorough-looking cases.
- **Comments in this repo are leads, never evidence.** They drift in at least six
  directions: falsely claiming production use; honestly admitting test-only status;
  describing a mechanic a later decision replaced; naming a gate, test file, or
  caller that does not exist; asserting a compile-time guarantee stronger than the
  code provides; and being *correct* about near-death while naming the wrong
  surviving caller. Two comments in the tree state **opposite filesystem facts**
  about `readdir({withFileTypes:true})` and symlinks (`bridges/skills/discover.ts:172`
  vs `shared/fs-utils.ts:293` — `fs-utils` is right, and the other would mislead a
  future editor into deleting the guard that works). **Grep the call graph.**
- **Falsified hypotheses, updated.** Still falsified: `auth-host.ts` has no leaking
  module-level memo (re-verified from source — `authMemo` is a member of
  `buildAuthForHost`'s argument object, read and written only through the returned
  closure); the lock-reentrancy contract *is* covered by a dedicated CR-01 case;
  `domain/manifest-cache.ts` is genuinely factory-owned with no reset export.
  **Now qualified:** `plan.ts` purity is genuine but purity was the *only* thing
  verified about the planner (five diff-logic holes behind it); "the resolver has
  no hook-only coverage" is **refuted** (`resolver.test.ts:229`, `:3034`, and a
  `@ts-expect-error` at `:3870` — the first pass grepped identifiers the real cases
  do not use). **Now struck:** NFR-10 containment (see that section).
- **Briefing reviewers with named suspicions again produced clear confirmations and
  clear refutations rather than vague reassurance**, in both directions — which is
  the strongest argument for repeating the adversarial pass on the integration,
  e2e, and live-uat suites that this sweep never touched.
