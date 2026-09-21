# Phase 113: Update, enable/disable, reconcile - Pattern Map

**Mapped:** 2026-09-05
**Files analyzed:** 14 modified (0 new files — every change is a sibling export or a widened member inside an existing module)
**Analogs found:** 14 / 14

Every analog below is git-tracked source under `extensions/`, `tests/`, or
`docs/`. There is no gitignored install mirror in this repo's tree.

## File Classification

| Modified file | Role | Data flow | Closest analog | Match quality |
|---|---|---|---|---|
| `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` | orchestrator (transactional) | batch / heterogeneous-undo | its own five sibling bridge arms (`skills`/`agents` shape) | exact (in-file) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` | orchestrator (ledger projection) | request-response | `toInstallLedgerSummary` + `stagedAgentNames` member | exact (in-file) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` | orchestrator | event-driven / CRUD | `summary.stagedAgentNames.length > 0` reads at `enable-disable.ts:322-326` | exact (in-file) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` | orchestrator | CRUD | reason-stamp sites in `enable-disable.ts:1196,1207` | role-match |
| `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` | orchestrator | CRUD | same | role-match |
| `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` | orchestrator (read surface) | request-response | `buildNotInstallablePathRowFields` (`info.ts:1258-1294`) | exact (in-file) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/workflows-staging-gc.ts` | utility (leaf scan) | file-I/O | `garbageCollectWorkflowsStaging` (same file) | exact (in-file sibling) |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts` | orchestrator (read surface) | request-response | its own two notify arms (`pending.ts:214-217`, `pending.ts:266`) | exact (in-file) |
| `extensions/pi-claude-marketplace/shared/notify.ts` (`REASONS` token) | config / closed set | transform | the `"marketplace in user scope"` addition, commit `40b0edf2` | exact |
| `extensions/pi-claude-marketplace/shared/notify.ts` (`COMPONENT_KINDS`) | renderer | transform | `_ReasonsCoverageProof` idiom in `notify-reasons.ts:266-270` | role-match (different module, same idiom) |
| `extensions/pi-claude-marketplace/shared/notify.ts` (retained-tree advisory line) | renderer | transform | the `leaked: <leak>` trailer, `notify.ts:4135-4137` | role-match |
| `extensions/pi-claude-marketplace/shared/notify-reasons.ts` | config / closed set | transform | the `CommandPrivateReason` union + coverage proof (same file) | exact (in-file) |
| `extensions/pi-claude-marketplace/bridges/workflows/discover.ts` | bridge (discover) | file-I/O | `softFailWarning` template (`discover.ts:96-103`) | exact (in-file) |
| `docs/output-catalog.md` + `tests/architecture/catalog-uat.test.ts` | test / contract | byte-equality | the `empty-steady-state` pair (`output-catalog.md:2062-2066` / `catalog-uat.test.ts:4677-4682`) | exact |

---

## Pattern Assignments

### `shared/notify.ts` + `shared/notify-reasons.ts` + gates — the WLIF-06 `Reason` token (criterion 8)

**Analog:** the last token actually added to `REASONS` — `"marketplace in user scope"` /
`"marketplace in project scope"`, landed in commit `40b0edf2`
(`fix(notify): name the scope behind a marketplace or plugin miss (#145)`).
That commit is the end-to-end cost model for a closed-set amendment. Reading it
(`git show 40b0edf2`) is cheaper than re-deriving the blast radius.

**Cost, measured — a token addition touches SIX places plus a fixture per stamping verb:**

**1. The tuple + its doc comment** (`shared/notify.ts:93`, tail at `:227-233`).
The house style is a multi-paragraph comment ABOVE the literal, citing the
requirement ID, saying what the token claims, and — critically — saying what it
is NOT and which row families may not carry it:

```ts
  // SCOPE-01 / D-01: the marketplace container that holds this plugin IS
  // registered -- in the scope the command did not target. A CONTENT reason,
  // unlike the three `marketplace not added*` structural markers above: it
  // makes no claim that the marketplace subject is absent, it explains why the
  // PLUGIN subject beside it has no install record HERE. It therefore rides a
  // plugin row, always joining `not installed` rather than replacing it, and
  // stays inside `ContentReason`.
  //
  // ... Scope baked into the literal, not interpolated, for the same reason the
  // structural siblings bake theirs: the closed set is a catalog of literals.
  "marketplace in user scope",
  "marketplace in project scope",
] as const;

export type Reason = (typeof REASONS)[number];
```

Copy this shape for `"stale workflow command"`: state the claim (a REMOVED
command is still live for the session), state the contrast CONTEXT locks (it is
NOT the `/reload to pick up changes` trailer, which is about picking up NEW
things), and state that it stays OFF the exported enable/disable outcome union so
the reconcile projection cannot stamp it. Cite `WLIF-06`, never a phase number
(`.claude/rules/typescript-comments.md`).

**2. `ContentReason`** (`shared/notify.ts:236` onward). The exclusion list is
only the structural `marketplace not added*` markers. `"stale workflow command"`
rides a PLUGIN row, so it is a `ContentReason` — no edit needed, but the
narrative comment at `:236-250` explains why the SCOPE-01 pair was deliberately
NOT excluded; mirror that reasoning in the new token's own comment rather than in
that block.

**3. Topic group + coverage proof** (`shared/notify-reasons.ts`). Either give it
a home in a shared topic group or in the `CommandPrivateReason` union
(`notify-reasons.ts:~245-258`, quoted with its per-member justification comments):

```ts
type CommandPrivateReason =
  | "not found"
  | "not installed"
  // SCOPE-01 / D-01: the cross-scope qualifier the lifecycle verbs join to
  // `not installed` on an absent-target row. Owned by those verbs' own
  // absent-target composer alongside `not installed`, so it is named here for
  // the proof rather than promoted to a shared topic group. ...
  | "marketplace in user scope"
  | "marketplace in project scope"
  ...
```

The four stamping verbs own it privately, so `CommandPrivateReason` is the right
home and the comment above is the right template for the "named here for the
proof rather than promoted to a shared group" justification.

The proof itself, verbatim (`shared/notify-reasons.ts:266-270`) — **this is the
`_AssertNever` idiom the planner must also reuse for `COMPONENT_KINDS`**:

```ts
type _AssertNever<T extends never> = T;
type _UncoveredReason = Exclude<Reason, SharedTopicReason | CommandPrivateReason>;
type _ExtraReason = Exclude<SharedTopicReason | CommandPrivateReason, Reason>;
// fallow-ignore-next-line private-type-leak -- OUT-08 completeness proof; a non-never result is a TS2344 build failure, and the export is what keeps `noUnusedLocals` quiet. `_AssertNever` / `_UncoveredReason` / `_ExtraReason` are the proof's own internals, meaningless to a caller.
export type _ReasonsCoverageProof = [_AssertNever<_UncoveredReason>, _AssertNever<_ExtraReason>];
```

Note the three non-negotiable details: the `export` (needed for `noUnusedLocals`),
the `fallow-ignore-next-line private-type-leak` marker with an inline
justification on the SAME line, and the tuple-of-assertions shape.

Also update the module header at `notify-reasons.ts:~17-26`, which narrates the
count history sentence by sentence and ends:

```
 * WDET-04 / D-106-04 appended the dedicated `workflows` reason (43 to 44).
 * WINV-03 / D-109-01 reverses that term (44 to 43).
```

Append one sentence for WLIF-06 (43 to 44). The header's own text says the two
gates below exist so "the two sentences above cannot drift from the tuple again
without a red test" — so this edit is load-bearing, not decoration.

**4. The length pin** (`tests/architecture/notify-closed-set-locks.test.ts:29-54`).
The file's convention is one comment LINE per bump, citing the requirement ID and
the arrow, immediately above a single `assert.equal`:

```ts
test("OUT-08: REASONS is the closed 43-entry reason set", () => {
  ...
  // WDET-04 / D-106-04: +1 for the dedicated final `workflows` member
  // (43 -> 44).
  // WINV-03 / D-109-01: -1 for the retired workflows member (44 -> 43).
  assert.equal(REASONS.length, 43);
});
```

Add `// WLIF-06: +1 for the `stale workflow command` member (43 -> 44).`, bump
the literal to 44, AND edit the test TITLE (it names the count).
The file header states the intent to copy: "Bump the expected count in the SAME
change that grows the set" — the bump is the prompt to add the catalog fixture.

**5. The enumeration pin** (`tests/architecture/compat-01-no-expansion.test.ts:~140-177`).
A hand-written literal member list in tuple order, compared against `[...REASONS]`:

```ts
    "installs disabled",
    "marketplace in user scope",
    "marketplace in project scope",
  ];

  // act
  const actual = [...REASONS];
```

Append the new literal at the END of this array, matching the tuple's declared
order. This is enumeration equality, not a count — order matters.

**6. Four stamp sites.** `uninstall.ts`, `enable-disable.ts` (disable, BOTH the
clean and partial-cascade arms), `reinstall.ts`, `update.ts`. The house stamp
shape is a `ContentReason[]` accumulated then spread conditionally
(`enable-disable.ts:1172-1207`):

```ts
  const reasons: ContentReason[] = [ ... ];
  ...
      reasons: [...reasons, ...narrowUnsupportedKinds(unsupported)],
  ...
    ...(reasons.length > 0 && { reasons }),
```

The gate CONTEXT locks is `previousNames \ stagedNames` — compute it beside the
existing reason accumulation, never inside the renderer.

---

### `shared/notify.ts` — `COMPONENT_KINDS` and the `workflows:` info line (criterion 4)

**Analog for the interface + tuple:** the code being replaced, `notify.ts:3514-3528`:

```ts
// Derive the tuple's element type from the interface so the two
// declarations cannot drift. The tuple is sized exactly (5 entries):
// adding a 6th key to `PluginInfoComponentsResolved.components` without
// extending this tuple breaks the typecheck here -- ...
type ComponentKind = keyof PluginInfoComponentsResolved["components"];
const COMPONENT_KINDS: readonly [
  ComponentKind, ComponentKind, ComponentKind, ComponentKind, ComponentKind,
] = ["agents", "commands", "hooks", "mcp", "skills"];
```

RESEARCH measured that comment FALSE. The replacement forcing construct is the
`_AssertNever` idiom quoted above, restyled for kinds — same `export` +
`fallow-ignore-next-line private-type-leak` requirements:

```ts
type _AssertNever<T extends never> = T;
type _UncoveredComponentKind = Exclude<ComponentKind, (typeof COMPONENT_KINDS)[number]>;
// fallow-ignore-next-line private-type-leak -- <ID> completeness proof; a non-never result is a TS2344 build failure, and the export is what keeps `noUnusedLocals` quiet.
export type _ComponentKindsCoverageProof = _AssertNever<_UncoveredComponentKind>;
```

**Interface to widen** (`notify.ts:1511-1521`) — add `workflows?: readonly string[]`
after `skills`, and update the doc comment above it, which currently enumerates
only four kinds ("`agents`, `commands`, `mcp`, `skills`"). Note the PRECONDITION
paragraph: **arrays MUST be pre-sorted at construction time; the renderer does
NOT sort defensively.** `info.ts` owns the sort.

**Renderer** (`notify.ts:3541-3562`) — the loop needs NO edit once the tuple grows;
`workflows` falls into the generic single-line arm:

```ts
  for (const kind of COMPONENT_KINDS) {
    if (kind === "hooks") { appendHooksBlock(lines, components.hooks); continue; }
    const names = components[kind];
    if (names !== undefined && names.length > 0) {
      lines.push(`    ${kind}: ${names.join(", ")}`);
    }
  }
```

Alphabetical order puts `workflows` LAST in the tuple literal, which matches
CONTEXT's placement decision.

**Composition analog** (`orchestrators/plugin/info.ts:1258-1294`,
`buildNotInstallablePathRowFields`). Note the two `Parameters<typeof
composeResolvedComponents>[1]` references RESEARCH flagged — thread `pluginName`
as a THIRD positional parameter so both stay valid untouched:

```ts
async function buildNotInstallablePathRowFields(
  resolved: Parameters<typeof composeResolvedComponents>[1],
  ...
    const components = await composeResolvedComponents(pluginRoot, resolved);
```

---

### `orchestrators/plugin/workflows-staging-gc.ts` — `scanRetainedWorkflowsStaging` (criterion 7)

**Analog:** its own sibling `garbageCollectWorkflowsStaging` (`:103-186`). Copy
four things verbatim in shape.

**Signature + ENOENT arm** (`:103-115`):

```ts
export async function garbageCollectWorkflowsStaging(
  locations: Pick<ScopedLocations, "workflowsStagingDir" | "workflowsHomeDir">,
): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(locations.workflowsStagingDir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      // NFR-3: a missing staging dir is a no-op; nothing to sweep.
      return [];
    }
    throw err;
  }
```

Mirror the `Pick<...>` parameter type exactly so the two cannot diverge on what
they need. The scan's ENOENT arm returns `[]` and NEVER `mkdir`s (`pending` is a
no-write surface).

**Per-entry containment, BEFORE any read through the candidate** (`:155-164`) —
the WR-07 ordering is the whole point; anchoring at `workflowsStagingDir`
instead of `workflowsHomeDir` leaves a check that cannot fail:

```ts
    try {
      await assertPathInside(
        locations.workflowsHomeDir,
        candidate,
        `workflows staging root ${name}`,
      );
    } catch (err) {
      leaks.push(`${name}: ${errorMessage(err)}`);
      continue;
    }
```

`pending` has no leak channel, so the scan's version `continue`s silently — but
it must still not throw out of a read-only command.

**Age bound + lstat race arm** (`:118-136`): reuse
`WORKFLOWS_STAGING_MAX_AGE_MS` and the same
`if (!stats.isDirectory() || stats.mtimeMs >= abandonedBefore) continue;` gate, so
a live transaction mid-commit is never reported.

**The errno predicate to REFACTOR, not duplicate** (`:207-214`):

```ts
async function holdsDisplacedEnvelopes(stagingRoot: string): Promise<boolean> {
  try {
    return (await readdir(path.join(stagingRoot, DISPLACED_DIR))).length > 0;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    return code !== "ENOENT" && code !== "ENOTDIR";
  }
}
```

The scan needs a COUNT; this returns a boolean whose error arm has none. Extract
one shared reader returning `{ holds: false } | { holds: true; count?: number }`
and make `holdsDisplacedEnvelopes` a thin `.holds` projection, so the sweep's
behaviour is provably unchanged. The doc comment at `:189-206` explains the
errno ladder ("only ENOENT and ENOTDIR PROVE the directory holds nothing") — move
it with the reader; do not restate it.

`garbageCollectWorkflowsStaging`'s `Promise<string[]>` signature must NOT change
(both call sites wrap it in a bare `catch {}` under D-19-01).

---

### `orchestrators/reconcile/pending.ts` + the retained-tree advisory (criterion 7)

**Analog for the render:** the `leaked:` trailer in `composePluginLinesWith`
(`shared/notify.ts:4131-4137`) — the house shape for "N advisory body lines from
a string array, 4-space indented, appended after the row":

```ts
    for (const leak of manualRecoveryLeaks(p.cause)) {
      lines.push(`    leaked: ${leak}`);
    }
```

**Analog for the message shape:** `ReconcilePendingEmptyMessage`
(`notify.ts:1585-1587`) and its hard-coded renderer arm (`notify.ts:3774-3779`),
whose comment records why the byte form is hard-coded ("so the byte form cannot
drift from `docs/output-catalog.md`'s `empty-steady-state` state"). Pitfall 3
requires the SAME optional field on BOTH this shape and
`CascadeNotificationMessage` (`notify.ts:1357-1383`, whose four declared fields
are `marketplaces` / `label` / `cardinality` / `tally` — no advisory slot),
rendered from the central dispatch after the body so both arms are byte-identical.

**Analog for the call site:** `pending.ts:214-217` and `pending.ts:266` are the
two `notify()` arms — exactly ONE fires per invocation (IL-2):

```ts
  if (invalidBlocks.length === 0 && isReconcilePlanListEmpty(plans)) {
    notify(opts.ctx, opts.pi, { kind: "reconcile-pending-empty" });
    return;
  }
  ...
  notifyWithContext(opts.ctx, opts.pi, PENDING_CONTEXT, marketplaces);
```

Call the scan ONCE per invocation, OUTSIDE the `for (const scope of scopes)` loop
at `pending.ts:134` (Pitfall 4: the staging dir is scope-independent, the loop is
not). Sort by directory name for the byte-identical-on-repeat contract.

**Precedent to weigh for the path:** `pending.ts:~200` renders BASENAMES, never
absolute paths (T-53-02-02); `redactAbsolutePaths` already exists in `notify.ts`.
CONTEXT says carry "the staging path". Decide deliberately and record it.

---

### `bridges/workflows/discover.ts` — the `tense` discriminant (criterion 5)

**Analog:** the single shared template that must not be duplicated
(`discover.ts:96-103`):

```ts
function softFailWarning(
  fileName: string,
  workflowsDir: string,
  outcome: string,
  reason: string,
): string {
  return `workflow script "${fileName}" in "${workflowsDir}" ${outcome}: ${reason}`;
}
```

`outcome` is already a parameter — so the change is two module-constant phrase
tables keyed by tense, threaded `discoverPluginWorkflows(input)` (`:251`) →
`scanWorkflowsDirectory(input)` (`:290`) → `verdictWarning` (`:203`) + the two
`readFailureWarning` sites (`:308`, `:328`). Make `tense` REQUIRED (compile-forcing,
per Pitfall 1's lesson); costs one edit at `bridges/workflows/stage.ts:132-135`
plus ~25 sites in `tests/bridges/workflows/discover.test.ts`.

Row grammar: the file is the subject, subject-first — inherited from the template.

---

### `orchestrators/plugin/update.ts` — the sixth bridge (criteria 1, 6)

**Analog: the in-file five sibling arms.** Four seams, all quoted in RESEARCH
with line numbers:

- **(a) Prepare** — `prepareUpdateHandles` (`:1306-1370`), `PrepHandles` (`:757-762`).
  Append `workflows` after `mcp`; `previousWorkflowNames` is
  `record.resources.workflows` (`preflight` destructured at `:1312`).
- **(b) Abort** — `abortPartialHandles` (`:1393-1408`) / `abortHandles` (`:1410-1416`).
  Copy the AGENTS arm (`abortPreparedWorkflows` also returns
  `Promise<string | undefined>`); unwind FIRST, reverse of prepare order.
- **(c) Phase-3a commit** — `commitUpdatePhase3a` (`:2088-2144`). Copy the
  SKILLS/AGENTS arm shape (non-`undefined` leak return is itself a failure entry),
  not the commands/mcp catch-only shape. Each arm is its own `try` that pushes an
  `UpdatePhase3Failure` and CONTINUES — a bridge failure does NOT abort the update.
- **(d) Finalize** — `applyPerBridgeResources` (`:1827-1863`). The five-sibling
  pattern is per-bridge gating:

```ts
  if (!failedPhases.has("skills")) {
    sRecord.resources.skills = handles.skills.result.recorded.map((r) => r.generatedName);
  }
```

**DO NOT copy this arm verbatim for workflows.** Pitfall 2: workflow envelopes
live outside every scope root, so a no-op failure arm strands executable code
nothing can name. The CR-02 / CR-03 two-window policy, ported from
`features/workflows-spike` (its diffs do NOT apply — `commitUpdatePhase3a` and
`applyPerBridgeResources` were extracted after that branch was cut; re-derive
against the current structure):

```ts
    if (failedPhases.has("workflows")) {
      sRecord.resources.workflows = [
        ...new Set([...preflight.record.resources.workflows, ...placedWorkflowNames]),
      ];
    } else {
      sRecord.resources.workflows = [...handles.workflows.result.stagedNames];
    }
```

with the intent-mark window widening to the union first. `placedWorkflowNames`
comes from `commitPreparedWorkflows`'s `onPlaced` callback
(`bridges/workflows/types.ts:131-147`), never from `prep.result.stagedNames` —
the install ledger already honours this at `install.ts:1209-1216`; copy that.

`PHASE3_FAILURE_PHASES` (`update.ts:1448-1456`) already carries `"workflows"`.
Criterion 6 wants one case per widened slot driven through `update`, not one
end-to-end case.

Watch fallow: `maxCognitive: 15` / `maxCyclomatic: 20` / `maxUnitSize: 60`, zero
approved overrides. A sixth arm with a two-branch failure policy may force a
helper extraction (assumption A1).

---

### `orchestrators/plugin/install.ts` + `enable-disable.ts` — the projection (criterion 2)

**Analog:** the two existing staged-name members, in all three places they appear.

Interface (`install.ts:511-530`):

```ts
export interface InstallLedgerSummary {
  readonly resolved: MaterializablePlugin;
  readonly frontmatterDegradations: readonly { ... }[];
  // Staged-name lists, read only for their emptiness (ENBL-07 soft-dep flags).
  readonly stagedAgentNames: readonly string[];
  readonly stagedMcpServerNames: readonly string[];
}
```

Producer (`install.ts:832-839`):

```ts
function toInstallLedgerSummary(c: InstallCtx): InstallLedgerSummary {
  return {
    resolved: c.resolved,
    frontmatterDegradations: c.frontmatterDegradations,
    stagedAgentNames: c.stagedAgentNames,
    stagedMcpServerNames: c.stagedMcpServerNames,
  };
}
```

`InstallCtx.stagedWorkflowNames` already exists as a REQUIRED field
(`install.ts:375-378`), so this is a two-line change.

Consumer (`enable-disable.ts:322-326`) — **read the comment before copying, it
does NOT apply to workflows:**

```ts
      // SEV-01 / D-98-02: the LENGTH of the staged-name arrays only. The names
      // themselves must never reach a rendered row -- the row needs the
      // declaration verdict, nothing more.
      ...(summary.stagedAgentNames.length > 0 && { stagedAgents: true }),
      ...(summary.stagedMcpServerNames.length > 0 && { stagedMcpServers: true }),
```

WLIF-06 is the workflows member's consumer and it needs the NAMES
(`installed.resources.workflows \ summary.stagedWorkflowNames`), not the length.
`runEnableBranch` receives `installed: InstalledPluginRecord` at
`enable-disable.ts:248`, captured before the ledger rewrites the record — the
pre-enable inventory is in scope at the right moment.

---

### `docs/output-catalog.md` + `tests/architecture/catalog-uat.test.ts` — every new rendered byte

**Analog:** the `empty-steady-state` pair. Catalog side
(`docs/output-catalog.md:2062-2066`) — a prose paragraph, then an HTML comment
marker, then the fenced block, inside a per-command H2 section:

```markdown
<!-- catalog-state: empty-steady-state -->

```text
Pending: next reload will apply 0 actions.
```
```

Fixture side (`tests/architecture/catalog-uat.test.ts:4675-4682`) — keyed
`(section, state)`, carrying a pure `NotificationMessage` and a `MockPi` factory:

```ts
  "/claude:plugin pending": {
    "empty-steady-state": {
      pi: piWithBothLoaded(),
      // Dedicated standalone variant; the renderer hard-codes the advisory
      // body line so the byte form cannot drift from the catalog state.
      message: { kind: "reconcile-pending-empty" },
    },
```

SCOPE GATE (SNM-31), from the runner's header: fixtures are **pure
`NotificationMessage` data — never synthesized from domain helpers**.

Five paired fixtures are required by this phase: `info` `workflows:` line
(resolved arm), `info` `workflows:` line (state-only arm), `info` preview-warning
channel, the `list` regression row, and BOTH `pending` arms carrying a
retained-tree advisory — plus one per WLIF-06 stamping verb.

---

## Shared Patterns

### Closed-set amendment (applies to: the `Reason` token, and `COMPONENT_KINDS`)

**Source:** `shared/notify-reasons.ts:266-270` (the `_AssertNever` proof, quoted
verbatim above) + `tests/architecture/notify-closed-set-locks.test.ts` (length
pin) + `tests/architecture/compat-01-no-expansion.test.ts` (enumeration pin).

The house rule, from the length-pin file's own header: *"the compile-time proofs
catch a member that is REMOVED or RENAMED, but an ADDITIVE drift is silently
absorbed."* Every closed set therefore carries BOTH a compile-time coverage proof
AND a runtime length/enumeration pin. Land the widening, the proof, and the pin
bump in ONE commit. Then **prove the proof non-vacuous by reverting the new
member and observing red** — CONVENTIONS.md's rule that a gate wants a test that
plants the violation, not one that reads the config.

### Error handling — read surfaces never throw

**Source:** `orchestrators/plugin/workflows-staging-gc.ts:118-136,155-164`
**Apply to:** `scanRetainedWorkflowsStaging`, the `pending` call site, and the
`info` discovery call.

Per-entry `try`/`catch` + `continue`; the pass never aborts on one bad entry.
ENOENT on the root returns the empty result. Containment assertion runs BEFORE
any read through the candidate.

### Output discipline (IL-2)

**Source:** `orchestrators/reconcile/pending.ts:20-22` (header) and its two
`notify()` arms.
**Apply to:** every file in this phase.

All bytes through `shared/notify.ts`; exactly one `notify()` per `pending`
invocation; no `process.stdout`/`process.stderr` (two independent gates).

### Comment traceability

**Source:** every excerpt above.
**Apply to:** all files.

Cite `WLIF-0x` / `WR-0x` / `CR-0x` / `D-xx` requirement and decision IDs. Never
`Phase 113`, never `Plan N`, never `Wave N` — `.claude/rules/typescript-comments.md`.
Comment the WHY, and state what the new construct does rather than narrating what
was removed (this matters for the false `COMPONENT_KINDS` comment).

---

## No Analog Found

None. Every change in this phase is a widened member, a sibling export, or a
paired fixture inside a module that already exists and already has a test pair —
which is also why the `test:corresponding` gate stays satisfied without new files.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{orchestrators,bridges,shared}/`,
`tests/architecture/`, `docs/output-catalog.md`, plus `git log -S` over the
`REASONS` tuple to locate the last real token addition (`40b0edf2`).
**Files scanned:** 12 source files, 3 architecture test files, 1 doc, 1 git commit
**Pattern extraction date:** 2026-09-05
