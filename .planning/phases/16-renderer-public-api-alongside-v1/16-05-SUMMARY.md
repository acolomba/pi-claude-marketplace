---
phase: 16-renderer-public-api-alongside-v1
plan: 05
subsystem: shared
tags: [typescript, notify, v2, public-api, severity-ladder, reload-hint, soft-dep-probe]

# Dependency graph
requires:
  - phase: 15-shared-notify-type-model
    provides: NotificationMessage, MarketplaceNotificationMessage, PluginNotificationMessage (10-variant union), causeChainTrailer
  - phase: 16-renderer-public-api-alongside-v1 (16-01, 16-03, 16-04)
    provides: planning context (16-CONTEXT.md, 16-PATTERNS.md), file-private renderMpHeader (plan 03) + renderPluginRow + SoftDepStatus type co-import (plan 04)
provides:
  - Public `notify(ctx: ExtensionContext, pi: ExtensionAPI, message: NotificationMessage): void` -- the sole V2 state-change notification surface (SNM-12 / D-16-01)
  - File-private RELOAD_HINT_TRAILER literal "/reload to pick up changes" duplicated inline per D-16-04 / D-16-12; consumed by the body composer's reload-hint append discipline (D-16-13)
  - File-private computeSeverity(message): "warning" | "error" | undefined first-match ladder (D-16-11)
  - File-private shouldEmitReloadHint(message): boolean trigger predicate (D-16-12: any state-changing plugin status OR any state-changing marketplace status -- explicitly NOT failed)
  - File-private composition helpers (renderIndentedCauseChain / composeRollbackPartialLines / composePluginLines / composeMarketplaceBlock) keeping notify() body under the 15-cognitive-complexity ceiling
  - ExtensionAPI co-imported as type from ../platform/pi-api.ts; softDepStatus imported as value (single probe-per-invocation per D-16-14)
  - eslint.config.js MSG-Block 4a ignores: extended to cover shared/notify.ts as the V2 reload-hint chokepoint (alongside the V1 chokepoint at presentation/reload-hint.ts)
  - Both `void renderMpHeader;` (plan 03) and `void renderPluginRow;` (plan 04) self-references DELETED -- notify() is now their sole module-internal consumer
affects: [16-06 notify-v2 unit tests, 17 catalog UAT rewrite, 18-20 orchestrator + edge call-site migration, 21 final teardown]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sole-public-surface entry point: notify(ctx, pi, message) is the V2 mirror of V1's severity-named wrappers (notifySuccess / notifyWarning / notifyError); structurally identical in its ctx.ui.notify(body, severity?) emit shape, structurally different in that severity, reload-hint, and soft-dep probe are computed FROM CONTENTS at notify time instead of demanded from the caller"
    - "Cognitive-complexity factoring: the notify() body decomposes into four pure-string helpers (renderIndentedCauseChain / composeRollbackPartialLines / composePluginLines / composeMarketplaceBlock), each with single-digit cognitive complexity, keeping the top-level notify() function below the project's 15-cognitive-complexity ESLint ceiling. The factoring mirrors V1's cascade-summary.ts:77-88 + compact-line.ts per-variant-helper composition"
    - "First-match severity ladder via two short-circuit passes over message.marketplaces[][].plugins[]: pass 1 returns 'error' on any failed (plugin OR marketplace); pass 2 returns 'warning' on any skipped / manual recovery; otherwise undefined (omit 2nd arg -- info severity per V1 notifySuccess precedent). Single-traversal optimization rejected here for readability -- the predicates are independent and the two-pass form makes the D-16-11 ladder structure visible at a glance"
    - "Reload-hint trigger predicate: single first-match-short-circuit pass returning true on any state-changing marketplace status (added/removed/updated -- NOT failed per D-16-12 SNM-15 refinement) or any state-changing plugin status (installed/updated/reinstalled/uninstalled). Failed marketplace operations and failure-class plugin statuses (failed/skipped/manual recovery) do NOT trigger the hint"
    - "Caller-order discipline (D-16-06): the body composer uses message.marketplaces.map(...) and inner for-of loops over mp.plugins without any sort -- caller orchestrator's order is honored end-to-end. compareByNameThenScope from presentation/sort.ts remains available to callers but notify() does not invoke it"
    - "Indent shape for nested cause-chain rendering: plugin row at 2 spaces (D-16-04); per-plugin cause-chain trailer at 4 spaces (D-16-08); rollbackPartial child row at 4 spaces (D-16-08); per-phase cause-chain trailer at 6 spaces (D-16-08). Centralized via renderIndentedCauseChain(cause, indent: string) so the indent prefix is a parameter, not a hardcoded literal at each call site"
    - "Empty-list-surface sentinel: the empty top-level marketplaces: [] payload renders exactly the bytes `(no marketplaces)` (planner pick per D-16-17 + Claude's Discretion). This is the bare D-15-09 representation of the (no marketplaces) rendering case; emitted unconditionally regardless of reload-hint or severity (a payload with empty marketplaces will be info-severity and hint-suppressed because no per-plugin / per-marketplace state-change triggers fire)"

key-files:
  created:
    - .planning/phases/16-renderer-public-api-alongside-v1/16-05-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts (additions: lines 1-7 imports patched; lines 850-1065 the V2 spec comment, RELOAD_HINT_TRAILER, computeSeverity, shouldEmitReloadHint, four composition helpers, public notify(); both trailing void self-references deleted)
    - eslint.config.js (MSG-Block 4a ignores list extended to include shared/notify.ts as the V2 reload-hint chokepoint; documenting comment block ties the exemption end to Phase 21)

key-decisions:
  - "Empty-marketplaces sentinel byte form chosen: `(no marketplaces)` -- planner pick per D-16-17 + Claude's Discretion; mirrors the parenthesized status-token convention used throughout the rest of the v2 grammar (e.g. `(installed)`, `(no plugins)` precedent from D-15-08)"
  - "rollbackPartial child row byte form chosen: `    [${phase.phase}] (rollback failed)` (4-space leading indent + bracketed phase identifier + parenthesized failure marker). Mirrors the worked example in 16-PATTERNS.md Analog #7 (`    [skills] (rollback failed) {permission denied}`); the reasons-block slot is intentionally omitted here -- per-phase reasons are not modeled in the Phase 15 type (only `phase.cause?` is carried), so emission stays minimal and the cause trailer at 6-space indent surfaces the depth-5 walker output via renderIndentedCauseChain(phase.cause, '      ')"
  - "Severity ladder structure: two passes over the same nested iteration with first-match short-circuit. Passes are independent (a second-pass match never overrides a first-pass match because pass 1 returns early). Single-traversal alternative was considered (single loop with `if (foundFailed) return 'error'; if (foundWarning) candidate = 'warning';`) and rejected for readability -- the two-pass form makes the D-16-11 ladder visible at a glance and aligns with the SonarCloud cognitive-complexity gate"
  - "notify() body factored into renderIndentedCauseChain / composeRollbackPartialLines / composePluginLines / composeMarketplaceBlock to stay below the project's 15-cognitive-complexity ESLint ceiling. The unfactored form ran at complexity 35 (~12 conditional branches + nested loops + early returns); factoring into pure-string helpers (each with single-digit complexity) keeps the top-level orchestration loop at complexity ~5"
  - "MSG-Block 4a (msg-rh-1-reload-hint) ESLint exemption for shared/notify.ts is the right scope: the rule's docstring explicitly describes itself as a composer-chokepoint literal-detection rule exempting the V1 reload-hint composer at presentation/reload-hint.ts; shared/notify.ts is the V2 reload-hint chokepoint with the same legitimate need to host the bare RELOAD_HINT_TRAILER literal as the source-of-truth declaration consumed by the file-private append discipline inside notify(). Exemption ends in Phase 21 alongside the V1 exemption (same teardown as the MSG-Block 5 shared/notify.ts entry added by plan 04)"
  - "presentation/* layer untouched: notify() does NOT import causeChainTrailer from presentation/cause-chain.ts (Claude's Discretion per D-16-08 last paragraph); it uses the existing import from shared/errors.ts (line 3) which the V1 wrappers and plans 03/04 helpers already consume. Zero presentation/* imports added; D-11 layering preserved end-to-end"
  - "Import-x/order normalization: softDepStatus value import lands first (parent group), assertNever + causeChainTrailer second (sibling group), all type-only imports third (type group), each group separated by one blank line per the project's import-x/order: { newlines-between: 'always' } config. Prettier collapsed the inter-group blanks via prettier --write during the verification ratchet"

patterns-established:
  - "Pattern: V2 public surface mirroring V1 wrapper structurally with computed-from-contents semantics. notify(ctx, pi, message) replaces (notifySuccess|notifyWarning|notifyError)(ctx, message) -- the (message, severity?) Pi-API magic-string surface is unchanged, but severity, reload-hint, and soft-dep probe move from caller-supplied to computed-from-payload"
  - "Pattern: factor an orchestration function into pure-string helpers to stay below the project's 15-cognitive-complexity ESLint ceiling. The factoring exposes nested-rendering decisions (indent shape, per-status guards, conditional trailer emission) as named helpers that each test in isolation in the future plan 06 unit suite"
  - "Pattern: file-private RELOAD_HINT_TRAILER literal under MSG-Block 4a bounded-window exemption -- the V2 chokepoint mirrors the V1 chokepoint at presentation/reload-hint.ts. Both copies bounded by Phase 21 teardown (same lifecycle as the MSG-Block 5 shared/notify.ts entry added by plan 04 for the SOFT_DEP_MARKER_* literals)"
  - "Pattern: composeMarketplaceBlock(mp, probe) is a thin orchestration that reads mp.plugins[] in caller order, composing per-plugin lines via composePluginLines(p, probe). This isolates the marketplace-level grammar (header + indented children) from the plugin-level grammar (row + optional trailers) and gives plan 06's tests two natural mock-input shapes (per-mp and per-plugin) instead of one giant message-shaped fixture"

requirements-completed: [SNM-12, SNM-14, SNM-15, SNM-16, SNM-17, SNM-18]

# Metrics
duration: ~35 min
completed: 2026-05-25
---

# Phase 16 Plan 05: V2 notify(ctx, pi, message) public entry point Summary

**Wired the file-private renderMpHeader (plan 03) + renderPluginRow (plan 04) into the public `notify(ctx: ExtensionContext, pi: ExtensionAPI, message: NotificationMessage): void` V2 entry point -- the sole public surface for state-change notifications (SNM-12 / D-16-01). softDepStatus(pi) is called once per invocation (D-16-14); per-plugin cause-chain trailers + rollbackPartial child rows render at the documented 2/4/6-space indent shape (D-16-04 / D-16-08); multi-marketplace blocks join with one blank line (D-16-07); the reload-hint trailer appends per the D-16-12 trigger ladder (D-16-13); severity dispatches via the D-16-11 first-match ladder using the V1-established magic-string second-arg convention.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-05-25 (local session)
- **Completed:** 2026-05-25
- **Tasks:** 1 (single-task plan)
- **Files modified:** 2 (`shared/notify.ts` core helper + `eslint.config.js` MSG-Block 4a ignores extension for the bounded-window V2 reload-hint chokepoint exemption)

## Accomplishments
- Public `notify(ctx, pi, message): void` exported from `shared/notify.ts` with the D-16-01 3-arg signature (SNM-12, SNM-14, SNM-15, SNM-16).
- File-private `RELOAD_HINT_TRAILER = "/reload to pick up changes"` literal duplicated inline per D-16-04 / D-16-12; consumed by the body composer's reload-hint append discipline (D-16-13).
- File-private `computeSeverity(message)` implements the D-16-11 first-match ladder (failed plugin/marketplace -> "error" > skipped/manual-recovery -> "warning" > success/undefined).
- File-private `shouldEmitReloadHint(message)` implements the D-16-12 trigger ladder (any state-changing plugin status OR any state-changing marketplace status -- NOT failed).
- File-private composition helpers (`renderIndentedCauseChain`, `composeRollbackPartialLines`, `composePluginLines`, `composeMarketplaceBlock`) keep `notify()` body below the project's 15-cognitive-complexity ESLint ceiling.
- `softDepStatus(pi)` is called exactly once at the top of `notify()` and threaded into every `renderPluginRow(p, probe)` call via `composePluginLines(p, probe)` (D-16-14).
- Both `void renderMpHeader;` and `void renderPluginRow;` self-references DELETED -- `notify()` is now the sole module-internal consumer of the plan-03 and plan-04 helpers.
- ESLint MSG-Block 4a `ignores:` list extended to include `shared/notify.ts` as the V2 reload-hint chokepoint (alongside the V1 chokepoint at `presentation/reload-hint.ts`).
- D-11 layering preserved: 0 `presentation/*` imports added.
- All 1327 existing tests stay green; `npm run check` (typecheck + ESLint + Prettier + tests) GREEN.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add file-private `RELOAD_HINT_TRAILER`, `computeSeverity`, `shouldEmitReloadHint`, and public `notify()`** -- `1f6e272` (feat).

## Files Created/Modified
- `extensions/pi-claude-marketplace/shared/notify.ts` -- updated imports (lines 1-7) to add `softDepStatus` value import and `ExtensionAPI` type; added lines 850-1065 covering the V2 mini-spec comment, `RELOAD_HINT_TRAILER`, `computeSeverity`, `shouldEmitReloadHint`, four composition helpers, and the public `notify()` function; deleted the trailing `void renderMpHeader;` and `void renderPluginRow;` self-references.
- `eslint.config.js` -- extended MSG-Block 4a `ignores:` list (line 223 area) to include `extensions/pi-claude-marketplace/shared/notify.ts` alongside the existing `presentation/manual-recovery.ts`, `presentation/rollback-partial.ts`, and `presentation/reload-hint.ts` exemptions, with a documenting comment block tying the exemption end to Phase 21.

## Decisions Made

See `key-decisions` in the frontmatter. Headline: planner chose `(no marketplaces)` as the empty-top-level sentinel byte form (mirrors the parenthesized status-token convention) and `    [${phase.phase}] (rollback failed)` as the rollbackPartial child row byte form (4-space leading indent + bracketed phase identifier + parenthesized failure marker, matching the 16-PATTERNS.md Analog #7 worked example).

### Required output spec items (per plan output spec)

#### (1) Line ranges of new symbols in `shared/notify.ts`

| Symbol | Line |
|---|---|
| `const RELOAD_HINT_TRAILER` | 900 |
| `function computeSeverity` | 903 |
| `function shouldEmitReloadHint` | 931 |
| `function renderIndentedCauseChain` (helper) | 960 |
| `function composeRollbackPartialLines` (helper) | 976 |
| `function composePluginLines` (helper) | 999 |
| `function composeMarketplaceBlock` (helper) | 1019 |
| `export function notify` (public entry) | 1034 |

The mini-spec comment block introducing the additions starts at line 850 (after plan-04's `renderPluginRow`); the file ends at line 1065 (no trailing `void` references).

#### (2) Exact byte form chosen for the rollbackPartial child row

`    [${phase.phase}] (rollback failed)`

Concretely, for a plugin with `rollbackPartial: [{ phase: "skills" }, { phase: "agents", cause: new Error("EACCES") }]`:

```
    [skills] (rollback failed)
    [agents] (rollback failed)
      cause: EACCES
```

(4-space leading indent on the child rows; 6-space leading indent on the phase cause-chain trailer; no `{<reasons>}` slot -- the Phase 15 SNM-09 type carries only `phase: string` and `cause?: Error`, not a per-phase reasons array.)

#### (3) Exact byte form chosen for the empty-marketplaces sentinel

`(no marketplaces)`

Concretely, for a payload `{ marketplaces: [] }` and any probe, the on-the-wire body string is exactly the 17 bytes `(no marketplaces)` -- no leading icon, no trailing newline, no reload-hint (the trigger predicate returns false), no severity (no failed / skipped / manual-recovery plugins exist), so `ctx.ui.notify("(no marketplaces)")` is called with no 2nd arg.

#### (4) Reload-hint trigger conditions match D-16-12 exactly

Confirmed. `shouldEmitReloadHint(message)` returns `true` iff ANY of the following first-match conditions hits:

| Condition | Match | Source |
|---|---|---|
| `mp.status === "added"` | yes | D-16-12: state-changing marketplace status |
| `mp.status === "removed"` | yes | D-16-12: state-changing marketplace status |
| `mp.status === "updated"` | yes | D-16-12: state-changing marketplace status |
| `mp.status === "failed"` | NO (explicitly excluded) | D-16-12: SNM-15 refinement -- failed rollbacks do not trigger |
| `p.status === "installed"` | yes | D-16-12: state-changing plugin status |
| `p.status === "updated"` | yes | D-16-12: state-changing plugin status |
| `p.status === "reinstalled"` | yes | D-16-12: state-changing plugin status |
| `p.status === "uninstalled"` | yes | D-16-12: state-changing plugin status |
| `p.status in {available, unavailable, upgradable, failed, skipped, manual recovery}` | NO | D-16-12: only the 4 state-changing plugin statuses trigger |

The function short-circuits on first match (the outer `for (const mp ...)` + inner `for (const p ...)` returns immediately on hit).

#### (5) Severity ladder first-match ordering matches D-16-11

Confirmed. `computeSeverity(message)` applies two passes over the same nested iteration:

1. **Pass 1 (error):** walks every `mp` and every `mp.plugins[p]`; returns `"error"` immediately if `mp.status === "failed"` OR `p.status === "failed"`.
2. **Pass 2 (warning):** walks the same nested structure; returns `"warning"` immediately if `p.status === "skipped"` OR `p.status === "manual recovery"`.
3. **Fall-through:** returns `undefined` (info severity -- omit 2nd arg).

First-match wins: a payload with a failed plugin + a skipped plugin returns `"error"` (pass 1 catches the failed first). A payload with only skipped + success plugins returns `"warning"`. A payload with only success plugins returns `undefined`. The two-pass structure makes the D-16-11 ladder visible at a glance; passes are independent (a pass-2 match can never override a pass-1 match because pass 1 returns early).

#### (6) `npm run check` GREEN confirmation

Confirmed. `npm run check` (typecheck + ESLint + Prettier + 1327 tests) exits with status 0. The two architecture tests called out by the plan output spec also pass:

- `tests/architecture/notify-types.test.ts` -- Phase 15 compile-check, unaffected by Phase 16 (verified GREEN).
- `tests/architecture/catalog-uat.test.ts` -- V1 callers untouched; `notify()` does not route into the catalog UAT until Phase 17 (verified GREEN).

#### (7) Plan-06 readiness confirmation

Plan 06 (new `tests/shared/notify-v2.test.ts` with ≥20 cases per D-16-17) has a working `notify(ctx, pi, message)` to exercise. The mock-`ctx` and mock-`pi` shapes documented in 16-PATTERNS.md Analog `tests/shared/notify-v2.test.ts (NEW FILE)` section (lines 491-619) are unchanged. Plan-06 fixtures will assert:

- Per-plugin-status output bytes (10 variants); plan-04 SUMMARY documents the exact per-arm forms.
- Per-marketplace-status output bytes (5 cases, incl. `mp.status === undefined`); plan-03 SUMMARY documents the exact per-arm forms.
- Empty `plugins: []` -> bare marketplace header (no `(no plugins)` sentinel inside the per-mp body; D-15-08 is the empty-plugin-array IS the rendering).
- Empty `marketplaces: []` -> the `(no marketplaces)` sentinel from item (3) above.
- Single-plugin payload, multi-plugin payload, multi-marketplace payload (with caller-supplied order respected per D-16-06).
- Orphan-fold (plugin.scope set when marketplace.scope is different): plan-04's `renderPluginRow` emits the inline `[scope]` bracket per BLOCKER-1 fix; notify() respects.
- `rollbackPartial` on `failed`: child rows at item (2) byte form; per-phase cause-chain trailers at 6-space indent.
- Multi-cause cascade: 2+ failed plugins each with `cause?: Error`; each cause renders inline below its row per D-16-08 (no top-level consolidated cause).
- Severity routing per D-16-11 (info / warning / error tiers; each tier asserts the matching `[message]` / `[message, "warning"]` / `[message, "error"]` shape on `ctx.ui.notify.mock.calls[0]!.arguments`).
- Reload-hint trigger / suppression (positive: any state-changing status; negative: failed-only payload -- hint suppressed).
- `notifyUsageError` (already shipped by plan 02; plan 06 confirms the `${message}\n\n${usage}` shape).

## Deviations from Plan

Three auto-fixed issues during verification ratchet (all Rule 3 - blocking lint/format):

### Auto-fixed Issues

**1. [Rule 3 - Blocking lint] MSG-Block 4a (`msg/msg-rh-1-reload-hint`) flagged the new `RELOAD_HINT_TRAILER` literal in `shared/notify.ts`**

- **Found during:** Task 1 verification (`npm run check`).
- **Issue:** The MSG-Block 4a rule detects bare `"/reload to pick up changes"` literals to enforce that reload-hint emission routes through `reloadHint(presentation/reload-hint.ts)`. The rule's docstring describes itself as a composer-chokepoint literal-detection rule and already exempts the V1 chokepoint at `presentation/reload-hint.ts`. Phase 16's V2 renderer chokepoint at `shared/notify.ts` was not yet on the ignores list, so the new `RELOAD_HINT_TRAILER` declaration tripped the rule.
- **Fix:** Extended `eslint.config.js` MSG-Block 4a `ignores:` list to include `extensions/pi-claude-marketplace/shared/notify.ts` alongside the existing `presentation/manual-recovery.ts`, `presentation/rollback-partial.ts`, and `presentation/reload-hint.ts` exemptions. Added a documenting comment block tying the exemption end to Phase 21 (same teardown as the reload-hint.ts exemption).
- **Files modified:** `eslint.config.js`
- **Rationale:** The rule's own docstring explicitly describes the V1 reload-hint chokepoint exemption. `shared/notify.ts` is now the V2 reload-hint chokepoint with the same legitimate need to host the bare `RELOAD_HINT_TRAILER` literal as the source-of-truth declaration consumed by the file-private append discipline inside `notify()`. The exemption is bounded by Phase 21 alongside the V1 exemption -- this matches the D-16-04 / D-16-09 intentional-duplication contract and mirrors the analogous MSG-Block 5 entry added by plan 04 for the SOFT_DEP_MARKER_* literals.
- **Verification:** `npm run check` GREEN after the eslint.config.js edit.
- **Committed in:** included in the Task 1 commit (`1f6e272`).

**2. [Rule 3 - Blocking lint] SonarJS `cognitive-complexity` flagged `notify()` at complexity 35 (project ceiling 15)**

- **Found during:** Task 1 verification (`npm run check`).
- **Issue:** The unfactored `notify()` body inlined the marketplace loop + plugin loop + per-plugin cause-chain emission + rollbackPartial child-row loop + per-phase cause-chain emission + multi-marketplace join + reload-hint compose + severity dispatch. SonarJS's cognitive-complexity heuristic counted the nested loops and conditional branches as ~35 -- well above the project's `sonarjs/cognitive-complexity: ["error", 15]` ceiling.
- **Fix:** Factored the orchestration into four pure-string helpers:
  - `renderIndentedCauseChain(cause: unknown, indent: string): string` -- the "guard + walker + indent" composition reused for both the per-plugin and per-phase cause-chain trailers (D-16-08).
  - `composeRollbackPartialLines(p: PluginNotificationMessage): string[]` -- the failed-plugin rollbackPartial loop, returning an empty array for non-failed or no-rollbackPartial plugins so callers can spread the result unconditionally.
  - `composePluginLines(p: PluginNotificationMessage, probe: SoftDepStatus): string[]` -- the per-plugin block (2-space row + optional 4-space cause-chain + rollbackPartial child rows).
  - `composeMarketplaceBlock(mp: MarketplaceNotificationMessage, probe: SoftDepStatus): string` -- the per-marketplace block (header + indented plugin blocks joined by `\n`).

  `notify()` is now a thin orchestration: probe once -> `message.marketplaces.map(composeMarketplaceBlock)` -> sentinel-or-join -> hint append -> severity dispatch. Cognitive complexity drops to ~5.
- **Files modified:** `extensions/pi-claude-marketplace/shared/notify.ts` (no eslint.config.js changes -- the factoring uses standard pure-string helpers, no chokepoint exemption needed).
- **Rationale:** Factoring preserves the byte-equal output (the helpers are pure strings) and matches the V1 cascade-summary.ts:77-88 + compact-line.ts per-variant-helper composition pattern. Each helper has single-digit cognitive complexity and tests in isolation; the top-level `notify()` reads as the orchestration sequence the planner intended.
- **Verification:** `npm run check` GREEN after the refactor. Acceptance criterion `grep -c "causeChainTrailer(p.cause)" notify.ts` returns 0 instead of the planned 1 because the call now lives inside `renderIndentedCauseChain(p.cause, "    ")` -- the semantic invariant (per-plugin cause-chain at 4-space indent for failed/manual-recovery rows) is preserved and verified end-to-end via the byte-form assertions documented in (2) above. Plan-06 unit tests will assert these byte forms verbatim.
- **Committed in:** included in the Task 1 commit (`1f6e272`).

**3. [Rule 3 - Blocking lint/format ratchet] `import-x/order` flagged the initial import ordering**

- **Found during:** Task 1 verification (`npm run check`).
- **Issue:** The plan's prescribed two-line addition (`import type { ExtensionAPI, ExtensionContext, SoftDepStatus } ... ;` then `import { softDepStatus } ... ;`) placed a value import after a type import in the same module specifier, which violates `import-x/order` (value imports come before type imports under the project's `groups: [..., "type"]` config). The ESLint also complained about the blank-line separation between the `./errors.ts` import and the new `../platform/pi-api.ts` value import (different groups: sibling vs parent, requiring `newlines-between: "always"`).
- **Fix:** Reorganized the import header to: (1) `import { softDepStatus } from "../platform/pi-api.ts";` first (parent group, value import), blank line, (2) `import { assertNever, causeChainTrailer } from "./errors.ts";` (sibling group, value imports), blank line, (3) `import type { ExtensionAPI, ExtensionContext, SoftDepStatus } from "../platform/pi-api.ts";` + the type-only imports from `./grammar/reasons.ts` and `./types.ts` (type group, alphabetized). Prettier ran via `npx prettier --write` to settle the canonical formatting.
- **Files modified:** `extensions/pi-claude-marketplace/shared/notify.ts` (import header only).
- **Verification:** `npm run check` GREEN after the reorder + Prettier pass.
- **Committed in:** included in the Task 1 commit (`1f6e272`).

---

**Total deviations:** 3 auto-fixed (all Rule 3 - blocking lint/format). No semantic changes -- the cognitive-complexity refactor preserves the byte-equal output, the eslint.config.js extension is the predictable bounded-window exemption already established by plan 04 for MSG-Block 5, and the import ordering is mechanical formatting.

**Impact on plan:** Two acceptance-criteria greps return 0 instead of the planned 1 due to the cognitive-complexity refactor:

- AC `grep -c "causeChainTrailer(p.cause)"` returns 0 -- the call now lives inside `renderIndentedCauseChain(p.cause, "    ")`.
- AC `grep -c "causeChainTrailer(phase.cause)"` returns 0 -- the call now lives inside `renderIndentedCauseChain(phase.cause, "      ")`.

The semantic invariants (per-plugin cause-chain at 4-space indent for failed/manual-recovery rows; per-phase cause-chain at 6-space indent for rollbackPartial phases) are preserved structurally -- the helper signatures take the cause + indent as parameters and forward to `causeChainTrailer` once each; verified GREEN by `npm run check` + the architecture tests. Plan-06 unit tests will assert these byte forms verbatim.

Additionally, AC `grep -c 'blocks.join("\\n\\n")'` returned 0 in raw-shell form because the over-escaped `\\\\n\\\\n` regex did not match the actual `blocks.join("\n\n")` source at line 1048 -- the semantic invariant (D-16-07 one-blank-line join between marketplace blocks) IS present and verified.

## Issues Encountered

One blocker-class environmental issue worth recording for downstream agents:

**Worktree-path-safety #3099 reproduction (early in execution):** the initial Edit to `eslint.config.js` used the absolute path `/home/acolomba/pi-claude-marketplace/eslint.config.js` (the main repo's config) instead of the worktree's `/home/acolomba/pi-claude-marketplace/.claude/worktrees/agent-a1a3c39dbf8d6f33a/eslint.config.js`. The Edit reported success because the main-repo path is valid, but the worktree's `npm run check` continued failing the MSG-RH-1 rule. Diagnosis: `diff /main /worktree` revealed the worktree was unchanged. Recovery: reverted the main-repo change via `git checkout -- eslint.config.js` inside the main repo, then reapplied the Edit to the worktree path. Verified the worktree's `eslint.config.js` is the one ESLint reads by running `npx eslint --no-cache extensions/pi-claude-marketplace/shared/notify.ts` inside the worktree -- it returned the expected single error before the worktree-side fix landed. The worktree-path-safety reference (#3099) anticipates this exact failure mode; recommendation for future executors: always derive absolute paths from `git rev-parse --show-toplevel` inside the worktree, never reuse a path constructed earlier in the orchestrator context. Prefer relative paths for Edit / Write operations inside a worktree (the working directory is the worktree root by default).

**Trufflehog hook failure inside the worktree (environmental, expected):** Per project CLAUDE.md, the trufflehog pre-commit hook fails inside Claude Code worktrees because the worktree's `.git` is a file (not a directory) and trufflehog's auto-updater cannot read it. The commit prefix `SKIP=trufflehog git commit ...` is the documented workaround; `pre-commit run trufflehog --all-files` run separately inside the worktree also fails under the same condition (confirmed via reproduction), so the auto-updater issue is environmental rather than file-content-driven. All other pre-commit hooks (prettier, smartquotes, format, lint, typecheck, etc.) passed cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 06 (notify-v2 unit tests with ≥20 cases per D-16-17) is unblocked. The public `notify(ctx, pi, message)` entry point is in place; plans 03 + 04 + 05 byte forms are documented in their respective SUMMARYs and ready for verbatim assertion in the test fixtures.
- Phase 17 catalog UAT rewrite (SNM-19 / SNM-20) inherits the v2 grammar shipped by Phase 16 (the per-plan byte forms become the seed for `docs/output-catalog.md` v2.0).
- Phases 18-20 (orchestrator + edge call-site migration) can begin once Phase 16 is fully closed (after plan 06 lands).
- Phase 21 (final teardown) will delete `presentation/*` composers + V1 wrappers + the MSG-Block 4a `shared/notify.ts` entry added here AND the MSG-Block 5 `shared/notify.ts` entry added by plan 04 simultaneously.
- No blockers or concerns.

## Self-Check: PASSED

- File `extensions/pi-claude-marketplace/shared/notify.ts` exists with the new public `notify` export (line 1034), file-private `RELOAD_HINT_TRAILER` (line 900), `computeSeverity` (line 903), `shouldEmitReloadHint` (line 931), and four composition helpers (lines 960, 976, 999, 1019). Verified via `grep -nE "^(const RELOAD_HINT_TRAILER|function computeSeverity|function shouldEmitReloadHint|function renderIndentedCauseChain|function composeRollbackPartialLines|function composePluginLines|function composeMarketplaceBlock|export function notify)"`.
- File `eslint.config.js` exists with the extended MSG-Block 4a `ignores:` list (line 223 area) including `shared/notify.ts`. Verified via `grep -n "shared/notify.ts" eslint.config.js` showing the entry at line 236.
- Commit `1f6e272` exists in the worktree branch's git log (`git log --oneline -3` confirms). Verified via `git log --oneline -3`.
- `npm run check` GREEN as of this commit (typecheck + ESLint + Prettier + 1327 tests).
- Both `void renderMpHeader;` and `void renderPluginRow;` self-references DELETED from `shared/notify.ts`. Verified via `grep -c "^void render"` returning 0.
- D-11 layering preserved: 0 `presentation/*` imports added. Verified via `grep -cE 'from "\.\./presentation/' shared/notify.ts` returning 0.

---
*Phase: 16-renderer-public-api-alongside-v1*
*Completed: 2026-05-25*
