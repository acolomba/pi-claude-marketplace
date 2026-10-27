---
phase: 03-dependency-cascade-rows-and-status
reviewed: 2026-10-27T06:28:39Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - extensions/pi-claude-marketplace/domain/dependency-closure.ts
  - extensions/pi-claude-marketplace/domain/dependency-range.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/constraint-fold.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-plan.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts
  - extensions/pi-claude-marketplace/shared/notification-mcp.ts
  - features/plugin/install-dependencies.feature
  - features/plugin/install.feature
  - features/plugin/update-dependencies.feature
  - features/plugin/update.feature
findings:
  critical: 0
  warning: 1
  info: 4
  total: 5
status: issues_found
fixed:
  - id: WR-01
    commit: 5f998085
  - id: IN-01
    commit: e764aac9
  - id: IN-02
    commit: 8da37b6d
skipped:
  - id: IN-03
    reason: not in the fix scope the operator chose
  - id: IN-04
    reason: not in the fix scope the operator chose; the plan-step path belongs to Phase 4 (D-PL3-15)
---

# Phase 3: Code Review Report

**Reviewed:** 2026-10-27T06:28:39Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

I reviewed the hunks changed since `4b623b71` in the 11 source files and 4 feature files. The locked decisions D-PL3-01..17 in `03-CONTEXT.md` are treated as intended behavior. The gaps that D-PL3-15 and `03-03-SUMMARY.md` record are not reported as findings: the root's own ledger failure, plan-step failures, the `catalogLookup` throw mid-walk, and the subjects built by `unmovable` and `previewFresh`, none of which carry a member list.

I traced these paths:

- **CAS-01 member lists.** The closure, constraint, and member-failed producers in `install-cascade.ts`. The forwarding through `unwrapCascade` and `walkRefusal`. The exclusion of `moved` keys in `handleCascadeThrow`. The cause-less-row filter in `dependency-bindings.ts`.
- **CAS-02 root lookup.** `refuseUnsplittableRoot` against every `ClosureLookup` implementation (`catalogLookup`, `planningCatalog`, `candidateLookup`, `enableCascadeLookup`). None of them builds a path from the unchecked halves. `ownValue` guards the record reads. The root marketplace add already happened before this change, in `loadInstallRootAllowlist`, so the lookup-first order adds no new side effect.
- **CAS-05 requirers.** `rangeRequirers` over the `recordingLookup` edge map.
- **CAS-06 hint.** The hint path through `unmovable` and `declaredBy`.
- **CAS-07, D-PL3-16 truncation.** The truncation sites.

I compared the upstream invalid-id wording with the 2.1.310 binary. All three halves and the trailing `it`/`both` match.

One defect remains in scope: an unbounded version still reaches a refusal sentence that this phase rewrote. I found no correctness or security blocker.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: The installed-unsatisfied refusal still prints the recorded version uncut

**Status:** fixed in `5f998085`. `installedUnsatisfiedCause` cuts `recordedVersion` with `truncateForRefusal(…, MAX_REFUSAL_VERSION_CHARS)`. A unit case and the `install-dependencies.feature` scenario "Installing a plugin whose installed dependency records a very long version shows the version cut to 64 characters in the version conflict" (an 80-character recorded version) fail without the change. The catalog pins use a short version and do not change.

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts:408`

**Issue:** `installedUnsatisfiedCause` was rewritten in this phase for the CAS-06 hint. Its `head` sentence still interpolates `failure.recordedVersion` raw:

```ts
const head = `Dependency "${failure.key}" is installed at version ${failure.recordedVersion}, which does not satisfy ${failure.range}`;
```

`recordedVersion` is the version that was recorded at install time. It came from `plugin.json` or the marketplace entry, and per E6 nothing bounds that string at parse time. That is the same class D-PL3-12 and D-PL3-16 bound to 64 code units in `describeConstraint` and `dependency-move.ts`. E4 records that Claude Code cuts every version it quotes in a refusal at 64, and E5's sentence `Dependency "lib@mp" is installed at 1.0.0, which does not satisfy …` is exactly this one. `03-RESEARCH.md:309` lists the site as the same class, and the plan left it out. The phase's CAS-07 goal is therefore only partly met.

**Failure scenario:** `lib@tools` is installed from a catalog whose `plugin.json` declares a 4,000-character `version`. The user then runs `/claude:plugin install app@tools`, and `app` declares `lib@^2.0.0`. The plan refuses the move. The cause line prints all 4,000 characters inside the sentence, followed by the moveRefusal (whose own version this phase did cut) and the new hint. The same refusal reaches `apply` and `import` through `cascadeFailureCause` as their `cause` string.

**Fix:**

```ts
const recorded = truncateForRefusal(failure.recordedVersion, MAX_REFUSAL_VERSION_CHARS);
const head = `Dependency "${failure.key}" is installed at version ${recorded}, which does not satisfy ${failure.range}`;
```

Import both names from `../../domain/dependency-range.ts`. This needs a messaging test with an over-long `recordedVersion`. The row's `version` column (`facts.version`) can stay under T-29-21, as the other version slots do.

## Info

### IN-01: The comment says "nearest the requested plugin first", but the order is reverse post-order

**Status:** fixed in `e764aac9` (second option, comment only). The `rangeRequirers` doc now says reverse install order, the closure's post order reversed, and that this is not the order of distance. No behavior change.

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts:964` (doc), `:982-985` (code)

**Issue:** The doc claims the requirers come "nearest the requested plugin first, which is the reverse of the closure's post order". These are not the same order.

Take the graph `app -> [a, b]`, `a -> x@^1`, `b -> c -> x@^1`. The post order is `x, a, c, b, app`, so the reversed filter yields `c, a`. But `a` is one hop from `app` and `c` is two hops away. The walk's own lookup order, which `requestersOf` already returns, would yield `a, c`. The two scenarios in the feature file cannot tell the orders apart, because their declarers are `app` and `mid`, and both orders agree there.

**Fix:** Pick one of these:

- Return `requestersOf(...)` in the walk order it already has, and drop the `closure.reverse()` pass.
- Keep the reverse post-order and rewrite the comment to say that, without the "nearest" claim.

### IN-02: The invalid-id row escapes the name in its cause but not in its subject

**Status:** fixed in `8da37b6d`. Reachable: neither the edge nor the manifest parser restricts a plugin name, and an install of a listed `zero<U+200B>width@fixtures` printed the name raw. `composeCascadeFailureMessage` now passes the row name through `printable` for the `invalid-root-id` arm only. The JSON `id` of that row follows its name, so it is escaped too. The marketplace half (the block header) and the `DependencyCascadeError.key` field stay raw. A unit case and the `install.feature` scenario "Installing a plugin whose name holds a zero-width space shows the name escaped in its failed row" fail without the change.

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts:390` (cause), `:648` (row name)

**Issue:** D-PL3-14 escapes the key in the `invalid-root-id` cause with `printable`. That arm only fires for a name outside the token allowlist. The same row's subject is `args.rootName`, which is rendered raw. The `DependencyCascadeError` `key` field also holds the raw key. A listed plugin whose name holds a bidi override or another format character therefore prints escaped in the cause and unescaped in the row head. Per D-PL3-17, `apply`, a load, and `import` reach the same row for a config-declared key.

Upstream escapes nothing. It appends ` The name holds a character that is not shown here.` and maps `"` to `”`. So both halves of this row diverge from upstream, but in different ways.

**Fix:** Pass the printable form as the row name for this arm. For example, `name: isRoot ? printableIfInvalid(args.rootName) : facts.key`, gated on `facts.reasons` or a flag from `closureFailureFacts`. Or record the asymmetry as accepted beside D-PL3-14.

### IN-03: The cascade messaging imports `printable` from the MCP notice module

**Status:** skipped: not in the fix scope the operator chose.

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts:8`, `extensions/pi-claude-marketplace/shared/notification-mcp.ts:71`

**Issue:** `printable` is a general escaping helper. It now has a second consumer, outside the MCP notices, through a module named for MCP rendering. A later change to the MCP notice text, or a later move of `notification-mcp.ts`, now affects install refusals through an import that is not obvious.

**Fix:** Move `printable` and its `ESCAPED_CODE_POINT` and `codeUnitEscapes` helpers into a neutral leaf in `shared/`, for example `shared/printable.ts`. Import it from both places.

### IN-04: The plan-step move note still interpolates raw versions (outside the reviewed files)

**Status:** skipped: not in the fix scope the operator chose; the site is on the plan-step path that D-PL3-15 assigns to Phase 4.

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:917`

**Issue:** `postFetchGuard` builds `` `version ${toVersion} is not version ${expectVersion}, which the dependency plan chose` `` with both versions uncut. It is reached from `runDependencyMove` (`dependency-move.ts:289`), which is the plan-step path that D-PL3-15 assigns to Phase 4. So it is not this phase's defect. It is the last same-class version interpolation that D-PL3-16 does not name.

**Fix:** In Phase 4, apply `truncateForRefusal(…, MAX_REFUSAL_VERSION_CHARS)` to both versions, or record the site with the D-PL3-16 decision.

---

_Reviewed: 2026-10-27T06:28:39Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
