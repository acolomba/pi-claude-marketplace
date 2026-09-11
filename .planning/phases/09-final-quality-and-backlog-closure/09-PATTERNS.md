# Phase 9: Final Quality and Backlog Closure - Pattern Map

**Mapped:** 2026-09-11
**Files analyzed:** 12 (1 production module + 2 production wiring files + ~31 test files + 6 planning/script artifacts)
**Analogs found:** 11 / 12 (one acknowledged gap — see "No Analog Found")

This phase is one production change plus a documentation-and-seal sweep. The pattern
work that matters is §"Pattern Assignments / A. The read port"; the documentation
sections name an existing artifact to copy rather than a format to invent.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` | bridge (hooks) | file-I/O behind an injected port | `extensions/pi-claude-marketplace/shared/fs-utils.ts` (`RemovalOps`) | exact — same kind of port, same "no default" rule |
| `extensions/pi-claude-marketplace/bridges/hooks/index.ts` | barrel | — | itself (already exports `HooksHydrationReader`) | exact |
| `extensions/pi-claude-marketplace/index.ts` (lines 37, 40) | composition root | request-response wiring | `orchestrators/plugin/install-flow.ts:223` (`removalOps: createRemovalOps()`) | exact |
| `tests/index.test.ts` (787-793) | test (source-text gate) | transform | itself — the literals are the fixture | exact |
| `tests/architecture/hooks-lifecycle.test.ts` (281, 395-408) | test (source-text gate) | transform | itself | exact |
| `tests/bridges/hooks/event-router.test.ts` (+ 30 other test files) | test (owner) | file-I/O via fake | `tests/platform/removal-ops-fake.ts` / `git-ops-fake.ts` | role-match (see caveat in A.5) |
| `.planning/REQUIREMENTS.md` | doc (spec carrier) | transform | its own `## Evidence and History` (121-139) | exact |
| `scripts/revalidation.mjs` (`SEALED_REQUIREMENT_ROUTES`, ~93) | config (sealed table) | transform | entries already in the same object literal | exact |
| `.planning/WINDOWS.md` | doc (ledger, JSON-backed) | transform | entry 31 in its own fenced JSON | exact |
| `.planning/BACKLOG.md` | doc (register) | transform | `HKNC-01` (1930) and `SEV-01` (2050) | exact |
| `.planning/phases/09-.../09-CLOSURE-LEDGER.md` | doc (new artifact) | transform | `.planning/phases/07-gate-integrity/07-FINDING-DISPOSITIONS.md` | role-match, not exact — see notes |
| `CONTRIBUTING.md` | doc | — | no change expected (RESEARCH §3.5: already correct) | n/a |

All analog paths above are git-tracked source (`git ls-files` verified). No gitignored
mirror path appears anywhere in this file.

---

## Pattern Assignments

### A. `bridges/hooks/event-router.ts` — the injected read port (D-09-05, D-09-08)

#### A.1 Primary analog: `RemovalOps` — the repo's existing filesystem port

**Analog:** `extensions/pi-claude-marketplace/shared/fs-utils.ts`

This is the closest analog in the tree and a better one than `HooksHydrationReader`,
because it is a *filesystem* port (not a state-reader), it is threaded through a long
chain of private functions exactly as `readHooksJson` must be, and its header already
argues the two design questions D-09-08 has to answer: how wide the port is, and whether
it may be defaulted.

**Interface declaration** (`shared/fs-utils.ts:58-80`):

```ts
/**
 * The removal port: the two destructive filesystem verbs the staging and
 * replacement lifecycles traverse, behind one substitutable object.
 *
 * Two members and no more (D-08-13). Widening this into a general filesystem
 * facade would put every verb in this module behind a seam nothing asked for;
 * `pathExists`, `removeOrphanIfPresent`, `readDirEntriesTolerant`, and
 * `isPlainMarkdownFile` keep calling `fs` directly.
 */
export interface RemovalOps {
  /**
   * RCOV-02: remove `target`. Carries every cleanupStaging removal and every
   * replacement removal in `rollbackReplacementCommon`, so a caller can fault
   * one staging root while its siblings succeed.
   */
  rm(target: string, options: { recursive?: boolean; force?: boolean }): Promise<void>;
  /**
   * RCOV-02: move `from` onto `to`. Carries the backup-restore stage of
   * `rollbackReplacementCommon`, which is the second of the three stages that
   * accumulate leak messages.
   */
  rename(from: string, to: string): Promise<void>;
}
```

**The real implementation factory** (`shared/fs-utils.ts:82-92`):

```ts
/**
 * The real removal operations: thin bindings to `fs.rm` and `fs.rename` and
 * nothing else. Construction performs no filesystem work; only the operations
 * do.
 *
 * Called by the composition roots -- the orchestrators that own a staging
 * lifecycle -- never by a bridge, and never defaulted into a parameter
 * (D-08-12).
 */
export function createRemovalOps(): RemovalOps {
```

**The module header stating the no-default rule** (`shared/fs-utils.ts:18-30`, excerpted):

```
//   - RemovalOps / createRemovalOps: the injected `rm` + `rename` port the
// RCOV-02 / D-08-12, the port's one deliberate asymmetry: RemovalOps is the
// no DEFAULT_REMOVAL_OPS and no `?`, and the composition roots supply it.
```

**Threading style — positional parameter named `ops`, repeated down the chain**
(`bridges/skills/stage.ts:164, 325, 386, 402, 479, 497, 524`; the same shape recurs in
`bridges/agents/stage.ts` and `bridges/commands/stage.ts`):

```ts
  ops: RemovalOps,
```

**Construction at composition roots** (`orchestrators/plugin/install-flow.ts:223`,
`enable-disable.ts:329`, `marketplace/add.ts:555`, `plugin/clone-cache.ts:178/260/475`,
`update-swap.ts:1011`, `reinstall-replace.ts:207`):

```ts
    removalOps: createRemovalOps(),
```

**What the planner should take from it:**
1. Declare the port with a doc comment that says how wide it is and why it is not wider.
2. No default value, no `?`, no `DEFAULT_*` constant — the composition root supplies it.
   `05-06-SUMMARY.md:113` already fixed this same rule for `createHooksRouting`'s runtime.
3. Cite a durable ID (`D-09-05` / `RCOV-02`), not a phase number, per CONVENTIONS.md.
4. `createRemovalOps` lives in `shared/`, a leaf — but that is because six orchestrators
   share it. The hooks read port has exactly one consumer module, so RESEARCH §2.6
   option 1 (declare it in `event-router.ts` beside `HooksHydrationReader`) is the
   analogous placement, not a new file.

#### A.2 Secondary analog: the established `HooksHydrationReader` shape, in this very module

**Analog:** `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:421-424`

```ts
/** Required persisted-state operation for hooks hydration. */
export interface HooksHydrationReader {
  readonly loadState: (extensionRoot: string) => Promise<ExtensionState>;
}
```

**Factory signature** (`event-router.ts:944-949`):

```ts
/** Binds every hooks hydration path to one runtime and one required state reader. */
export function createHooksHydration(
  runtime: HooksRuntime,
  reader: HooksHydrationReader,
): HooksHydration {
  const routingState = createRoutingStateOperations(runtime);
```

**The sibling factory that has no reader today** (`event-router.ts:279-281`):

```ts
/** Bind install/uninstall route effects to an explicitly supplied runtime owner. */
export function createHooksRouting(runtime: HooksRuntime): HooksRouting {
  const routingState = createRoutingStateOperations(runtime);
```

**Construction site — the real implementation** (`extensions/pi-claude-marketplace/index.ts:36-40`):

```ts
export default async function claudeMarketplaceExtension(pi: ExtensionAPI): Promise<void> {
  const hooksRuntime = createHooksRuntime();
  const hooksRouting = createHooksRouting(hooksRuntime);
  const completionCache = createCompletionCache();
  const pluginUpdateOperations = createPluginUpdateOperations(hooksRouting, completionCache);
  const hooksHydration = createHooksHydration(hooksRuntime, { loadState });
```

Note the construction is an **inline object literal** (`{ loadState }`), not a factory
call. That differs from the `createRemovalOps()` pattern. Both forms exist in the tree;
the planner should say which one `index.ts:37/40` lands on. `{ loadState, readHooksJson }`
keeps the file consistent with itself; `createHooksReader()` keeps it consistent with
`RemovalOps`. **Recommendation:** stay with the object literal — `index.ts` is the file
under the source-text gate in A.4, and one literal is easier to pin than a factory whose
body lives elsewhere.

#### A.3 Third in-repo instance of the same shape — a reader carrying one member

**Analog:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:87-90`

```ts
/** Reads the one state snapshot selected by the reconcile read pass. */
export interface ReconcileStateReader {
  readonly loadState: typeof loadState;
}
```

and the construction site at `apply.ts:197`, where the reader's member is forwarded
into a collaborator rather than the whole reader:

```ts
    { loadState: reader.loadState },
```

Two spellings of the same member exist side by side: `typeof loadState` here and an
explicit signature in `HooksHydrationReader`. If shape (c) merges the two interfaces, the
planner should pick one spelling and say so; the explicit signature is the better fit,
because it does not tie the bridge's port type to a `persistence/` import.

#### A.4 HARD CONSTRAINT 1 — `tests/index.test.ts:778-793` pins the construction literals

**Verified excerpt** (`tests/index.test.ts:778-793`):

```ts
  // act
  const hydrationConstruction = source.match(
    /createHooksHydration\(hooksRuntime, \{ loadState \}\)/g,
  );

  // assert
  assert.deepStrictEqual(runtimeConstructions, ["createHooksRuntime()"]);
  assert.deepStrictEqual(cacheConstructions, ["createCompletionCache()"]);
  assert.deepStrictEqual(routingConstructions, ["createHooksRouting(hooksRuntime)"]);
  assert.deepStrictEqual(updateConstructions, [
    "createPluginUpdateOperations(hooksRouting, completionCache)",
  ]);
  assert.deepStrictEqual(hydrationConstruction, [
    "createHooksHydration(hooksRuntime, { loadState })",
  ]);
```

Both the regex **and** the expected string must be rewritten in the same change as the
production wiring. Under shape (c) the updated pair reads (planner's exact text may
differ, but the regex and the literal must agree byte-for-byte with `index.ts`):

```ts
/createHooksRouting\(hooksRuntime, \{ loadState, readHooksJson \}\)/g
assert.deepStrictEqual(routingConstructions, [
  "createHooksRouting(hooksRuntime, { loadState, readHooksJson })",
]);
```

#### A.5 HARD CONSTRAINT 2 — `hooks-lifecycle.test.ts:281` forces a NAMED parameter type

**Verified excerpt** (`tests/architecture/hooks-lifecycle.test.ts:281`, inside "WR-01
Block E"):

```ts
  const match = /async function hydrateProjectScopeForCwdWith[^{]*\{([\s\S]*?)\n\}/.exec(raw);
```

`[^{]*` spans the parameter list. An inline object annotation
(`reader: { readHooksJson: … }`) puts a `{` in the parameter list, truncates the match,
and the subsequent `deleteParsedConfig` assertion fails against a captured *type literal*.
A named interface (`reader: HooksReader`) keeps it matching. **This is a constraint on the
interface shape, not a preference.**

The current signature the regex reads (`event-router.ts:657-662`):

```ts
async function hydrateProjectScopeForCwdWith(
  reader: HooksHydrationReader,
  cwd: string,
  routingState: EventRouterRoutingState,
  generationIsCurrent: GenerationGuard,
): Promise<void> {
```

The same test file builds a reader literal at 392-408 and grows a member under shape (c):

```ts
    loadState(extensionRoot: string): Promise<ExtensionState> {
      readRoots.push(extensionRoot);
      return Promise.resolve({ schemaVersion: 2, marketplaces: {} });
    },
  };
  …
  const hydration = createHooksHydration(runtime, reader);
```

#### A.6 HARD CONSTRAINT 3 — `test:corresponding` pairs one test per production module

**Gate:** `scripts/check-corresponding-tests.mjs`, run by `npm run test:corresponding`
inside `npm run check` (`package.json:76, 83`).

**Pairing rule** (`scripts/check-corresponding-tests.mjs:30-36`):

```js
function expectedTestPath(sourcePath) {
  const relativePath = sourcePath.slice(`${productionRoot}/`.length, -3);
  return `${testRoot}/${relativePath}.test.ts`;
}

function expectedSourcePath(testPath) {
  const relativePath = testPath.slice(`${testRoot}/`.length, -".test.ts".length);
  return `${productionRoot}/${relativePath}.ts`;
}
```

A new `extensions/…/bridges/hooks/reader.ts` would demand
`tests/bridges/hooks/reader.test.ts`. A type-only module emits no JS, so that owner test
would have nothing to measure. **Declaring the interface inside `event-router.ts` avoids
the gate entirely** — this is RESEARCH §2.6 option 1 and the recommended home.

The same script also carries the `-fake.ts` / `-contract.ts` companion rule
(`check-corresponding-tests.mjs:44-56`), which is why `tests/platform/*-fake.ts` files
each have a `-fake.test.ts` and a `-contract.ts` sibling. Relevant only if the planner
creates a reusable concern-owned fake (it should not — see A.8).

#### A.7 Cycle constraint — where a new module may NOT live

`extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts:1-23` (header, verbatim):

```
// Leaf-ward home for the hooks bridge's routing operations and the record
// shapes those operations use (D-59-02 / D-59-03).
//
// The state lives here rather than in `event-router.ts` so the dispatch
// chain can read it without importing the hub back. …
//
// INVARIANT that keeps it that way: this module imports only `domain/`,
// `shared/`, `runtime.ts`, and the same-zone `if-field/` (itself leaf-ward
// relative to dispatch). It must never import `event-router.ts`, `dispatch.ts`,
// `dispatch-exec.ts`, `event-adapters.ts`, `settle.ts`, or
// `async-rewake/registry.ts` -- any one of those import edges restores the
// cycle knot this module exists to remove. `npm run fallow` gates it.
```

**Report:** the port must NOT go into `routing-state.ts` — that module holds shared state
cells, and an I/O contract there muddies the stated reason it exists (RESEARCH §2.6 option
3, "do not"). A new `bridges/hooks/reader.ts` leaf would be cycle-safe (same profile as
`routing-state.ts`) but trips A.6. **Declaring the interface in `event-router.ts` beside
`HooksHydrationReader` introduces no new import edge at all and is the recommended home.**

#### A.8 How tests supply the double

Two distinct in-repo patterns exist, and they are NOT interchangeable. Both are shown
because the planner has to choose deliberately.

**(i) The reusable concern-owned fake** — `tests/platform/git-ops-fake.ts`, named in
CONVENTIONS.md. Type-only imports so a support file does not pull production modules in
(`git-ops-fake.ts:1-6`):

```ts
import { cp, mkdir } from "node:fs/promises";

import type {
  GitAuthBundle,
  GitOps,
} from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
```

Explicit-boundary factory (`git-ops-fake.ts:100-107`; `credential-ops-fake.ts:45-48` is
identical in shape):

```ts
export function createGitOpsFake(options: GitOpsFakeOptions): GitOpsFake {
  if (options.boundary !== "memory") {
    throw new Error("createGitOpsFake requires the explicit memory boundary");
  }
```

`tests/platform/removal-ops-fake.ts:1-37` is the file-I/O instance of this pattern and its
header is the best written example of *recording a fake's fidelity limits* — worth reading
if the planner does build a shared fake.

**(ii) The per-case inline literal** — which is what `event-router.test.ts` actually does
today for `HooksHydrationReader`, 10+ times (`event-router.test.ts:1475, 1554, 1618, 1705,
1751, 1804, 1845, 1886, 1923, 1993`), e.g. at 1705:

```ts
    const reader: HooksHydrationReader = {
      loadState(extensionRoot: string): Promise<ExtensionState> {
        …
        return Promise.resolve({ schemaVersion: 2, marketplaces: {} });
      },
    };
```

plus one shared no-op constant at `event-router.test.ts:2387-2391`:

```ts
const EMPTY_STATE_READER: HooksHydrationReader = {
  loadState(): Promise<ExtensionState> {
    return Promise.resolve({ schemaVersion: 2, marketplaces: {} });
  },
};
```

**Recommendation:** follow (ii), the module's own precedent. The bulk of the 171 call
sites read `createHooksRouting(runtime)` with no reader at all and want the smallest
possible edit — a shared default constant analogous to `EMPTY_STATE_READER` (e.g. a
real-`readFile` reader constant in the test file, or one per test file) beats introducing
`tests/bridges/hooks/hooks-reader-fake.ts`, which would trip the `-fake.test.ts` /
`-contract.ts` companion rule in A.6 for a one-member interface. Pattern (i) is warranted
only if the port genuinely needs fault injection across files; RESEARCH §2.8 shows the one
case that needs behavior injects it inline (advance the generation from inside
`readHooksJson`).

**The staleness case the port simplifies** — `event-router.test.ts:1917ff` currently
carries this machinery, which all goes away:

```ts
const GUARDS_FROM_THE_STATE_READ_TO_THE_HOOKS_READ = 3;
const runtimeGoingStaleAfterTheHooksRead: HooksRuntime = {
  ...runtime,
  currentGeneration(): number { … },
};
```

The three assertions stay unchanged (RESEARCH §2.8).

#### A.9 The two call sites to convert

Site A (`event-router.ts:130-136`):

```ts
async function readAndCachePluginHooksWith(
  routingState: EventRouterRoutingState,
  opts: ReadAndCachePluginHooksOptions,
): Promise<void> {
  let raw: string;
  try {
    raw = await readFile(opts.hooksJsonPath, "utf8");
```

Site B (`event-router.ts:604-606`, inside `tryHydrateOnePlugin`):

```ts
  let raw: string;
  try {
    raw = await readFile(hooksJsonPath, "utf8");
```

Import line to narrow (`event-router.ts:40`) — `mkdir` stays:

```ts
import { mkdir, readFile } from "node:fs/promises";
```

---

### B. `.planning/REQUIREMENTS.md` — checkbox + traceability + evidence register

**Analog:** the file's own three sections. All three formats are already present; nothing
new is invented.

**Checkbox form** (`REQUIREMENTS.md:81-88`) — the flip is `- [ ]` → `- [x]` only:

```markdown
- [ ] **GGAT-01**: Each terminal scanning-gate gap proves target visitation and
      carries a synthetic offender and benign control; changed-pair discovery also
      proves deterministic base selection and a fail-closed zero-selection case.
```

**Traceability row form** (`REQUIREMENTS.md:161-163`) — column widths are fixed by the
surrounding table; `Pending` → `Complete` must keep the padding:

```markdown
| Requirement | Phase                               | Status        |
| ----------- | ----------------------------------- | ------------- |
| RVAL-01     | Phase 1                             | Complete      |
```

**Evidence-and-History register form** (`REQUIREMENTS.md:121-139`) — **this is the register
D-09-15 says the evidence-only backlog items must match.** Both existing entries, verbatim:

```markdown
## Evidence and History

These stable requirement IDs no longer authorize active implementation. Their
history remains here and in the canonical scope-impact records.

- **GGAT-02** (`SCOPE-REQ-GGAT-02`, formerly Phase 7): `AGCOL-01` asserted that
  the agents-collision gate was dead, but exhaustive canonical mapping found no
  dedicated terminal finding for that premise. Revalidation is required before
  this requirement can return to active scope; it is not implemented.
- **RCOV-04** (`SCOPE-REQ-RCOV-04`, formerly Phase 8): the standalone `COV-01`
  remeasurement is superseded by `RCOV-01`'s complete all-pair baseline. Its two
  orchestrators remain included in that baseline and neither is a terminal
  current shortfall; this is not a flattering exclusion or an implementation
  claim.
```

Its shape, restated for the seven backlog dispositions: **ID → scope-change row id and
former route in parentheses → what the claim asserted → what revalidation found → an
explicit negative** ("it is not implemented" / "this is not a flattering exclusion or an
implementation claim"). The explicit negative is the load-bearing part.

---

### C. `scripts/revalidation.mjs` — `SEALED_REQUIREMENT_ROUTES`

**Analog:** entries already in the same frozen object literal (`revalidation.mjs:93-97,
102-106`). Two contrasting entries, verbatim:

```js
const SEALED_REQUIREMENT_ROUTES = Object.freeze({
  "AUTH-01": Object.freeze({ route: "Phase 4", status: "Complete" }),
  "CLOSE-01": Object.freeze({ route: "Phase 9", status: "Pending" }),
  "CLOSE-02": Object.freeze({ route: "Phase 9", status: "Pending" }),
  "GGAT-01": Object.freeze({ route: "Phase 7", status: "Pending" }),
  "GGAT-02": Object.freeze({
    route: "Evidence/history (formerly Phase 7)",
    status: "Evidence only",
  }),
```

Single-line form when it fits inside Prettier's `printWidth: 100`; wrapped form when it
does not. A `Pending` → `Complete` flip shortens the line, so every one of the eight stays
on the single-line form. Keys are alphabetically sorted — the flip does not reorder them.

**The status string must match the traceability table cell exactly**; RESEARCH §1.3 records
that flipping `RCOV-03` alone exits 1 with
`requirement-route-contract: RCOV-03: traceability route/status differs from sealed
requirement contract`.

**Fourth carrier** (D-09-03 item 4): `tests/architecture/revalidation.test.ts` plants exact
strings — `"- [ ] **GGAT-03**:"` at :1219 (breaks on change A) and
`"| CLOSE-02 | Phase 9 | Pending |"` at :1026 (breaks on change B).

---

### D. `.planning/WINDOWS.md` — the fenced-JSON ledger

**Analog:** entry 31 in the file's own fenced JSON block (lines ~415-424). Verbatim, with
every field the planner must write, including a populated `resolved_at`:

```json
  {
    "id": 31,
    "kind": "deviation",
    "phase": "106",
    "file": "tests/architecture/compat-01-no-expansion.test.ts",
    "line": null,
    "description": "The workflows reason required the inherited compatibility lock to append the new closed-set member.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-29T19:13:44.624Z",
    "resolved_at": "2026-08-29T19:13:48.337Z"
  }
```

Entry 30, the one to repair, currently ends (lines ~404-408):

```json
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-04T01:03:42.619Z",
    "resolved_at": null
  },
```

**Frontmatter counts block** (`WINDOWS.md:1-8`) — the second fail-closed check (D-09-12a):

```yaml
---
schema_version: 1
open_count: 23
waived_count: 0
fixed_count: 8
total_count: 31
last_updated: 2026-09-04T01:03:42.619Z
---
```

The hand-repair must write `open_count: 22` / `fixed_count: 9` alongside entry 30's status
flip, or `parseLedger` refuses with `Ledger counts disagree with entries`. After
`windows fixed 19 / 21 / 22` the verb owns the counts and lands them at 19 / 12.

The rendered table row format (`WINDOWS.md:17-18`) is regenerated by the verb, never
hand-edited:

```markdown
| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
```

---

### E. `.planning/BACKLOG.md` — terminal dispositions

**An analog DOES exist**, in two variants. The dominant one, verbatim
(`BACKLOG.md:1930-1946`):

```markdown
## ~~HKNC-01: session_start lazy-hydrate `?? []` fallback is unreachable~~ -- CLOSED

Closed 2026-08-17 by the routingTable encapsulation, which removed both
`?? []` call sites as a side effect rather than as a targeted fix. The
`routingTable` cell is module-private now, so the two reads go through
`getRoutingBucket("SessionStart")` and the nullish arms this item named no
longer exist. The fix note asked for both sites together; both went.

NOT closed by the same change: the single `?? []` inside `getRoutingBucket`
itself, which predates this item and has four other callers in dispatch.ts
and settle.ts. Whether that arm is covered was not measured. …

Original report follows.

Surfaced 2026-08-14 measuring branch coverage on PR #127. Cosmetic; the
only cost is a branch that can never go green.
```

Four parts: (1) struck-through heading + `-- CLOSED`, (2) date and what closed it,
(3) an explicit `NOT closed by the same change:` paragraph where closure is partial,
(4) `Original report follows.` preserving the original text verbatim.

The compact variant (`BACKLOG.md:2050-2058`) for short entries — no `Original report
follows.`:

```markdown
## ~~SEV-01: "absent target" renders at two severities depending on the verb~~ -- CLOSED

Filed and closed the same day (2026-08-24). `enable` / `disable` stamped
`warning` on `{not installed}` where `uninstall` / `update` / `reinstall` stamp
`error`, each citing D-01. …
```

A third, older variant exists on the FLOW family — parenthetical, no strikethrough
(`BACKLOG.md:80`): `## FLOW-01: unzoned files are boundary-unchecked and nothing says so (CLOSED)`.

**Which to use, and why.** Two candidates disagree. The strikethrough form (`HKNC-01`,
`SEV-01`, `FLOW-03`, `FLOW-08`, `FLOW-10`, `FLOW-11`) is the newer and dominant one and is
the better fit — it is what the four shipped items (`TESTQ-01`, `FLOW-09`, `REASON-01`,
`FLOW-07`) should take. The parenthetical form appears only on four older FLOW entries;
do not propagate it.

**For the four evidence-only / deferred items** (`COV-01`, `AGCOL-01`, `GAUTH-01`, the
unused-type-member todo), the strikethrough-`CLOSED` heading would overstate the
disposition. Use the §B Evidence-and-History register wording instead, inside the entry,
with its explicit negative — that is what D-09-15 means by "never described as
implemented." `REASON-01` specifically needs the `NOT closed by the same change:` paragraph
(RESEARCH §5.4: `PDEF-03`/`PDEF-05` are narrower than what `REASON-01` asked for).

---

### F. `09-CLOSURE-LEDGER.md` — the new artifact

**Closest analog:** `.planning/phases/07-gate-integrity/07-FINDING-DISPOSITIONS.md` (106
lines). It is a role-match, not an exact match: it disposes *findings* routed to one
phase, where the closure ledger disposes requirement IDs, backlog items, window entries,
and caveats in one table. Its column layout and — more importantly — its rationale for
having an evidence column transfer directly.

**Preamble** (`07-FINDING-DISPOSITIONS.md:1-14`):

```markdown
# Finding Dispositions

Every finding the live evidence ledger routed to this phase, with the status it
carried when the phase opened, the status it carries now, and a command run this
cycle that establishes the claim.

`D-07-17` is the reason the evidence column exists. Three of these findings were
already closed by earlier work, and recording "closed" without a current
measurement is exactly the kind of claim this milestone spent a phase
revalidating. A row that says a defect is gone and cannot show it is not a
record — it is a hope.

Commands are run from the repository root. Output is quoted verbatim.
```

**Table shape** (`:17-19`) and two representative rows:

```markdown
| Finding | At phase start | Now | Closed by | Evidence |
| --- | --- | --- | --- | --- |
| `OMR-F01` | live | closed | `07-01` | `git grep -c "…" -- tests/architecture/gate-targets.ts` → `6` (three targets, each named in two groups). |
| `OPLU-A-F07` | mostly closed | closed, with a named residue | earlier work; residue pinned by this plan | `git grep -n "availableRowMessage" -- …list-flow.ts` → `:69` imports it and `:366` calls it… Residue: see the `CandidateRow` note below. |
```

**The split-disposition pattern** — an `## <ID> — a split disposition` prose section below
the table for any row whose one-word verdict would mislead (`:38-48`). Exactly the device
D-09-17's `unresolved` row and `REASON-01`'s narrower route need.

**What does NOT transfer:** its `Closed by` column names plan numbers (`07-01`, `07-11`).
CONVENTIONS.md and D-09-14 bar phase/plan references from *source comments*; planning
artifacts are where they are legitimate, and this file is a planning artifact, so the
column is fine here. The **disposition vocabulary is different** — 07's column carries free
prose (`live`, `closed`, `mostly closed`, `closed, with a named residue`), while D-09-14
locks a closed set of five (`implemented` | `evidence-only` | `superseded` | `deferred` |
`unresolved`). Copy the columns and the evidence discipline; do **not** copy the
free-prose statuses.

Checked `.planning/milestones/` for a prior closure artifact: it holds
`*-MILESTONE-AUDIT.md`, `*-REQUIREMENTS.md`, `*-ROADMAP.md`, `*-STATE.md` and archived
phase dirs. **No prior `CLOSURE-LEDGER` exists anywhere in the tree** — 07-FINDING-
DISPOSITIONS.md is genuinely the nearest thing.

---

## Shared Patterns

### Durable-ID citation in comments and ledger prose
**Source:** `.planning/codebase/CONVENTIONS.md` §Comments; worked examples in
`shared/fs-utils.ts:58-80` (`D-08-13`, `RCOV-02`) and `routing-state.ts:1-23`
(`D-59-02`, `D-59-03`).
**Apply to:** every new comment in `event-router.ts` and every ledger row.
Cite `D-09-NN` / `RCOV-NN` / `NFR-N`; never `Phase N`, `Plan N`, `Wave N`, `Pitfall N`.

### Required injection, never defaulted
**Source:** `shared/fs-utils.ts:18-30` ("no DEFAULT_REMOVAL_OPS and no `?`, and the
composition roots supply it"), reinforced by `05-06-SUMMARY.md:113` for
`createHooksRouting`'s runtime.
**Apply to:** the new read port. A defaulted port would sidestep the 171-site edit and
contradict an established decision in the same module.

### Type-only imports in test support files
**Source:** `tests/platform/git-ops-fake.ts:1-6`.
**Apply to:** any new shared test double (if the planner creates one — A.8 recommends not).

### Named types at source-text gate boundaries
**Source:** `tests/architecture/hooks-lifecycle.test.ts:281`.
**Apply to:** every parameter added to `hydrateProjectScopeForCwdWith`. Inline object
annotations are forbidden on that function's signature.

### Fail-closed pairs edited as one unit
**Source:** the route-contract check in `scripts/revalidation.mjs` and `parseLedger`'s
counts check in `broken-windows.cjs`.
**Apply to:** each requirement ID's four carriers (one commit), and the WINDOWS.md
description + status + frontmatter-counts repair (one edit set).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `09-CLOSURE-LEDGER.md` | doc | transform | No closure/disposition ledger exists in `.planning/milestones/` or anywhere else in the tree. `07-FINDING-DISPOSITIONS.md` is the nearest artifact and its columns and evidence discipline transfer, but its status vocabulary is free prose where D-09-14 locks a closed set of five. The planner owns the column layout (explicitly delegated in CONTEXT §Claude's Discretion) and should treat 07's file as a *starting shape*, not a template to fill. |

**Two further honest notes:**

1. **`index.ts` construction style is genuinely ambiguous.** `{ loadState }` (object
   literal, `index.ts:40`) and `createRemovalOps()` (factory call, `install-flow.ts:223`)
   are both established in this tree for supplying a required port. A.2 recommends the
   object literal for the reason stated there, but the planner should make it an explicit
   decision rather than inherit it silently.
2. **Interface shape (a) / (b) / (c) has no single in-repo precedent.** `RemovalOps` is a
   one-responsibility port taken by many functions; `HooksHydrationReader` is a
   one-member reader taken by one factory. Neither settles whether `loadState` and
   `readHooksJson` belong on the same interface. RESEARCH §2.3 recommends (c) and gives
   the reasoning; the analogs above support that reading but do not prove it.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{bridges,shared,platform,orchestrators}/`,
`tests/{platform,bridges/hooks,architecture}/`, `scripts/`, `.planning/`
**Files read this session:** 18
**Pattern extraction date:** 2026-09-11
