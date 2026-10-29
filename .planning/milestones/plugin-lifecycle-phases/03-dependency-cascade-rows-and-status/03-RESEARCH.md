# Phase 3: Dependency Cascade Rows and Status - Research

**Researched:** 2026-10-26
**Domain:** In-repo TypeScript: the install dependency cascade (`domain/dependency-closure.ts`, `orchestrators/plugin/install-cascade*.ts`), its refusal messages, the output catalog, and cucumber scenarios
**Confidence:** HIGH (every seam read this session; current behavior of the two key cases observed with a throwaway cucumber probe)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Closure failure rows (CAS-01, CLOSUREROW-01)

- **D-PL3-01:** A failed install closure gives a row to every closure member that this install would have newly materialized but did not, beside the failing member's row and the root's row. Upstream (E1) prints one line and names only the failing member, but it names every member on success; this extension's row-per-plugin grammar (INS-01, output-catalog "Failure attribution") already diverges by giving the root its own row, and the parity basis for the grammar itself is the success line naming each member. A member already installed and unchanged by the plan gets no row (nothing was attempted for it).
- **D-PL3-02:** The row is `(failed) {dependency failed}`, the token the root row already carries, so `Reason`, `StatusToken`, and `PluginStatus` stay closed and their pinned counts do not move. No cause line (the cause belongs to the failing member's row). Severity `error`, as the root row.
- **D-PL3-03:** Both failure paths are covered: the walk/constraint failure (no writes yet; members discovered by the walk before the failure) and the per-member ledger failure (members rolled back plus members never attempted). The member list must reach `composeCascadeFailureMessage` (today it gets only the failing key and root). `features/plugin/install-dependencies.feature` gains the `lib` row (`:84-88`) and the `mid` row (`:139-142`).

#### Invalid root name (CAS-02, ROOTKEY-01)

- **D-PL3-04:** Match upstream order (E2): look the root up in its marketplace first. A root the marketplace does not list keeps the existing not-found verdict. A listed root whose key fails the token rule is refused `(failed) {invalid manifest}` with the cause `Plugin "<plugin>@<marketplace>" cannot be installed, because its id is invalid: each part of a plugin id (plugin@marketplace) may use only the letters a-z and A-Z, digits, ".", "_" and "-", and must start with a letter or digit. Here the plugin's name does not; the marketplace's maintainer can rename it.` (upstream text, sentence-cased after the colon). The `declares an unusable dependency (root: ...)` cause is never used for the root.
- **D-PL3-05:** The fix lands in `domain/dependency-closure.ts` (a root-specific failure arm) and the cascade messaging; `enable-disable.ts` is Phase 1's file and keeps its own call, which inherits the new arm only if the arm is rendered generically. The pinned case in `test/integration/reserved-record-keys.test.ts` (`:393-395`) changes with it, and a cucumber scenario covers `_x@mp` listed by its marketplace. `list`/`info` showing `{unsupported source}` for `__proto__` is out of scope (deferred).

#### Dependency status propagation (CAS-03, DEPS-STATUS-01)

- **D-PL3-06:** Do not propagate a dependency's partial availability to its dependent on `list`, `info`, or install rows. Claude Code has no partial state and leaves dependents of a dependency with component errors unaffected (E3); the states upstream does propagate (disabled, missing, version-unsatisfied) are already reported at load by LOAD-01 (`{dependency unsatisfied}`) and its remedies. Recorded as the decision not to (CAS-03 allows it); no code change, `info.ts` untouched. **Uncertain** (the backlog entry records an operator statement asking for propagation).

#### Git-source upgrade state on list (CAS-04, PARITYGV-01 b1)

- **D-PL3-07:** Keep the `upgradable` / `partially-upgradable` state for git-source rows. Upstream shows no upgrade state on `list` for any source (E7), so PL-5 is already a recorded divergence for every source, and it names git trees explicitly (GV-01 commit version of a warm git tree; the entry version for a cold one, VER-01/VER-02); the fetch-plugin milestone (RSTA-04..06, FTCH-01..06) built `fetch` precisely so `list` shows a git plugin's remote state. Removing it for git sources only would leave a divergence for path sources and drop a shipped feature. Recorded as a divergence licensed by PL-5 + RSTA/FTCH; `list-flow.ts`'s PL-5 comment cites D-PL3-07. **Uncertain.**

#### Required-by lists and truncation (CAS-05, PARITYGV-01 b2 b3)

- **D-PL3-08:** A refusal for a non-root cascade member names every declarer that put a range on it: the cascade members that declare one, plus the installed plugins outside the closure that already do (the root keeps today's `rootRequiredBy`). Derived at refusal time from the walk's edges (`requestersOf`-style), so `ClosureMember.requiredBy` (first declarer, used by the walk's not-found message, which upstream also words with one declarer) keeps its shape and the exact-shape tests do not churn.
- **D-PL3-09:** The Anthropic Directory pin refusal (`DirectoryPinUnsatisfiedError`, the refusal upstream truncates) truncates as `Mt(…,120)` does: the plugin name, the listed version, and the joined range list each cut once at 120 UTF-16 code units without leaving a dangling high surrogate, suffix `…` (U+2026); each requirer name cut at 120 with its `@marketplace` part dropped (already dropped today); no cap on the requirer count. One helper in `domain/dependency-range.ts` does the cut. The ANSI/whitespace/NFC/backtick normalization is not added: names are already token-allowlisted, ranges are allowlisted by the range parser.
- **D-PL3-10:** Other refusals keep this extension's bounds (`MAX_RENDERED_RANGE_CHARS = 200` per range with `... (+N chars)`). **Uncertain** (upstream uses 64 per range and 200 for the joined list with `…`).

#### Next step on a refused dependency move (CAS-06, UPDDEP-01 b2)

- **D-PL3-11:** The refusal `Dependency "<key>" is installed at version <v>, which does not satisfy <r>, and cannot move: <why>` ends with upstream's hint, `To look for a version in range, run /claude:plugin update <key>.`, under upstream's condition (E5): the root declares the dependency directly. The source kind is not needed (upstream gives the hint for every source), so `DependencyMoveRequest` does not grow a source field. The scenarios at `install-dependencies.feature:193,:226,:658` change, and a new scenario covers the offline git-dependency case. **Uncertain** (whether to restrict the hint to git dependencies, as the backlog text implied).

#### Unbounded version in a hold cause (CAS-07, VERSTR-01)

- **D-PL3-12:** Bound at render, not at parse: `describeConstraint` in `constraint-fold.ts` cuts the stage-two `version` with the same helper at 64 code units (upstream's version limit, E4) before interpolating it. `domain/components/plugin.ts` keeps `version: Type.Optional(Type.String())`, because upstream accepts any version string (E6) and a parse-time bound would refuse plugins Claude Code installs. T-29-21 continues to cover the `will update` / `updated` version slots.

### Claude's Discretion

- How the closure member list reaches the messaging (extend the `CascadeFailureSubject` arms or pass a separate list), and how the walk returns its partial members on failure.
- The helper's name and signature in `dependency-range.ts`.
- Test placement inside the existing paired test files; catalog-UAT fixture updates for every changed catalog block.

### Deferred Ideas (OUT OF SCOPE)

- `list` / `info` render `{unsupported source}` for a reserved `__proto__` entry because `classifyResolverNote` has no "malformed marketplace entry" arm (backlog candidate).
- Aligning the other refusals' bounds (64 per range, 200 joined, `…`) with upstream (D-PL3-10).
- Upstream's `Mt` normalization (ANSI strip, whitespace collapse, NFC, backtick) for free text in refusals.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAS-01 | A failed install closure gives a row to each member that resolved but did not install (CLOSUREROW-01) | Three failure routes traced (walk, constraint, member ledger); recommended carrier = an `unmaterialized: readonly string[]` field computed in `install-cascade.ts`, carried inside the `failure` object for the closure/constraint arms (so `install-flow.ts` passes it through untouched) and on the `member-failed` arm (one forced line in `install-flow.ts::unwrapCascade`). Rows rendered in `composeCascadeFailureMessage`. See Pattern 1. |
| CAS-02 | `install` of a root name outside the token alphabet gets a verdict naming the real cause (ROOTKEY-01) | Today `_x@mp` gives the misleading cause whether or not the marketplace lists `_x` (probed). Recommended: in `resolveDependencyClosure`, an unsplittable-by-allowlist root is looked up first when `installPolicy` is present; `absent` → closure `[root]` (the ledger then reports the existing `{not in manifest}`); listed → new arm `invalid-root-id`. Enable passes no `installPolicy`, so Phase 1's file sees no new runtime arm. See Pattern 2. |
| CAS-03 | Partial-dependency status on dependents, or the decision not to, recorded (DEPS-STATUS-01) | D-PL3-06: no code. Record in `docs/dependency-resolution.md` "The load-time check" plus a PROJECT.md Key Decisions row. See "Records for CAS-03 / CAS-04". |
| CAS-04 | `list` git-source upgrade state as Claude Code does, or recorded (PARITYGV-01 b1) | D-PL3-07: no code. Comment at `list-flow.ts:40-44` cites D-PL3-07; optional PRD PL-5 note and Key Decisions row. |
| CAS-05 | Non-root refusals name every declarer; names and ranges truncated as Claude Code does (PARITYGV-01 b2, b3) | `rangeRequirers` (`install-cascade.ts:929-938`) returns the first declarer; walk edges are already recordable with the lookup wrapper `walkDependencyGraph` uses. Truncation helper in `domain/dependency-range.ts`; joined ranges cut in `install-cascade.ts`, name/version/requirers cut in `install-outcome.ts::assertDirectoryPinSatisfied` (forced exception; `shared/errors.ts` untouched). See Pattern 3. |
| CAS-06 | Offline refusal of a git-dependency move names the next step (UPDDEP-01 b2) | Probed current text: `... and cannot move: the release tags could not be listed (network unreachable) -- required by "app@tools"` (no next step). Hint appended in `install-cascade.messaging.ts::rangeConflictFacts` when the root is among the move request's requesters; the requester keys must be added by `dependency-plan.ts::unmovable` (forced one-line exception). See Pattern 4. |
| CAS-07 | A hold cause never interpolates an unbounded catalog `version` (VERSTR-01) | `describeConstraint` (`constraint-fold.ts:177-190`) interpolates `line.version` raw; cut at 64 with the CAS-05 helper. See Pattern 5. |
</phase_requirements>

## Summary

The phase is entirely in-repo: no new package, no network, no external API. Everything that matters is how three different failure routes of the install cascade reach one renderer (`composeCascadeFailureMessage` in `install-cascade.messaging.ts`), and how few files outside the Phase 3 `Files` line must be touched to carry new facts there. I traced every route and every constructor of `CascadeFailureSubject`, and ran a throwaway cucumber probe (outside the repo, nothing written) to observe today's output for the invalid root id and the offline git move.

The cleanest CAS-01 carrier puts an `unmaterialized` key list **inside** the `failure` object of the `closure-failed` and `constraint-failed` cascade arms. `install-flow.ts::unwrapCascade` and `dependency-plan.ts::walkRefusal` already forward `cascade.failure` verbatim into the subject, so those routes need no edit outside the owned files. The `member-failed` route is different: `unwrapCascade` builds the member subject field by field, so it needs one added line. The CAS-02 arm is gated on `installPolicy` (which only install walks pass), so `enable-disable.ts` keeps its byte-identical behavior and its narrowing assertion stays true. CAS-06 needs the move request's requester keys on the `installed-unsatisfied` failure. Only `dependency-plan.ts::unmovable` knows them, which forces a one-line change there. CAS-05 and CAS-07 share one truncation helper in `domain/dependency-range.ts`. The directory pin's name, version and requirer cuts must happen in `install-outcome.ts::assertDirectoryPinSatisfied`, because `shared/` may not import `domain/`. This avoids touching `shared/errors.ts`.

The shared hot files are `install-cascade.ts`, `install-cascade.messaging.ts` (+ tests), `features/plugin/install-dependencies.feature`, `docs/output-catalog.md`, `test/architecture/catalog-uat/fixtures/plugin-install.ts`, and the byte/count constants. CAS-01, -02, -05 and -06 all touch some of them, so they must run in sequential waves. CAS-07 and the CAS-03/04 records can run in parallel with CAS-02.

**Primary recommendation:** Land the truncation helper + CAS-07, CAS-02, and the CAS-03/04 records in wave 1 (disjoint files), then CAS-01, then CAS-05, then CAS-06, each as one plan that updates its feature rows, catalog block, fixture and byte constant in the same commit.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Which closure members were discovered / would materialize | orchestrators (`install-cascade.ts`) | domain (`dependency-closure.ts`, unchanged for CAS-01) | The cascade already owns the walk call, the readThrough set, the phase list and the ledger run; the domain walk stays pure and its exact-shape tests do not churn |
| Invalid root id verdict | domain (`dependency-closure.ts`) | orchestrators (messaging renders the cause) | D-PL3-05: a root-specific failure arm of the walk; wording is presentation |
| Member rows, hint text, invalid-id cause | orchestrators (`install-cascade.messaging.ts`) | shared grammar (unchanged) | The messaging module owns the cascade vocabulary; `shared/notification-*` stays closed (D-PL3-02) |
| Every-declarer requirer list | orchestrators (`install-cascade.ts`) | — | Derived from the walk's declared edges at refusal time (D-PL3-08) |
| Truncation (120 / 64 code units) | domain (`dependency-range.ts`) | orchestrators call sites | D-PL3-09/12; `shared/errors.ts` cannot import `domain/` (boundary zones) |
| Directory pin message fields | orchestrators (`install-outcome.ts::assertDirectoryPinSatisfied`) | shared (`DirectoryPinUnsatisfiedError` unchanged) | The listed version is read there at pin-check time; pre-truncated fields keep `shared/errors.ts` untouched |
| Requester keys of a refused move | orchestrators (`dependency-plan.ts::unmovable`) | messaging | Only the plan's `DependencyMoveRequest.requesters` knows who declares the dependency |

## Standard Stack

No new libraries. Everything uses what is installed.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript (strict) | `^6.0.3` [VERIFIED: .planning/codebase/STACK.md] | Source and tests | Project language |
| `node:test` + `node:assert/strict` | Node built-in | Unit tests | Mandated by `.agents/skills/typescript-unit-tests/SKILL.md` |
| `@cucumber/cucumber` | (repo devDependency) | Behavioral tests under `features/` | AGENTS.md "Behavioral tests" rule |
| `semver` | (repo dependency) | Range math in `dependency-range.ts` | Already used; not needed for the new helper |

**Installation:** none.

## Package Legitimacy Audit

No external packages are installed or recommended by this phase. **Packages removed:** none. **Packages flagged:** none.

## Architecture Patterns

### System Architecture Diagram

```
/claude:plugin install app@tools
        │
        ▼
install-flow.ts (lock) ──► runInstallCascadeOrPlanMoves / runInstallCascade (install-cascade.ts)
                                   │
                                   ▼
                     resolveCascade ──► resolveDependencyClosure (domain walk, lookup wrapped)
                        │   │                 │
                        │   │      ok=false ──┴──► {kind:"closure-failed", failure:{...ClosureFailure, unmaterialized}}  ─┐
                        │   ▼                                                                                            │
                        │  resolveMemberConstraints ──► fail ──► {kind:"constraint-failed", failure:{..., unmaterialized}} ┤
                        ▼                                                                                                │
             materializeCascade ──► runPhases(member phases) ──► fail ──► failedCascade ──► {kind:"member-failed", unmaterialized}
                                                                                                                         │
     dependency-plan.ts (UPD-DEP-D1 plan) ── walkRefusal(failure.failure) / unmovable(request, cause + requesters) ──────┤
                                                                                                                         ▼
                                         install-flow.ts::unwrapCascade  (builds CascadeFailureSubject; member arm needs +1 line)
                                                                                                                         ▼
                                         handleCascadeThrow ──► composeCascadeFailureMessage (messaging)
                                                                   failing row + root {dependency failed} row
                                                                   + one {dependency failed} row per unmaterialized key   (CAS-01)
                                                                   + invalid-root-id cause                                (CAS-02)
                                                                   + "To look for a version in range, run ..." hint       (CAS-06)
                                                                                                                         ▼
                                                                   notify (single block)   | orchestrated callers: cause only, rows dropped
```

### Component Responsibilities (files the planner will touch)

| File | Owned? | Change |
|------|--------|--------|
| `extensions/pi-claude-marketplace/domain/dependency-closure.ts` | yes | CAS-02 root arm (lookup-first under `installPolicy`) |
| `extensions/pi-claude-marketplace/domain/dependency-range.ts` | yes | truncation helper (CAS-05, CAS-07) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts` | yes | `unmaterialized` on failure arms (CAS-01); declared-edge recording + `rangeRequirers` + 120-cut `declared` (CAS-05); `failureDeclarers` arm for CAS-02; optional requester keys on the `installed-unsatisfied` arm type (CAS-06) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts` | yes | member rows (CAS-01), invalid-id cause (CAS-02), hint (CAS-06); header comment update |
| `extensions/pi-claude-marketplace/orchestrators/plugin/constraint-fold.ts` | yes | 64-cut in `describeConstraint` + comment fix (CAS-07) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts` | yes | PL-5 comment cites D-PL3-07 (CAS-04) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts` | **no (forced)** | `unwrapCascade` member arm: copy `unmaterialized` (one line). Optional: `handleCascadeThrow` dedupe vs `moved` rows (see Pitfall 4) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts` | **no (forced)** | `assertDirectoryPinSatisfied` passes 120-cut `plugin`, `manifestVersion`, requirer names |
| `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-plan.ts` | **no (forced, Phase 4's file)** | `unmovable` adds the request's requester keys to the failure |
| `docs/dependency-resolution.md` | **no (docs)** | table row for `{dependency failed}` / `{invalid manifest}`, hint, D-PL3-06 record |
| `extensions/pi-claude-marketplace/shared/errors.ts` | no | **untouched** (fields pre-truncated by caller) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` | no (Phase 1) | **untouched** (CAS-02 arm unreachable from enable; see Pattern 2) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-bindings.ts` | no | **untouched** (drops cause-less rows, so new member rows never reach update's settle refusal) |

### Pattern 1: CAS-01 — carry the unmaterialized members to the renderer

**What happens today (verified):**
- Walk failure: `resolveDependencyClosure` returns only the failure; `ctx.members`/`ctx.order` are discarded [VERIFIED: domain/dependency-closure.ts:511-513, `return failure ?? { ok: true, closure: ctx.order, alreadyInstalled: ctx.skipped };`].
- `resolveCascade` returns `{ kind: "closure-failed", failure: closure }` and `{ kind: "constraint-failed", failure: constraints.failure }` [VERIFIED: install-cascade.ts:1563-1565, 1592-1594].
- Ledger failure: `failedCascade` returns `{ kind: "member-failed", key: run.attempting ?? options.rootKey, error, rollbackPartials, mcpConfigNotices }`. It has no member list [VERIFIED: install-cascade.ts:1425-1440].
- `install-flow.ts::unwrapCascade` builds the subject: `sink.subject = { kind: "closure", failure: cascade.failure }`, `{ kind: "constraint", failure: cascade.failure }`, and for the member arm `{ kind: "member", key: cascade.key, error: cascade.error, rollbackPartials: capture.rollbackPartials }`, only when `cascade.key !== rootKey` [VERIFIED: install-flow.ts:1098-1124].
- `dependency-plan.ts::walkRefusal` forwards `failure.failure` verbatim [VERIFIED: dependency-plan.ts:171-175].
- `install-flow.ts` also builds three closure subjects **by literal** on the MISS-01 path (`reason: "marketplace-not-added"` ×2, `"cross-marketplace"`) [VERIFIED: install-flow.ts:3056-3066, 3077-3089, 3121-3131]. So any new field on the subject's `failure` type must be **optional** there, or those literals stop compiling.

**Recommended shape (discretion area):**
```typescript
// install-cascade.ts (owned)
/** CAS-01: keys this run would have materialized but did not, root and failing key excluded. */
interface Unmaterialized { readonly unmaterialized: readonly string[] }

// InstallCascadeResult arms
| { readonly kind: "closure-failed"; readonly failure: ClosureFailure & Unmaterialized }
| { readonly kind: "constraint-failed"; readonly failure: CascadeConstraintFailure & Unmaterialized }
| { readonly kind: "member-failed"; ...existing; readonly unmaterialized: readonly string[] }

// install-cascade.messaging.ts (owned) — subject accepts producers that have no list
| { readonly kind: "closure"; readonly failure: ClosureFailure & Partial<Unmaterialized> }
| { readonly kind: "constraint"; readonly failure: CascadeConstraintFailure & Partial<Unmaterialized> }
| { readonly kind: "member"; ...existing; readonly unmaterialized?: readonly string[] }
```
- Required on the cascade side (every producer must answer), optional on the subject side (MISS-01 literals, `unmovable`, `previewFresh`, `catalogLookup` subjects carry no list). `walkRefusal` and the closure/constraint arms of `unwrapCascade` inherit the list with **no edit**.
- `install-flow.ts::unwrapCascade` member arm: add `unmaterialized: cascade.unmaterialized` (the one forced line).

**Which keys count ("would have newly materialized"):**
| Route | Source of keys | Exclude |
|-------|----------------|---------|
| walk failure | keys the wrapped `lookup` was called with (the walk looks up every key it visits; recorded ENABLED walls return before lookup, `domain/dependency-closure.ts:387-393`) | `rootKey`, the failing key, `options.readThrough` (plan moves are not materializations) |
| constraint failure | `closure.closure` keys (post-order; disabled members included, alreadyInstalled excluded by construction) | `rootKey`, `failure.key`, `readThrough` |
| member failure | the phase members `materializeCascade` built (fresh installs + re-enables; recorded root filtered) | `rootKey`, `run.attempting` |

Failing key of a closure failure: `cycle` → `chain.at(-1) ?? rootKey` (mirror `closureFailureFacts`, messaging:306); `not-found`/`marketplace-not-added`/`cross-marketplace`/`unusable-declaration`/new `invalid-root-id` → `failure.key`. Re-enable members (disabled records) are included: they become phases that re-stage artifacts (EDEP-03), so they are "materialized".

Use the **same lookup wrapper** CAS-05 needs: `walkDependencyGraph` already wraps `options.lookup` to fill a `DeclaredEdges` map [VERIFIED: install-cascade.ts:1799-1819]. Hoist it into a helper that `resolveCascade` uses for every walk. A copy would trip `fallow dupes`. Lookups that returned `absent`/`unusable` are failing keys anyway. So "keys of the `declared` map" (the `found` lookups) is the walk-failure list before exclusions.

**Rendering:** in `composeCascadeFailureMessage`, after the failing row and root row, push one row per key not equal to `facts.key` or `rootKey`. Each row is `{ status: "failed", name: key, reasons: ["dependency failed"], severity: "error", needsReload: false }`, named by its full key as every cascade member row is (messaging header "Subjects"). Then `sortRows`. When `isRoot` (the failing subject is the root, e.g. a cycle that returns to the root or an invalid root id) the function returns `[failed]` today. Recommend also appending member rows there for consistency, though for the invalid root the list is always empty.

**Feature rows that change (verified by tracing each failing scenario):** only `install-dependencies.feature:84-88` (adds `lib@tools`) and `:139-142` (adds `mid@tools`). Every other failing install scenario (`:176`, `:204`, `:412`, `:496`, `:527`, `:633`, `:699`, `:737`, `:845`, `:992`, `:1054`, `git-source.feature:165`) has no fresh member besides the root and the failing key, or fails on a plan-step path that does not use `composeCascadeFailureMessage`. Row to add for `:84`:
```
| tools | project | lib@tools | lib@tools | failed | dependency failed | project | | | | |
```

### Pattern 2: CAS-02 — invalid root id, lookup first

**Today (probed with a throwaway cucumber scenario, not committed):** `install _x@fixtures` gives `_x (failed) {invalid manifest}` with the cause `Plugin "_x@fixtures" declares an unusable dependency (root: expected <plugin>@<marketplace>).`, both when `fixtures` lists `_x` and when it does not. Cause: `splitKey` runs on the root before any lookup [VERIFIED: domain/dependency-closure.ts:490-497]. `test/integration/reserved-record-keys.test.ts:358-403` seeds the `hostile` marketplace **with** `__proto__` and `hello` listed (`seedMarketplace(cwd, "hostile", ["__proto__", "hello"])`), and pins that cause at `:393-395`.

**Recommended:**
```typescript
// dependency-closure.ts
| { readonly ok: false; readonly reason: "invalid-root-id"; readonly key: string;
    readonly name: string; readonly marketplace: string }

// in resolveDependencyClosure, before building ctx:
const rootParts = splitKey(options.rootKey);
if (rootParts === undefined) {
  const at = options.rootKey.indexOf("@");
  if (at === -1 || options.installPolicy === undefined) {
    return { ok: false, reason: "unusable-declaration", key: options.rootKey,
             detail: "root: expected <plugin>@<marketplace>" };   // enable and no-'@' keep today's arm
  }
  const name = options.rootKey.slice(0, at), marketplace = options.rootKey.slice(at + 1);
  const looked = await options.lookup({ key: options.rootKey, name, marketplace });
  if (looked.kind !== "absent") return { ok: false, reason: "invalid-root-id", key: options.rootKey, name, marketplace };
  // absent: closure [root] — the ledger reports the existing not-found verdict
  return { ok: true, closure: [{ key: options.rootKey, name, marketplace, requiredBy: undefined, ranges: [] }], alreadyInstalled: [] };
}
```
- Split on the **first** `@`. That matches the edge parser `splitPluginMarketplaceRef` [VERIFIED: edge/handlers/plugin/shared.ts:29-42, `const atIdx = ref.indexOf("@");`] and today's `splitKey`.
- Why gate on `installPolicy`: install walks always pass it [VERIFIED: install-cascade.ts:1558-1561]. The enable walk passes none [VERIFIED: enable-disable.ts:786-795]. `enableCascadeLookup` always answers `found`, so an ungated lookup-first would hand enable the new arm. Enable then narrows it with `assertUnusableDeclarationIsOnlyRemainingArm` (which still compiles, because the asserted type is a subset) and renders `failure.detail` as `undefined` at runtime. Gating keeps enable byte-identical and its assertion true. The doc comment on `installPolicy` ("Omitted only for a traversal that cannot install new plugins") already states the semantics: an unrecordable id is an install refusal (upstream checks `Zut` only in the install routine, after the walk [VERIFIED: upstream src.js, `let pn=sn.closure.find((Yr)=>!Zut(Yr));if(pn!==void 0)return{ok:!1,reason:"unrecordable-plugin-id",pluginId:pn}`]).
- Absent path: the ledger then throws `PluginShapeError({ kind: "not-in-manifest" })` [VERIFIED: install-outcome.ts:618] and the root's `member-failed` goes to the single-row path, which prints `Plugin "<name>" not found in marketplace "<mp>".` [VERIFIED: features/plugin/install.feature:68]. Upstream prints the same text: `Plugin "_x" not found in marketplace "mp"` (E2).
- `install-cascade.ts::failureDeclarers` must get an arm for the new reason (TS error otherwise: it reads `closure.requiredBy`). Return `[]`, because no declarer is involved.
- Messaging `closureFailureFacts` gets the case (its exhaustive switch fails typecheck until it does). Reasons `["invalid manifest"]`. The cause is the D-PL3-04 text. Upstream picks the half [VERIFIED: upstream src.js `TKn`]: `Here ${K&&!V?"the marketplace's name does not":!K&&V?"the plugin's name does not":"they do not"}; the marketplace's maintainer can rename ${K||V?"it":"both"}.` Implement all three variants, because marketplace names are only `assertSafeName`-checked [VERIFIED: domain/name.ts:28-60] and can be `_mp`. Decide the halves with the **alphabet** `^[A-Za-z0-9][-A-Za-z0-9._]*$` (upstream `je` has no length cap; our `TOKEN_PATTERN` caps at 256 [VERIFIED: domain/dependencies.ts:47 `/^[A-Za-z0-9][-A-Za-z0-9._]{0,255}$/`]). Avoid `sonarjs/no-nested-conditional`: use if/else or a lookup table.
- Commit together: the domain arm, `failureDeclarers`, messaging, the closure test, the messaging test, and the integration pin. Splitting them leaves a commit that fails `check:commit` typecheck.

Expected integration pin after the change (`reserved-record-keys.test.ts:388-396`):
```
"  ⊘ __proto__ (failed) {invalid manifest}\n" +
'    cause: Plugin "__proto__@hostile" cannot be installed, because its id is invalid: each part of a plugin id (plugin@marketplace) may use only the letters a-z and A-Z, digits, ".", "_" and "-", and must start with a letter or digit. Here the plugin\'s name does not; the marketplace\'s maintainer can rename it.'
```

### Pattern 3: CAS-05 — every declarer, and the 120 cut

**Requirers.** `rangeRequirers` returns `options.rootRequiredBy` for the root, else `[member.requiredBy]` [VERIFIED: install-cascade.ts:929-938]. `ClosureMember` has no per-range declarer (keep it so, D-PL3-08). Use the declared-edge map from the hoisted lookup wrapper (Pattern 1): non-root requirers = declarers whose edge to `member.key` carries a range (`requestersOf(declared, key).filter(r => r.ranges.length > 0)`, `install-cascade.ts:1719-1732`). Upstream adds a requirer only when the constraint carries a version (`if(ol.version===void 0)continue; ... dr.set(Cu,[...dr.get(Cu)??[],ii])`), and adds cascade members as they install, in **reverse closure order** (`for(let ii=sn.closure.length-1;ii>=0;ii--)`) [VERIFIED: upstream src.js install routine]. Order the list by the reverse of our closure post-order to match. It differs from map-insertion order only for diamonds with several declaring siblings.

**Truncation helper** (`domain/dependency-range.ts`), mirroring upstream `re`/`J9` [VERIFIED: upstream src.js `function re(t,n){if(n<=0)return"";if(t.length<=n)return t;let e=t.slice(0,n),r=e.charCodeAt(n-1);return gYt(r>=55296&&r<=56319?e.slice(0,-1):e)}` and `function J9(n,e=2000){return n.length>e?\`${re(n,e)}…\`:n}`]:
```typescript
/** D-PL3-09 / D-PL3-12: cut at `limit` UTF-16 code units, never leaving a lone high surrogate, then `…`. */
export function truncateForRefusal(text: string, limit: number): string {
  if (text.length <= limit) {
    return text;
  }

  const cut = text.slice(0, limit);
  const last = cut.charCodeAt(limit - 1);
  return `${last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut}…`;
}
```
(Name and constants are discretion. Export named limits if they are used in more than one file.)

**Where each cut goes:**
| Field | Cut at | Site |
|-------|--------|------|
| joined declared ranges (`directoryPin.declared`) | 120 | `install-cascade.ts::resolveOneMember` (owned). Today `declared: renderDeclaredRanges(ranges)`, which is the 200-cap `... (+N chars)` form; the pin uses `truncateForRefusal(ranges.join(", "), 120)` instead |
| plugin name | 120 | `install-outcome.ts::assertDirectoryPinSatisfied` (forced) |
| listed `manifestVersion` | 120 | same (read there via `readDeclaredPluginVersion`) |
| each requirer (`@marketplace` dropped first) | 120 | same: `pin.requiredBy.map((key) => truncateForRefusal(key.replace(/@[^@]*$/u, ""), 120))` |

`DirectoryPinUnsatisfiedError` builds its message from the constructor fields [VERIFIED: shared/errors.ts:1228-1250]. No consumer reads the fields except `instanceof` checks (`apply-outcomes.ts:751`, `install-cascade.messaging.ts:485`, `apply.ts:731`). So pre-truncating the fields is safe, and `shared/errors.ts` stays untouched. A `shared/` helper is not an option: D-PL3-09 names `domain/dependency-range.ts`, and the `shared` zone may import nothing internal.

Upstream message, for reference [VERIFIED: upstream src.js]: `"${Mt(Es.entry.name,120)}" from the ${Hr} is pinned to its listed commit (${nl.manifestVersion?\`version ${Mt(nl.manifestVersion,120)}\`:"no version"}), which does not satisfy ${Mt(rs.join(", "),120)} required by ${(dr.get(ii)??[]).map((Ga)=>\`"${Mt(On(Ga).name,120)}"\`).join(", ")}.`

### Pattern 4: CAS-06 — the next-step hint

**Today (probed):** with `lib` a url-source git dependency installed at 1.0.0, a remote tag `lib--v2.0.0`, `app` needing `lib@^2.0.0`, and `the git host drops the connection for the plugin "lib"`, the lib row reads:
`Dependency "lib@tools" is installed at version 1.0.0, which does not satisfy ^2.0.0, and cannot move: the release tags could not be listed (network unreachable) -- required by "app@tools"`
Reasons `already installed, version conflict`; app row `{dependency failed}`; summary `Some plugin operations have failed.`

**Data flow:** the text is built in `rangeConflictFacts` [VERIFIED: install-cascade.messaging.ts:358-372]. The subject comes from `dependency-plan.ts::unmovable(request, cause)` [VERIFIED: dependency-plan.ts:149-163], which has `request.requesters: readonly GraphRequester[]` but no root key. The messaging has `rootKey` (both `composeCascadeFailureMessage` and `cascadeFailureCause` take it). Therefore:
- `install-cascade.ts` (owned): add an optional `declaredBy?: readonly string[]` (name is discretion) to the `installed-unsatisfied` arm of `CascadeConstraintFailure`. It stays optional, because `checkInstalledMember` (no move judged) does not set it.
- `dependency-plan.ts::unmovable` (forced, Phase 4's file): `declaredBy: request.requesters.map((requester) => requester.key)`.
- Messaging: `constraintFailureFacts` / `rangeConflictFacts` take `rootKey`. When `moveRefusal !== undefined && declaredBy?.includes(rootKey) === true`, append the hint. Join with a period unless the reason already ends with one, because `moveRefusal` can be `errorMessage(err)` text [VERIFIED: dependency-move.ts:188-191]:
  `${why}${why.endsWith(".") ? "" : "."} To look for a version in range, run /claude:plugin update ${key}.`
  Build it without nested template literals (`sonarjs/no-nested-template-literals` is an error).
- House style for command hints in causes: `Run /claude:plugin <verb> ...`, no backticks [VERIFIED: shared/notification-mcp.ts:184-190; reconcile/reconcile.messaging.ts:185]. D-PL3-11's text already follows it. Upstream: `. To look for a version in range, ${Uh("plugin update",n,...)}` → ``run `claude plugin update lib@mp` `` [VERIFIED: upstream src.js `omn`, `Uh`].

**Every pin that changes (the root declares the dependency directly in each):**
- `features/plugin/install-dependencies.feature:193`, `:226`, `:658`
- `features/plugin/update-dependencies.feature:124` (update settle: `dependencyRefusal` passes `rootKey: "widget@tools"`, which declares `zcore` directly)
- `test/orchestrators/plugin/install-flow.test.ts:18359`
- `test/orchestrators/plugin/install-cascade.messaging.test.ts:774-803` (add `declaredBy` + the expected hint, plus a case where the root is not among the declarers and gets no hint)
- `test/orchestrators/plugin/dependency-plan.test.ts:158-173` (`refusal()` helper; 2 call sites, `:445`, `:721`)
- `docs/output-catalog.md:984` + fixture `test/architecture/catalog-uat/fixtures/plugin-install.ts:789` (`helper@official` declares `formatter@tools` → hint applies)
- Any CAS-07 scenario written earlier (its cause ends in `cannot move: ...`)

**New offline scenario** (`install-dependencies.feature`, after `:289`): copy the `:289` setup and add `Given the git host drops the connection for the plugin "lib"` before the `When`. Expected lib cause: the probed text above + `. To look for a version in range, run /claude:plugin update lib@tools.` Expected records: `lib@tools 1.0.0 true` only. Without the change, the scenario fails on the missing hint.

### Pattern 5: CAS-07 — bound the stage-two version

`describeConstraint` interpolates `line.version` with no transformation, and its doc comment says so [VERIFIED: constraint-fold.ts:173-189, `` `version ${line.version} ` ``]. The value reaches it from `admitResolvedVersion(admits, toVersion)` → `describeConstraint(rejecting, { arm: "out-of-range", version: toVersion })` [VERIFIED: constraint-fold.ts:367]. Change it to `version ${truncateForRefusal(line.version, 64)} ` and correct the comment (it cites the opposite).

Upstream renders a version through `ce(i)`: kept as-is if `/^[0-9A-Za-z][0-9A-Za-z.+-]{0,63}$/`, else `gd(Mt(e,64))`, which also wraps it in curly quotes [VERIFIED: upstream src.js]. D-PL3-12 adopts only the 64 cut. The quoting is part of the deferred normalization.

Same-class sites the decision does not name, all in owned files, so the planner can choose to include them or leave them recorded: `dependency-move.ts::refusalCause` `` `version ${verdict.toVersion} is the newest version it can move to` `` (:151) and `` `version ${prepared.toVersion} was ruled out by the plan` `` (:183); messaging `is installed at version ${recordedVersion}` (recorded value, not catalog text).

**Scenario:** like `:176`, with the catalog `lib` version `1.5.0-` followed by more than 60 alphanumerics, so the whole string is over 64 code units. The cause then shows `cannot move: version <first 64 code units>… falls outside what the combined range admits (^2.0.0) -- required by "app@tools"`, plus the CAS-06 hint once that lands.

### Records for CAS-03 / CAS-04 (no code)

- `extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts:40-44`: the PL-5 bullet gains "a recorded divergence from Claude Code, which shows no upgrade state on `list` (D-PL3-07)". This is a build input, so the commit runs `check:commit`. No test changes.
- `docs/dependency-resolution.md` "The load-time check" (around line 277): one sentence. A dependency that is installed with some component kinds unsupported does not change its dependents' status, as in Claude Code. Only a missing, disabled, or out-of-range dependency does (D-PL3-06).
- `.planning/PROJECT.md` Key Decisions table (around line 1438, where `D-MF-03` and `AAP-D1` live): one row each for D-PL3-06 and D-PL3-07. AGENTS.md says a divergence is licensed by "a recorded project decision ... with an ID". The PRD PL-5 row (`docs/prd/pi-claude-marketplace-prd.md:357`) may gain a pointer to D-PL3-07.

### Anti-Patterns to Avoid
- **Adding the member list to `DependencyClosureResult` in the domain:** churns about 12 exact `deepStrictEqual` failure literals in `test/domain/dependency-closure.test.ts`. The cascade can compute it without that churn.
- **A required field on `CascadeFailureSubject`:** breaks the three MISS-01 literal subjects in `install-flow.ts` and `dependency-plan.ts::unmovable`/`previewFresh`.
- **Lookup-first for every walk:** hands `enable-disable.ts` an arm it renders as `... (undefined).`
- **Truncating inside `DirectoryPinUnsatisfiedError`:** `shared/` may not import `domain/`.
- **Committing the CAS-02 domain arm alone:** `closureFailureFacts` (exhaustive switch under `noImplicitReturns`) and `failureDeclarers` stop compiling, and the pre-commit hook fails.
- **Piping `npm run check`** (`| tail`): the exit status is lost (memory "Green runs that checked nothing").

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recording walk edges | a second lookup wrapper | hoist `walkDependencyGraph`'s wrapper (install-cascade.ts:1803-1816) | `fallow dupes` fails on clones; one recorder serves CAS-01 and CAS-05 |
| Requesters of a key | a new edge scan | `requestersOf` (install-cascade.ts:1719-1732) | already walk-ordered and deduped per declarer |
| Row ordering | local sort | `sortRows` → `compareByNameThenScope` | catalog "Order" convention |
| Cut with surrogate safety | ad hoc `slice` at every site | one `dependency-range.ts` helper | D-PL3-09/12 mandate one helper |
| Reason tokens | a new `{dependency skipped}`-style token | the existing `"dependency failed"` | D-PL3-02; closed sets pinned by `notify-closed-set-locks.test.ts`, `compat-01-no-expansion.test.ts` |

## Common Pitfalls

### Pitfall 1: Catalog count and byte pins live in three files
**What goes wrong:** a new `<!-- catalog-state: ... -->` block fails three tests.
**Where:** `test/architecture/catalog-uat/catalog-contract.test.ts:21-22` (`EXPECTED_STATE_COUNT = 323`, `EXPECTED_UTF8_BYTES = 54_039`) and its title at `:272` ("... 323 exact documented states"); `catalog-parser.test.ts:73,81` (`323`); `catalog-wire.test.ts:727` (`323`). [VERIFIED: grep + read]
**How to avoid:** prefer editing existing blocks (bytes change, count does not). If CAS-02 gets its own state, bump all four places. Every other phase in this milestone also edits `EXPECTED_UTF8_BYTES`, so merges will conflict there. Recompute after merging with `node --test test/architecture/catalog-uat/catalog-contract.test.ts` (the failure prints the actual value).

### Pitfall 2: Catalog examples that become untrue
Under CAS-01, the `dependency-cycle` example (`helper → formatter → linter → formatter`, output-catalog.md:1102-1110) would now also show `⊘ linter@tools (failed) {dependency failed}`, because `linter` was looked up. `dependency-version-conflict` (:960-972) says "Two plugins in one graph declared" `formatter`, so the second declarer would now get a row too. Update those examples and their fixtures in `fixtures/plugin-install.ts` (or pick declarers that make the example still true), and extend the "Failure attribution" paragraph (:900). `dependency-installed-version-conflict` (:984) gains the CAS-06 hint. `dependency-directory-pin-unsatisfied` (:1146-1157) prose should state the 120 cut and "every plugin that declared a range".

### Pitfall 3: Orchestrated surfaces classify every cascade cause as `{dependency failed}`
`cascadeFailureCause` wraps every closure fact in `DependencyCascadeError`, and `classifyOrchestratorThrow` maps that class to `"dependency failed"` [VERIFIED: apply-outcomes.ts:742-745]. A config-declared `_x@mp` installed by `apply`/a load/`import` therefore reads `{dependency failed}`, with the new invalid-id cause line. The same happens today for the root's own `unusable-declaration`. Fixing it means touching `apply-outcomes.ts` (Phase 1's file). Record it as a known limit. CAS-02 is about `install`.

### Pitfall 4: Duplicate rows with the `moved` rows of a planned install
`handleCascadeThrow` appends `movedRows(args.moved)` after `composeCascadeFailureMessage` [VERIFIED: install-flow.ts:1806-1816]. If a disabled dependency was moved (pin refresh row `{already disabled}`) and the final cascade then fails before its re-enable phase, that key is in `unmaterialized` **and** has a moved row. Mitigation: mirror the success path, which already excludes moved keys (`composeCascadeMemberRows`, messaging:268-270). Pass `moved` into `composeCascadeFailureMessage`, or filter in `handleCascadeThrow` (a second small `install-flow.ts` touch). Add a unit case either way.

### Pitfall 5: Root ledger failures stay single-row
When the **root's** own ledger throws, `unwrapCascade` records no subject (`cascade.key !== rootKey` guard), and the single-plugin failure path renders one row. Every dependency before the root in post-order was materialized and rolled back, yet gets no row. Covering it means changing install-flow's single-row path (outside Files, Phase 11 splits that file). Recommend recording it as a known gap in the SUMMARY (see Open Question 2).

### Pitfall 6: Plan-step failures do not pass through `composeCascadeFailureMessage`
Move-step failures (`:845`, `:992`) and `previewFresh` refusals render through the plan runner. Fresh members of later steps get no row. These are UPD-DEP-D1 / Phase 4 paths; record it.

### Pitfall 7: Untrusted name in the invalid-id cause
The cause interpolates a name that is, by definition, outside the token allowlist. It comes from the user's argument, but must also be listed by a (possibly hostile) manifest. Cause chains render verbatim (only credentials are redacted) [VERIFIED: shared/errors.ts:182-196]. Today's root cause already interpolates the raw key, so this is not new. Still, escape `\p{Cc}\p{Cf}\p{Zl}\p{Zp}` as `shared/notification-mcp.ts::printable` does (module-private there), or bound it, and note the residual under T-06-02.

### Pitfall 8: Two complexity gates
`sonarjs/cognitive-complexity: 15` and fallow `maxCognitive: 15` / `maxCyclomatic: 20` are scored independently. `resolveCascade`, `closureFailureFacts` and `composeCascadeFailureMessage` grow. Extract small helpers (`unmaterializedAfterWalk`, `memberFailureRows`) rather than nesting.

### Pitfall 9: The hint must not appear without a judged move
`checkInstalledMember` builds `installed-unsatisfied` without `moveRefusal` (enable/reload paths). D-PL3-11 scopes the hint to the `cannot move:` form. Gate on `moveRefusal !== undefined`.

## Code Examples

### Member rows in the failure block (messaging)
```typescript
// Source: pattern of composeCascadeMemberRows (install-cascade.messaging.ts:249-286)
function unmaterializedRows(keys: readonly string[], exclude: ReadonlySet<string>): PluginFailedMessage[] {
  return keys
    .filter((key) => !exclude.has(key))
    .map((key) => ({
      status: "failed",
      name: key,
      reasons: ["dependency failed"],
      severity: "error",
      needsReload: false,
    }));
}
```

### Current walk-recording wrapper to hoist
```typescript
// Source: install-cascade.ts:1803-1816 (verbatim shape)
lookup: async (subject) => {
  const looked = await options.lookup(subject);
  if (looked.kind === "found") {
    declared.set(
      subject.key,
      looked.dependencies.map((dependency) => ({
        key: `${dependency.name}@${dependency.marketplace ?? subject.marketplace}`,
        ...(dependency.version !== undefined && { range: dependency.version }),
      })),
    );
  }

  return looked;
},
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Root key checked against the token rule before lookup | Lookup first; listed + invalid → id refusal (upstream `TKn`) | this phase | `_x@mp` unlisted → `{not in manifest}`; listed → `{invalid manifest}` with the upstream cause |
| First declarer only in the directory pin refusal | Every range-declaring cascade member (upstream `dr`) | this phase | `required by "app", "mid"` |
| Unbounded version in a hold cause | 64 code units + `…` | this phase | VERSTR-01 closed at render |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Our closure post-order matches upstream's closure order closely enough that "reverse post-order" reproduces upstream's requirer order | Pattern 3 | Requirer order differs from Claude Code for some diamonds; cosmetic |
| A2 | Installed outside-closure requirers (D-PL3-08 second half) cannot be named consistently while D-03-10 keeps their ranges out of the check | Open Question 1 | If the user wants them named anyway, a scan of installed declarations (fail-closed reads, `dependency-index.ts`) is needed, and it can fail an unrelated install |
| A3 | The `catalogLookup` member subject (a lookup that throws, install-flow.ts:861-870) carries no member list, which is acceptable | Pattern 1 | Rare route shows no member rows |

## Open Questions

1. **D-PL3-08's "installed plugins outside the closure that already do"**
   - What we know: upstream folds outside-closure installed ranges into the check (`rs=[...ts.get(ii)??[],...ga.get(ii)??[]]`, with `{ranges: ga, requirers: dr} = _Co(Jt, Yr)`) [VERIFIED: upstream src.js]. This extension deliberately does not (D-03-10, header of `domain/dependency-closure.ts:34-37`). Root requirers on the MISS-01 path already arrive via `rootRequiredBy`.
   - What's unclear: naming a requirer whose range is not in the printed ranges or in the check would misreport.
   - Recommendation: implement the cascade-member half now. For a non-root fresh member, record that outside-closure requirers are not named because D-03-10 keeps their ranges out. Confirm with the user before planning a declaration scan.
2. **Root ledger failures (Pitfall 5)**: the dependencies rolled back behind a failing root get no row. Recommendation: record it as a gap (install-flow.ts single-row path, Phase 11). Do not extend in this phase.
3. **Case after the colon in D-PL3-04**: the locked text says `invalid: each part`; upstream says `invalid: Each part`. Recommendation: use the locked text verbatim (lowercase `each`).
4. **Same-class version interpolations in `dependency-move.ts`** (Pattern 5): include them under CAS-07, or record them. Recommendation: include `refusalCause`'s `toVersion` sites (owned file, same helper, a handful of lines), or leave them to the planner.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | ✓ | v26.12.1 (engines `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0`) | — |
| npm / `node_modules` in this worktree | checks | ✓ | present | — |
| cucumber-js + https git host stand-in | scenarios | ✓ | a 3-scenario probe ran in 13.6 s | — |
| optional peers for integration tests | `npm run test:integration` | installed on demand by `scripts/install-test-peers.mjs` | — | — |

No missing dependencies.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (unit, integration), `@cucumber/cucumber` (behavioral), catalog UAT under `test/architecture/catalog-uat/` |
| Config file | `package.json` scripts, `cucumber.json` (`order: random`, `parallel: 8`) |
| Quick run command | `node --test <test-path>`; one case: `node --test --test-name-pattern '<title>' <test-path>` |
| Pair coverage | `npm run test:coverage:direct -- <source-or-test-path>` (100% line/function/branch of the source from its own test) |
| One scenario | `npx cucumber-js --name '<scenario title>'` (or a feature path) |
| Feature lint | `npm run check:features` |
| Full suite command | `npm run check` (never piped; check `$?`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAS-01 | walk failure gives `lib@tools (failed) {dependency failed}` | cucumber | `npx cucumber-js --name 'Installing a plugin with a dependency its marketplace does not offer fails as not in manifest and installs nothing'` | ✅ (edit `:85-88`) |
| CAS-01 | constraint failure gives `mid@tools` row | cucumber | `npx cucumber-js --name 'Installing a plugin whose dependencies ask for versions that do not overlap fails as a version conflict and installs nothing'` | ✅ (edit `:139-142`) |
| CAS-01 | `unmaterialized` per route (walk/constraint/member, readThrough and root excluded, re-enable included) | unit | `node --test test/orchestrators/plugin/install-cascade.test.ts` | ✅ add cases; update ~22 exact failure literals |
| CAS-01 | member rows rendered, sorted, deduped vs failing key/root/moved | unit | `node --test test/orchestrators/plugin/install-cascade.messaging.test.ts` | ✅ add cases |
| CAS-01 | member-failed subject carries the list | unit | `node --test --test-name-pattern '<new title>' test/orchestrators/plugin/install-flow.test.ts` | ✅ add case |
| CAS-02 | listed `_x@fixtures` → `{invalid manifest}` with the upstream cause | cucumber | new scenario in `features/plugin/install.feature` | ❌ new |
| CAS-02 | unlisted `_x@fixtures` → `{not in manifest}`, `Plugin "_x" not found in marketplace "fixtures".` | cucumber | new scenario in `features/plugin/install.feature` | ❌ new |
| CAS-02 | domain arm: lookup-first under `installPolicy`, absent → `[root]`, no-policy → old arm | unit | `node --test test/domain/dependency-closure.test.ts` | ✅ add cases |
| CAS-02 | three wording variants (plugin / marketplace / both) | unit | `node --test test/orchestrators/plugin/install-cascade.messaging.test.ts` | ✅ add cases |
| CAS-02 | `__proto__@hostile` pin | integration | `node --test test/integration/reserved-record-keys.test.ts` | ✅ edit `:388-396` |
| CAS-03/04 | records only | — | `npm run check` (comment + docs) | n/a |
| CAS-05 | `required by "app", "mid"` | cucumber | new scenario after `install-dependencies.feature:412` | ❌ new |
| CAS-05 | listed version over 120 cut with `…` | cucumber | new scenario (130-char `dirp` version) | ❌ new |
| CAS-05 | helper: no cut ≤ limit, cut + `…`, lone high surrogate dropped | unit | `node --test test/domain/dependency-range.test.ts` | ✅ add `describe` |
| CAS-05 | requirer list from edges, range-less declarers excluded, order | unit | `node --test test/orchestrators/plugin/install-cascade.test.ts` | ✅ add cases |
| CAS-05 | name/version/requirer cut in `assertDirectoryPinSatisfied` | unit | `node --test test/orchestrators/plugin/install-outcome.test.ts` | ✅ add case |
| CAS-06 | hint on `:193`, `:226`, `:658`, `update-dependencies.feature:124` | cucumber | `npx cucumber-js features/plugin/install-dependencies.feature features/plugin/update-dependencies.feature` | ✅ edit |
| CAS-06 | offline git move names the next step | cucumber | new scenario next to `:289` | ❌ new |
| CAS-06 | hint only when the root declares it and a move was judged; period join | unit | `node --test test/orchestrators/plugin/install-cascade.messaging.test.ts` | ✅ edit `:774-803` + add |
| CAS-06 | `unmovable` carries requester keys | unit | `node --test test/orchestrators/plugin/dependency-plan.test.ts` | ✅ edit `refusal()` |
| CAS-07 | long catalog version cut at 64 in a hold cause | cucumber | new scenario in `install-dependencies.feature` | ❌ new |
| CAS-07 | `admitResolvedVersion` with a >64 version | unit | `node --test test/orchestrators/plugin/constraint-fold.test.ts` | ✅ add case |
| catalog | changed blocks byte-match fixtures | unit | `node --test test/architecture/catalog-uat/catalog-contract.test.ts test/architecture/catalog-uat/catalog-parser.test.ts test/architecture/catalog-uat/catalog-wire.test.ts` | ✅ edit |

### Sampling Rate
- **Per task commit:** the owner test files above, plus `npm run test:coverage:direct -- <changed source>` for each changed source. The pre-commit hook then runs `check:commit` (static checks, unpaired tests, direct coverage of the staged pairs). Run `npx cucumber-js --name '<title>'` for each changed or new scenario (`check:commit` runs no cucumber).
- **Per wave merge:** `npm run check` on the combined tree.
- **Phase gate:** `npm run check` green before `/gsd-verify-work`.

### Wave 0 Gaps
- None. All test files and step definitions exist. Every new scenario uses existing steps: `the marketplace {string} offers these plugins:` / `... with dependencies:` / `... from git repositories:`, `the git repository {string} holds these plugins:` / `has a revision only the tag ...`, `the git host drops the connection for the {git repository}`, `the user has run`, `the result has these fields:`, `the result lists these plugins:`, `the installation record of the {word} scope holds these plugins:`. Publishing a plugin named `_x` works (probed).

## Parallelization (proposed waves; executors share one worktree)

| Wave | Plan | Requirements | Files (exclusive within the wave) |
|------|------|--------------|-----------------------------------|
| 1 | A | CAS-07 + helper | `domain/dependency-range.ts`, `test/domain/dependency-range.test.ts`, `orchestrators/plugin/constraint-fold.ts`, `test/orchestrators/plugin/constraint-fold.test.ts`, `features/plugin/install-dependencies.feature` (new CAS-07 scenario only); optional `dependency-move.ts` (+ test) |
| 1 | B | CAS-02 | `domain/dependency-closure.ts` (+ test), `install-cascade.ts` (`failureDeclarers` only), `install-cascade.messaging.ts` (+ test), `test/integration/reserved-record-keys.test.ts`, `features/plugin/install.feature`, `docs/output-catalog.md`, `catalog-uat/fixtures/plugin-install.ts`, catalog count/byte pins |
| 1 | C | CAS-03, CAS-04 records | `orchestrators/plugin/list-flow.ts` (comment), `.planning/PROJECT.md` (Key Decisions), optional `docs/prd/...prd.md` |
| 2 | D | CAS-01 | `install-cascade.ts` (+ test), `install-cascade.messaging.ts` (+ test), `install-flow.ts` (`unwrapCascade` +1 line; optional `handleCascadeThrow`) (+ `install-flow.test.ts`), `install-dependencies.feature` (`:84-88`, `:139-142`), `docs/output-catalog.md` + fixtures + byte pin |
| 3 | E | CAS-05 | `install-cascade.ts` (+ test), `install-outcome.ts` (+ test), `install-dependencies.feature` (new scenarios near `:412`), `docs/output-catalog.md` prose |
| 4 | F | CAS-06 + docs | `dependency-plan.ts` (+ test), `install-cascade.ts` (arm type), `install-cascade.messaging.ts` (+ test), `install-flow.test.ts:18359`, `install-dependencies.feature` (`:193`, `:226`, `:658`, new offline scenario, the CAS-07 scenario's cause), `update-dependencies.feature:124`, `docs/output-catalog.md` + fixture, `docs/dependency-resolution.md` (all phase rows: `{dependency failed}`, `{invalid manifest}`, hint, D-PL3-06) |

Shared across requirements: `install-cascade.ts` (B, D, E, F), `install-cascade.messaging.ts` + test (B, D, F), `install-dependencies.feature` (A, D, E, F), `docs/output-catalog.md` + `fixtures/plugin-install.ts` + `EXPECTED_UTF8_BYTES` (B, D, E?, F). Wave 1's A and B touch different feature files and only B touches the catalog. Plan C may instead own `docs/dependency-resolution.md` if F should stay smaller. Then F must not edit that file.

Forced touches outside the Files line, all to name in the SUMMARY: `install-flow.ts` (`unwrapCascade`, maybe `handleCascadeThrow`; Phase 4 owns only planning/missing-dependency functions there), `install-outcome.ts` (`assertDirectoryPinSatisfied`; Phase 1/4 own other functions), `dependency-plan.ts` (`unmovable`; Phase 4's file), `docs/dependency-resolution.md`, the integration test, and the catalog-UAT fixtures and pins.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation / Output Encoding | yes | token allowlist (`domain/dependencies.ts`); new length cuts (D-PL3-09/12); escape control/format code points in the invalid-id cause (Pitfall 7) |
| V6 Cryptography | no | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Manifest-controlled name/version floods or forges a line-oriented row (T-06-02, T-29-24) | Tampering / Spoofing | bound length (64/120 cut), keep tokens allowlisted, escape `\p{Cc}\p{Cf}\p{Zl}\p{Zp}` where a non-token name is interpolated |
| Invalid root id lookup triggers a marketplace add/clone (D-MF-04) | Elevation (unexpected network) | same as for any valid root: only a marketplace the user added to a scope can be resolved; no new trust edge |
| Control characters in a catalog/plugin.json `version` reach cause lines | Tampering | pre-existing (T-29-21 accepted); the cut bounds length only, normalization deferred |

## Project Constraints (from CLAUDE.md / AGENTS.md)

- Read before editing; trace callers before changing a function.
- Never commit to `main`; no rebase/history rewrite; commit per `.agents/skills/committing/SKILL.md`; never `--no-verify`; no `git add -A` (the operator edits concurrently).
- Upstream parity is the default; a divergence needs a recorded ID (D-PL3-06/07 must be recorded) or a Pi capability gap.
- A user-visible `/claude:plugin` change ships with a cucumber scenario that fails without it (`cucumber` skill rules: lowercase steps, Given/When/Then only, full-row tables, no `And`).
- `npm run check` (typecheck, ESLint `--max-warnings 0`, fallow with dupes/health/rule packs, Prettier, pairing, features check, unpaired, integration, cucumber, 100% direct coverage per pair) must stay green. GSD gates run it on the combined tree.
- All output through `shared/notification-dispatch.ts`; no `console`/stdio; no new closed-set members (D-PL3-02).
- Every plan SUMMARY includes `## Threat Flags`.
- Comments cite durable IDs (D-PL3-xx, CAS-0x), never phase/plan numbers; no comments on trivial code.
- Every exported function declares its return type; no `!`/`as` escapes in `extensions/`; `sonarjs/no-nested-conditional` and `no-nested-template-literals` are errors.
- Tests: `test()` cases with `// arrange`/`// act`/`// assert`; whole-value `deepStrictEqual`; expected values built independently; hermetic home helpers only (never the real `~/.pi`).
- Prefix `gsd-tools windows append --description` with `[plugin-lifecycle]`.

## Sources

### Primary (HIGH confidence)
- In-repo source read this session: `domain/dependency-closure.ts` (whole), `domain/dependency-range.ts:1-60,270-301`, `domain/dependencies.ts:40-75`, `domain/name.ts:1-60`, `orchestrators/plugin/install-cascade.ts:1-1280,1400-1849`, `install-cascade.messaging.ts` (whole), `dependency-move.ts` (whole), `dependency-plan.ts:50-561`, `dependency-bindings.ts:160-200`, `constraint-fold.ts:98-200,330-425`, `install-flow.ts:790-960,1015-1135,1775-1830,2070-2110,2280-2365,3040-3140`, `install-outcome.ts:175-195,800-840`, `enable-disable.ts:660-810,1366-1432`, `shared/errors.ts:140-242,1180-1250`, `shared/notification-mcp.ts:50-80`, `apply-outcomes.ts:740-800`, `edge/handlers/plugin/shared.ts:20-60`, `list-flow.ts:30-60`.
- Tests and fixtures read: `test/integration/reserved-record-keys.test.ts:1-80,340-410`, `catalog-uat/catalog-contract.test.ts:1-60,270-300`, `catalog-uat/fixtures/plugin-install.ts:774-1186`, `dependency-plan.test.ts:146-175`, `install-cascade.messaging.test.ts:771-803`, `install-flow.test.ts:18340-18365`.
- Features read: `features/plugin/install-dependencies.feature` (all failing scenarios), `install.feature:1-75`, `git-source.feature:165-192`, `update-dependencies.feature:95-130`; step modules `git-host.steps.ts`, `plugin/publishing.steps.ts`, `marketplace/publishing.steps.ts`.
- Docs read: `docs/output-catalog.md:895-1160`, `docs/dependency-resolution.md:273-405`, skills `cucumber` (all rules), `local-verification` (all rules), `typescript-unit-tests` (SKILL + cases).
- Claude Code 2.1.310 extracted JS (scratchpad `src.js`): `omn`/`Uh` (move hint), `TKn` (invalid id), `re`/`J9` (cut), directory-pin message and `dr`/`_Co` requirers, `unrecordable-plugin-id` check.
- Runtime probe: three throwaway cucumber scenarios (outside the repo, deleted afterward) recorded today's `_x@fixtures` (listed and unlisted) and offline git-move output.

### Secondary / Tertiary
- None. No web research was needed; upstream evidence E1-E7 comes from CONTEXT.md and the binary.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (no new packages)
- Architecture / data flow: HIGH (every route and subject constructor read; current output probed)
- Pitfalls: HIGH for 1-4, 7-9 (read in code); MEDIUM for 5-6 (scope judgment)
- Upstream requirer order (A1): MEDIUM

**Research date:** 2026-10-26
**Valid until:** until the next merge that touches `install-cascade.ts`, `install-flow.ts` or `dependency-plan.ts` (Phases 1, 4 and 11 edit neighbors); line numbers are as of `3b50310b`.
