# Phase 116: Load-time workflow convergence - Pattern Map

**Mapped:** 2026-09-09
**Files analyzed:** 8 (all modified, none new)
**Analogs found:** 8 / 8 (all internal — this phase edits its own seam; "analog" means the nearest existing *case* in the same file)

This phase creates **zero new files**. `scripts/check-corresponding-tests.mjs:10`
forbids a new file under `tests/orchestrators/**` without a paired production
module, and `tests/architecture/unit-suite-glob-completeness.test.ts` forbids
a new top-level `tests/` directory. Every "pattern" below is therefore "copy
the shape of sibling case X already in this file," not "model file A off file B."

## File Classification

| Modified File | Role | Data Flow | Closest Analog (same file unless noted) | Match Quality |
|---|---|---|---|---|
| `extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts` | orchestrator (load-time scan) | event-driven (resources_discover) / CRUD (state re-materialization) | itself — `isRecordedButDisabled`/`alreadyTouched` filters staying in `backfillOnePluginIsolated` | exact (delete one filter, keep siblings' shape) |
| `extensions/pi-claude-marketplace/shared/notify-reasons.ts` | domain/vocabulary (typed union) | transform | `CommandPrivateReason`'s existing members `"orphan rewake"` / `"stale workflow command"` | exact |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts` | projection (outcome → row) | transform / request-response | `backfilledRowFromOutcome`'s existing `orphanRewake`/`malformed` spread into `reasons` | exact |
| `tests/architecture/notify-closed-set-locks.test.ts` | test (architecture lock) | assertion-only | `OUT-08` test — its own running comment ledger (`WDEP-04: +1 ... 44 -> 45`) | exact |
| `tests/architecture/compat-01-no-expansion.test.ts` | test (architecture lock) | assertion-only | `COMPAT-01: REASONS holds exactly its inherited members, in order` — the 45-element array literal | exact |
| `tests/shared/notify.test.ts` | test (unit) | assertion-only | `closed notification constants preserve exact public values` (`:4938`) | exact |
| `tests/orchestrators/reconcile/backfill.test.ts` | test (unit, owner suite) | CRUD / event-driven | `D-68-03` case (`:485`), `ENBL-08` case (`:1486`), `RECON-04` case (`:1334`), `SF-02` case (`:1773`) | exact |
| `tests/architecture/catalog-uat.test.ts` + `docs/output-catalog.md` | test + doc (byte-pairing contract) | transform (doc↔fixture) | `backfill-partially-installed` / `backfill-partially-installed-no-reasons` states (`docs/output-catalog.md:2430`, `:2443`) | exact |
| `tests/integration/workflow-kind-inversion.test.ts` (optional extension) | test (integration, mtime harness) | event-driven | its own `RECON-05` pair (`:242-288` promotion-shaped, `:290-361` negative control) | exact |
| `orchestrators/reconcile/types.ts` (only if Option B chosen for Q6) | config/DI seam | — | `ApplyReconcileOptions.gitOps` (`:256-265`) | exact |

## Pattern Assignments

### `orchestrators/reconcile/backfill.ts` (orchestrator, event-driven+CRUD)

**Analog:** the file's own sibling filters in `backfillOnePluginIsolated`.

**The filter to delete** (currently at `backfill.ts:265-269`, immediately before the two filters that stay):
```ts
const { scope, marketplace, mp, plugin, record } = target;
// D-68-03: scan ONLY partially-installed plugins.
if (record.compatibility.installable) {
  return false;
}

// ENBL-08: never scan a record the user disabled. ...
if (isRecordedButDisabled(record)) {
  return false;
}

// RECON-04: applyPlan already touched this plugin this load -- don't double-emit /
// re-materialize over it.
if (alreadyTouched.has(`${marketplace} ${plugin}`)) {
  return false;
}
```
Delete only the first `if` block. The two survivors are the shape any comment
rewrite must match: present-tense, one filter, one requirement-ID citation.

**Prose sites that must move to present tense (measured by removal + grep, not enumerated by reading — see 116-RESEARCH.md Q2 for the full 7-site list):** `backfill.ts:3-6` (module header), `:37`, `:91-92`, `:163-165` (`hasForceInstalledPlugin` doc — do NOT widen the function, only correct its doc's false "only kind" claim), `:180-182`, `:237-239` (the `"all three benign skips"` count becomes `"two"`), `:309-310`.

**Do NOT touch:** `hasForceInstalledPlugin` (`:161-177`) itself — D-116-04/Q1 confirms widening it turns `backfill.test.ts:529` (`WR-01`) red for no benefit, since `stateExisted === false` implies zero records on the production path.

### `shared/notify-reasons.ts` (domain vocabulary, transform)

**Analog:** `CommandPrivateReason`'s existing members, specifically `"stale workflow command"` (added by WLIF-06) — same group, same "owned by the reconcile projection, not shared across topic groups" rationale this new token needs.

**Pattern to copy** (append inside the union at `:279`, before the closing semicolon, following the exact doc-comment convention already used for its neighbor):
```ts
  // WLIF-06: the retired-workflow-command marker. ...
  | "stale workflow command";
```
→ becomes (illustrative spelling; exact token is planner's discretion per D-116-02):
```ts
  | "stale workflow command"
  // WCONV-03: the convergence marker for a backfilled record -- rides the
  // existing `plugin-backfilled` outcome on both render arms.
  | "<new token>";
```
This is one of the **two required derivations of the same fact** (Q3 #1/#2) — `notify-reasons.test.ts:48`'s `ReasonsCoverageProofIsExact` clears automatically once this compiles, but only if the token also gets a home in `REASONS` (below). Do not edit one without the other.

### `shared/notify.ts::REASONS` (the tuple itself, `:93-269`)

**Analog:** the tuple's own tail, `"requires pi-dynamic-workflows"` (WDEP-04's addition, the most recent append).

**Pattern:** append at the tail (COMPAT-01 requires append-only, no reordering):
```ts
  "network unreachable",
  "marketplace not added",
  ...
  "stale workflow command",
  "requires pi-dynamic-workflows",
  "<new token>",   // WCONV-03 -- appended here
];
```

### `orchestrators/reconcile/notify.ts::backfilledRowFromOutcome` (projection, transform)

**Analog:** the function's own existing `orphanRewake`/`malformed` prelude — this is a **one-line addition to a shared prelude**, not a new branch, per D-116-02's "both arms carry it."

**Current shape** (`notify.ts:610-641`, excerpted above in full) — the edit is one line in the shared `reasons` array construction:
```ts
const reasons: ContentReason[] = [
  // WCONV-03: the convergence marker. Emit order: <token> first, then orphan
  // rewake, then malformed*, then (partial arm only) dropped kinds, then the
  // soft-dep markers composeReasons appends last (notify.ts:2284-2299).
  "<new token>",
  ...(outcome.orphanRewake === true ? (["orphan rewake"] as const) : []),
  ...malformed,
];
```
Both the `installed` return and the `partially-installed` return read this same array — no per-arm duplication needed, matching D-116-02's "shared prelude" requirement.

### `tests/architecture/notify-closed-set-locks.test.ts` (architecture lock, assertion-only)

**Analog:** the test's own running comment ledger — literally copy the last entry's shape and append one more line, then bump the count.

**Pattern** (`:29-57`, current tail):
```ts
  // WDEP-04: +1 for the `requires pi-dynamic-workflows` member -- the third
  // soft-dep marker, for a row that staged a workflow in a session with no host
  // workflow engine (44 -> 45).
  assert.equal(REASONS.length, 45);
```
→
```ts
  // WDEP-04: +1 for the `requires pi-dynamic-workflows` member -- the third
  // soft-dep marker, for a row that staged a workflow in a session with no host
  // workflow engine (44 -> 45).
  // WCONV-03: +1 for the load-time convergence marker -- the row a backfilled
  // record renders to explain a reload the user did not initiate (45 -> 46).
  assert.equal(REASONS.length, 46);
```
Note the test's own **title string** ("closed 45-entry reason set") is NOT gated (Q3 trap set) — rewrite it to 46 anyway for honesty, but know that skipping it will not turn any test red.

### `tests/architecture/compat-01-no-expansion.test.ts` (architecture lock, assertion-only)

**Analog:** the same file's own `expected` array literal (excerpted above) — append the new token as the literal's last element, in the same array-of-string-literals style, no other change. This is COMPAT-01's own append-only contract, so this file IS the analog for itself.

### `tests/shared/notify.test.ts:4938` (unit test, assertion-only)

**Analog:** the same test's own full-tuple enumeration (a third independent copy of the `REASONS` array, per Q3 — the amendment touches this file's array literal exactly as it touches `compat-01`'s).

### `tests/orchestrators/reconcile/backfill.test.ts` (unit, owner suite — all new cases land here)

**Analog 1 — the WCONV-01 promotion case.** Model on the existing `ENBL-08: promotes the same grown fixture when the record is enabled` case at `:1486` (per Q6/D-116-03, this is the case's "enabled twin"). Reuse its fixture builders verbatim: `createHermeticProjectScope` (`:96-127`), `writeMarketplaceSource`/`writePluginTree` (`:141-234`, note `PluginTree.workflow?: boolean` already exists at `:137-138` — no new fixture knob needed), `pluginRecord`, `createOfflineGitOps`, `createSilentBoundary`, `savedWorkflowEntries`, `retryTree`. Seed `installable: true, supported: ["skills"], unsupported: []` against a `{ skill: "clean", workflow: true }` tree (Measurement 5's exact shape) instead of the `installable: false` shape `ENBL-08` uses. Assert the outcome, the record's `supported` growing to include `"workflows"`, and the envelope landing via `savedWorkflowEntries`.

**Analog 2 — the negative control (git-source skip).** No existing case covers a git-source record in the backfill scan (Q7/P1 — grep confirms none). Build it as the mirror of Analog 1: same seed shape but a `github`/`git-subdir` source, assert `anyFailure === false`, no row pushed, and `clonedUrls() === []` via the existing `createOfflineGitOps` counting fake (already injected at `:846` for a different case — same DI seam, new assertion).

**Analog 3 — "equal set is scanned but not materialized."** Already exists: `D-68-03: stamps a gate-open scope that records no partially-installed plugin` (`:485-528`). Retitle only (it currently names the deleted filter); do not change its body — it already tests the right thing for the wrong stated reason.

**Analog 4 — "disabled record never scanned, as a measured zero" (Q6).** Model on `SF-02: surfaces a plugin-scoped failure row when the cached manifest cannot be parsed` (`:1773`) for the manifest-poison technique, paired with `ENBL-08`'s existing case (`:1486`) as the "enabled twin" that proves the poison is visible when scanned. Recommended shape (Option A, zero production change): seed a disabled record with a grown-set source, corrupt/delete the cached `marketplace.json`, assert `outcomes` stays empty AND the stamp still lands (vs. the enabled twin, which surfaces a `(failed)` row and leaves the gate open). This is the DI-adjacent option that needs **no new seam**; Option B (inject `resolveRecorded`/`loadManifest` onto `ApplyReconcileOptions`, mirroring `gitOps` at `types.ts:256-265`) is the fallback if a literal call-count is preferred — do not reach for `t.mock.method` or a module-global counter (CONVENTIONS.md forbids test-only seams; `notification-boundary.ts:19-23` forbids `times(0)` for the same "proves nothing" reason).

**Analog 5 — "one-time" (WCONV-02, second load).** Strengthen the existing byte-only case `RECON-05: leaves state.json byte-identical when the recorded stamp already matches` (`:443-482`) to the triple-snapshot form below, or extend `tests/integration/workflow-kind-inversion.test.ts` instead (D-116-07 — this repo's decision is to extend that file, not open a new one).

### `tests/integration/workflow-kind-inversion.test.ts` (integration, mtime harness — extend per D-116-07)

**Analog:** the file's own `RECON-05` pair — `:242-288` (two consecutive reconciles leave a workflow envelope untouched) is the promotion-shaped case to mirror for WCONV-01/02 combined; `:290-361` (a forced-open gate over a grown set DOES rewrite it) is its negative control, already proving the "changed" side of the same invariant.

**The mtime helpers to reuse verbatim** (`:227-241`):
```ts
// backdate + mtimeMsOf pair, tests/integration/workflow-kind-inversion.test.ts:231-241
async function backdate(target: string, when: Date): Promise<void> {
  await utimes(target, when, when);
}
async function mtimeMsOf(target: string): Promise<number> {
  return (await stat(target)).mtimeMs;
}
```
Use these when both loads happen in the same test tick (removes dependence on ms timer resolution); prefer the triple-snapshot form below when the two loads are far enough apart in the test that timer resolution is not a risk.

**The stronger triple-snapshot form** (house pattern, borrowed from `tests/orchestrators/marketplace/autoupdate.test.ts:122-132`, also used at `tests/persistence/migrate-config.test.ts:311-318` and `tests/bridges/mcp/unstage.test.ts:301-307`):
```ts
async function stateSnapshot(filePath: string): Promise<{
  readonly bytes: string;
  readonly inode: bigint;
  readonly mtimeNs: bigint;
}> {
  const [bytes, metadata] = await Promise.all([
    readFile(filePath, "utf8"),
    stat(filePath, { bigint: true }),
  ]);
  return { bytes, inode: metadata.ino, mtimeNs: metadata.mtimeNs };
}
```
Capture before the first load, after the first load (expect a change — P3: `updatedAt` legitimately moves on promotion), and after the second load (expect `deepStrictEqual` against the post-first-load snapshot — this is the actual WCONV-02 proof).

### `docs/output-catalog.md` ↔ `tests/architecture/catalog-uat.test.ts` (doc + test, byte-pairing contract)

**Analog:** the worked example is Phase 115 plan 04's SUMMARY (`.planning/workstreams/workflows/phases/115-load-time-workflow-convergence/115-04-SUMMARY.md`), which moved the corpus lock 194→195 by adding `installed-with-workflow-gate-note`. Its three-files-move-together shape:
1. The doc's H3 + prose + `<!-- catalog-state: NAME -->` annotation + fenced block, under `## reconcile-applied-cascade` (`docs/output-catalog.md:2336`).
2. A `FIXTURES["reconcile-applied-cascade"]["NAME"]` entry in `catalog-uat.test.ts`, using the section's existing `piWith*Loaded` probe factories (`:210-245`).
3. The exact-count lock — comment, literal, AND failure message, all three, at `catalog-uat.test.ts:5602-5610`.

**The two existing states this phase's token mutates** (both must gain the token AND have their now-false prose rewritten):
```text
docs/output-catalog.md:2430  backfill-partially-installed          (partially-installed, {lsp} brace)
docs/output-catalog.md:2443  backfill-partially-installed-no-reasons (partially-installed, brace-less)
```
Their prose claims `"byte-identical to the pre-SEV-05 form"` and `"rows WITHOUT reasons do not gain a brace"` — both become false once the token rides every backfilled row; rewrite both paragraphs, do not just change the fenced block.

**New state(s) to add** (D-116-06 decides 2, moving the lock 195→197): one clean `installed` arm (`backfill-installed-converged`, illustrative name), one `installed` arm with the soft-dep marker present (`{<token>, requires pi-dynamic-workflows}` — pins `composeReasons`'s append-order, `notify.ts:2284-2299`).

**Recommended fenced-block shape** (mirrors the two existing backfill states' `● local-mp [user]` / `● hello v1.0.0 (...) {...}` / `Reconcile: 1 success` structure exactly):
```text
● local-mp [user]
  ● hello v1.0.0 (installed) {<token>}

Reconcile: 1 success
```

**Proof discipline (from 115-04's own finding):** prove each new/changed state in three directions, not two — annotation removed → red (count lock + inverse walk), fixture removed → red (`[MISSING FIXTURE]`), one byte changed → red (`[BYTE MISMATCH]`).

## Shared Patterns

### The five-site closed-set amendment (applies to every touch of `REASONS`)
**Source:** measured directly, Q3 of `116-RESEARCH.md` (Measurement 3).
**Apply to:** `notify-reasons.ts`, `notify-closed-set-locks.test.ts`, `compat-01-no-expansion.test.ts`, `notify.test.ts:4938`, plus `notify.ts::REASONS` itself — five files, five edits, in the same commit. Two of the five are *pairs* of independent derivations of the same fact (`notify-reasons.ts`+`notify-reasons.test.ts`; `compat-01`+`notify.test.ts`) — editing one half and assuming the other follows is the exact defect this milestone has shipped three times.

### Negative-control-before-belief (applies to every new gate this phase adds)
**Source:** `116-RESEARCH.md` Pattern 3 (verbatim table, reproduced for the planner):

| Gate | Control | Expected |
|---|---|---|
| WCONV-01 case | restore `if (record.compatibility.installable) return false;` | case reddens |
| Closed-set lock | delete the token from `REASONS` | `notify-closed-set-locks` + `compat-01` + `notify.test.ts:4938` redden, `tsc` errors twice |
| Catalog state | (a) remove annotation, (b) remove fixture, (c) change one byte | (a) count lock + inverse walk fail, (b) `[MISSING FIXTURE]`, (c) `[BYTE MISMATCH]` |
| "never scanned" case | flip the record to `enabled: true` | the twin promotes / the poison surfaces a `(failed)` row |
| "one-time" case | force the stamp stale before the second load | snapshot differs |

Paste the failing transcript for each into the SUMMARY — not a description of it.

### Present-tense comments, no narration of deleted code
**Source:** `.claude/rules/typescript-comments.md`, cited in `116-RESEARCH.md` Project Constraint 6.
**Apply to:** every `backfill.ts` prose site touched by the D-68-03 amendment. Forbidden phrasing: "the former X", "X used to", "byte-identical to the former". The amended comment states the CURRENT filter set (two filters, not three) and the CURRENT scope boundary (path-source only, per P1) in present tense.

## No Analog Found

None — every touched file already contains a same-shape sibling case or comment block to copy. This is the expected result for a phase whose "Key insight" (RESEARCH.md) is that the entire production surface change is a four-line deletion plus one tuple entry plus one line in a shared prelude.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/orchestrators/reconcile/`, `extensions/pi-claude-marketplace/shared/{notify.ts,notify-reasons.ts}`, `tests/orchestrators/reconcile/backfill.test.ts`, `tests/architecture/{notify-closed-set-locks,compat-01-no-expansion,catalog-uat}.test.ts`, `tests/shared/notify.test.ts`, `tests/integration/workflow-kind-inversion.test.ts`, `docs/output-catalog.md`, plus the Phase 115-04 SUMMARY as a worked-example precedent.
**Files scanned:** 8 production/test files read directly (line-targeted) + 1 prior-phase SUMMARY referenced by the research.
**Pattern extraction date:** 2026-09-09
