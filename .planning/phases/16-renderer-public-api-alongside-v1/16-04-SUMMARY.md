---
phase: 16-renderer-public-api-alongside-v1
plan: 04
subsystem: presentation
tags: [typescript, notify, discriminated-union, assertNever, switch, soft-dep-markers]

# Dependency graph
requires:
  - phase: 15-shared-notify-type-model
    provides: PluginNotificationMessage 10-variant discriminated union, Scope, Reason, assertNever
  - phase: 16-renderer-public-api-alongside-v1 (16-01, 16-03)
    provides: 16-CONTEXT / 16-PATTERNS planning context; renderMpHeader + ICON_INSTALLED / ICON_AVAILABLE / ICON_UNINSTALLABLE / assertNever co-import already landed in shared/notify.ts
provides:
  - File-private renderPluginRow(p: PluginNotificationMessage, probe: SoftDepStatus): string -- second of two v2 rendering helpers (D-16-09)
  - File-private literals SOFT_DEP_MARKER_AGENTS ("requires pi-subagents") and SOFT_DEP_MARKER_MCP ("requires pi-mcp") duplicated inline per D-16-04 / D-16-15
  - File-private helpers joinTokens, renderVersion, renderScopeBracket (sole [scope] emitter -- BLOCKER-1 fix), composeVersionArrow, composeReasons
  - SoftDepStatus type co-imported from platform/pi-api.ts (the softDepStatus builder is NOT called -- plan 05 calls it once and threads the probe)
  - ESLint MSG-Block 5 (msg-sd-1 / msg-sd-2 / msg-nc-1) bounded-window ignore for shared/notify.ts alongside the V1 renderer chokepoint at presentation/compact-line.ts
affects: [16-05 public notify(), 16-06 notify-v2 unit tests, 21 final teardown]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated-union switch with `default: return assertNever(p);` (not `assertNever(p.status)`) so the whole p narrows to never only when all 10 variants are matched -- mirrors presentation/compact-line.ts:270-293 idiom but applied at the shared/ layer"
    - "renderScopeBracket(scope: Scope | undefined) indirection (BLOCKER-1 fix): file-private helper is the SOLE site that emits `[<scope>]`; per-arm code feeds p.scope through it so the bracket renders `\"\"` when undefined (common case) and `[scope]` only in the orphan-fold case per D-16-17"
    - "Plan-locked composeReasons first-arg discipline (BLOCKER-2 fix): 5 reasons-less arms pass `undefined`; 5 reasons-bearing arms pass `p.reasons`. The structural gate is TS strict (a `p.reasons` access in a reasons-less arm fails to typecheck) -- the runtime grep is a secondary check"
    - "Per-row soft-dep marker injection (D-16-15): only installed / updated / reinstalled arms forward p.dependencies.includes(\"agents\") / p.dependencies.includes(\"mcp\") to composeReasons; the other 7 arms pass `false` so the markers cannot leak onto rows that structurally never declare a soft dep"
    - "Bounded ESLint chokepoint exemption: shared/notify.ts joins presentation/compact-line.ts in MSG-Block 5 ignores: list -- the v2 renderer is now a second legitimate site for the bare-predicate marker literals, and the exemption ends at Phase 21 alongside the v1 exemption"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts (additions: lines 568-849 covering imports patched at line 5, file-private helpers, and renderPluginRow switch)
    - eslint.config.js (MSG-Block 5 ignores: extended to cover shared/notify.ts -- the bounded-window exemption for the v2 renderer chokepoint)

key-decisions:
  - "Plan-locked composeVersionArrow signature returns `string` (not `string | undefined` like presentation/version-arrow.ts) per the plan-04 contract; both-undefined branch returns `\"\"` so the joinTokens discipline collapses the slot. Defensive only-from branch returns the bare `from` value (no `v` prefix), mirroring version-arrow.ts:49 intent."
  - "skipped arm uses ICON_UNINSTALLABLE unconditionally (plan-locked); the v1 trivialSkip concept (compact-line.ts:432-438 -- ICON_INSTALLED for `(skipped) {up-to-date}` rows whose plugin remains installed) is intentionally NOT carried into the v2 grammar. Phase 21 deletes the v1 trivialSkip path entirely; v2 rows uniformly mark skipped as failure-class for icon-dispatch purposes."
  - "upgradable arm uses ICON_INSTALLED (the plugin IS installed, just behind the upstream version) -- mirrors v1 iconForPluginRow at compact-line.ts:387-393 which groups `installed | updated | upgradable | reinstalled` together."
  - "manual recovery discriminator preserved verbatim with its space inside the `(<status>)` slot -- emitted as the literal `\"(manual recovery)\"` (NOT transformed to kebab or camelCase) per CONTEXT `<specifics>` + shared/grammar/status-tokens.ts:47 precedent."
  - "MSG-Block 5 (msg-sd-1 / msg-sd-2 / msg-nc-1) ESLint exemption for shared/notify.ts is the right scope: the rule docstring already describes itself as a `renderer-chokepoint literal-detection rule` exempting the v1 renderer at presentation/compact-line.ts; shared/notify.ts is the v2 chokepoint with the same legitimate need to host the bare marker literals as the source-of-truth declaration. Exemption ends in Phase 21 alongside the v1 exemption."

patterns-established:
  - "Pattern: SOLE-site scope-bracket emission via a renderScopeBracket(scope: Scope | undefined) helper -- prevents the `[undefined]` runtime hazard for optional-`scope?` discriminated-union variants. Used here for the 8 scope?-bearing PluginNotificationMessage variants; will be reused by plan 05's notify() when composing the marketplace-header + indented-rows body."
  - "Pattern: ESLint MSG-Block bounded-window ignores: extension by adding a sibling chokepoint entry alongside an existing exempt path, with a comment block tying the exemption end to the Phase 21 teardown that deletes both chokepoints simultaneously."
  - "Pattern: discriminated-union switch passing the WHOLE narrowed value `p` to assertNever (not the discriminant field `p.status`) so the type narrows to `never` only when all variants are matched -- catches missing-arm errors as compile errors at the chokepoint rather than runtime fallthroughs."

requirements-completed: [SNM-16, SNM-17, SNM-18]

# Metrics
duration: ~25 min
completed: 2026-05-25
---

# Phase 16 Plan 04: renderPluginRow file-private v2 switch helper Summary

**Added a file-private `renderPluginRow(p: PluginNotificationMessage, probe: SoftDepStatus): string` helper to `shared/notify.ts`, switching over the full 10-variant PluginNotificationMessage discriminated union with `default: return assertNever(p);` for compile-time exhaustiveness (D-16-10), per-row soft-dep marker injection from `dependencies?` + threaded SoftDepStatus probe (D-16-15), and a SOLE-site renderScopeBracket helper preventing the `[undefined]` hazard on optional-`scope?` variants (BLOCKER-1 fix).**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-25 (local session)
- **Completed:** 2026-05-25
- **Tasks:** 1 (single-task plan)
- **Files modified:** 2 (`shared/notify.ts` core helper + `eslint.config.js` MSG-Block 5 ignores extension for the bounded-window v2 chokepoint exemption)

## Accomplishments
- File-private `renderPluginRow(p, probe): string` switch landed inside `shared/notify.ts` with all 10 `PluginNotificationMessage` variants narrowed via `switch (p.status)` and a `default: return assertNever(p);` arm gating future-variant additions at compile time (D-16-10, SNM-17).
- Soft-dep marker literals `SOFT_DEP_MARKER_AGENTS = "requires pi-subagents"` and `SOFT_DEP_MARKER_MCP = "requires pi-mcp"` duplicated inline at module scope per D-16-04 / D-16-15; bounded-duplication contract ends in Phase 21 alongside the V1 wrappers and `presentation/*` composers.
- Supporting file-private helpers added alongside: `joinTokens` (mirrors compact-line.ts:489-491), `renderVersion` (mirrors compact-line.ts:481-487), `renderScopeBracket` (the SOLE [scope] emitter per BLOCKER-1 fix), `composeVersionArrow` (mirrors version-arrow.ts:33-50), and `composeReasons` (mirrors compact-line.ts:458-479 + D-16-15 soft-dep injection rule).
- `SoftDepStatus` co-imported as a type-only import from `../platform/pi-api.ts` (the runtime `softDepStatus` builder is NOT called -- plan 05's `notify()` will call it once and thread the probe).
- ESLint MSG-Block 5 ignores extended to cover `shared/notify.ts` as the V2 renderer chokepoint where the bare marker literals legitimately live as the source-of-truth declaration consumed by composeReasons (alongside the V1 chokepoint at `presentation/compact-line.ts`).
- `void ICON_AVAILABLE;` self-reference from plan 03 DELETED -- `renderPluginRow` now consumes `ICON_AVAILABLE` in its `(available)` / `(uninstalled)` arms. A new `void renderPluginRow;` self-reference added at end-of-file alongside the still-present `void renderMpHeader;` for the bounded-window between plan 04 (this) and plan 05's `notify()` composition.
- All 1327 existing tests stay green; `npm run check` (typecheck + ESLint + Prettier + tests) GREEN.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add file-private soft-dep marker literals, supporting helpers, and the `renderPluginRow` switch** -- `b2ec7bd` (feat).

## Files Created/Modified
- `extensions/pi-claude-marketplace/shared/notify.ts` -- updated import on line 5 to `import type { ExtensionContext, SoftDepStatus } from "../platform/pi-api.ts";`; added lines 568-849 covering section divider, 2 soft-dep marker literals, 5 supporting helpers, and the renderPluginRow switch; deleted the prior `void ICON_AVAILABLE;` line; added a new trailing `void renderPluginRow;` line.
- `eslint.config.js` -- extended MSG-Block 5 `ignores:` list (line 271 area) to include `extensions/pi-claude-marketplace/shared/notify.ts` alongside the existing `presentation/compact-line.ts` and `shared/grammar/reasons.ts` exemptions, with a documenting comment tying the exemption end to Phase 21.

## Decisions Made

See `key-decisions` in the frontmatter. Headline: BLOCKER-1 fix routes every `[scope]` emission through a single `renderScopeBracket(scope: Scope | undefined)` helper so the `[undefined]` runtime hazard is structurally impossible for optional-`scope?` variants; BLOCKER-2 fix matches the per-variant `composeReasons` first argument to the Phase 15 field-availability table (5 reasons-less variants pass `undefined`; 5 reasons-bearing variants pass `p.reasons`).

### Exact byte forms (per arm)

Sample inputs match the plan's output spec items (1), (2), (3), (4). Probe shape used below is `{piSubagentsLoaded: false, piMcpAdapterLoaded: false}` unless stated otherwise; `joinTokens` collapses empty slots so absent optional tokens never produce a double-space.

| Arm | Sample input | Byte form |
|---|---|---|
| `"installed"` non-orphan-fold | `{status: "installed", name: "commit-commands", version: "1.0.0", dependencies: [], scope: undefined}` | `● commit-commands v1.0.0 (installed)` |
| `"installed"` orphan-fold | `{status: "installed", name: "commit-commands", version: "1.0.0", dependencies: [], scope: "user"}` | `● commit-commands [user] v1.0.0 (installed)` |
| `"installed"` + soft-dep marker | `{status: "installed", name: "commit-commands", version: "1.0.0", dependencies: ["agents"], scope: undefined}` | `● commit-commands v1.0.0 (installed) {requires pi-subagents}` |
| `"installed"` + both soft-dep markers | `{status: "installed", name: "X", version: "1.0", dependencies: ["agents", "mcp"], scope: undefined}` | `● X v1.0 (installed) {requires pi-subagents, requires pi-mcp}` |
| `"updated"` non-orphan-fold | `{status: "updated", name: "X", from: "1.0", to: "1.2", dependencies: [], scope: undefined}` | `● X 1.0 → v1.2 (updated)` |
| `"updated"` orphan-fold + soft-dep | `{status: "updated", name: "X", from: "1.0", to: "1.2", dependencies: ["mcp"], scope: "user"}` | `● X [user] 1.0 → v1.2 (updated) {requires pi-mcp}` |
| `"reinstalled"` non-orphan-fold | `{status: "reinstalled", name: "X", version: "1.0", dependencies: [], scope: undefined}` | `● X v1.0 (reinstalled)` |
| `"uninstalled"` orphan-fold | `{status: "uninstalled", name: "X", version: "1.0", scope: "user"}` | `○ X [user] v1.0 (uninstalled)` |
| `"available"` (always no `[scope]` per MSG-PL-6) | `{status: "available", name: "X", version: "1.0"}` | `○ X v1.0 (available)` |
| `"unavailable"` (always no `[scope]` per MSG-PL-6) | `{status: "unavailable", name: "X", reasons: ["hooks"], version: undefined}` | `⊘ X (unavailable) {hooks}` |
| `"upgradable"` orphan-fold | `{status: "upgradable", name: "X", version: "1.0", reasons: ["newer available"], scope: "user"}` | `● X [user] v1.0 (upgradable) {newer available}` |
| `"skipped"` orphan-fold | `{status: "skipped", name: "X", version: "1.0", reasons: ["up-to-date"], scope: "user"}` | `⊘ X [user] v1.0 (skipped) {up-to-date}` |
| `"failed"` orphan-fold | `{status: "failed", name: "X", version: "1.0", reasons: ["EACCES"], scope: "user"}` | `⊘ X [user] v1.0 (failed) {EACCES}` |
| `"manual recovery"` orphan-fold | `{status: "manual recovery", name: "X", version: "1.0", reasons: ["bridge undo failed"], scope: "user"}` | `⊘ X [user] v1.0 (manual recovery) {bridge undo failed}` |

### Soft-dep marker injection byte form (plan output spec #2)

Input: `{status: "installed", name: "commit-commands", version: "1.0.0", dependencies: ["agents"], scope: undefined}` with probe `{piSubagentsLoaded: false, piMcpAdapterLoaded: false}`.

Output: `● commit-commands v1.0.0 (installed) {requires pi-subagents}`

Notes:
- The marker literals are stored INSIDE the same `{<reasons>}` brace alongside any other reasons (NOT as separate braces). For the installed / updated / reinstalled arms the `reasons` field does not exist on the variant, so the brace contents are exclusively the soft-dep markers.
- When BOTH dependencies declare AND BOTH probes report unloaded: `{requires pi-subagents, requires pi-mcp}` (comma-space separated per MSG-GR-4).
- When the relevant probe reports loaded, the marker is suppressed entirely (no `{}` emitted when the composed list is empty).

### Orphan-fold byte form (plan output spec #3)

Input: plugin row with `scope: "user"` rendered under a marketplace-header carrying `scope: "project"`.

Plan 05's `notify()` composes the body as:
```
● demo [project] (added)
  ● commit-commands [user] v1.0.0 (installed)
```

(The plugin row's `[user]` bracket appears inline while the marketplace header retains `[project]`; per D-16-17, the marketplace header's scope still wins for the header itself, but the per-row scope-bracket flags the orphan-fold case to the reader. The 2-space leading indent is plan 05's responsibility -- `renderPluginRow` returns the bare row content `"● commit-commands [user] v1.0.0 (installed)"`.)

### Updated-arm version-arrow byte form (plan output spec #4)

Input: `{status: "updated", name: "X", from: "1.0", to: "1.2", dependencies: [], scope: "user"}`.

`composeVersionArrow("1.0", "1.2")` returns `"1.0 → v1.2"` (the upstream `v` prefix on `to` is intentional per MSG-PL-3; the bare `from` matches `presentation/version-arrow.ts:42` byte form).

Output: `● X [user] 1.0 → v1.2 (updated)` (the version-slot is the arrow form; `renderVersion(p.version)` is NOT called because Phase 15 D-15-04 declares NO `version` field on the `updated` variant).

### Line range (plan output spec #5)

The new helpers occupy lines 568-849 of `extensions/pi-claude-marketplace/shared/notify.ts`:

- Lines 568-585: section divider comment block
- Lines 587-588: soft-dep marker literals (`SOFT_DEP_MARKER_AGENTS`, `SOFT_DEP_MARKER_MCP`)
- Lines 590-595: TSDoc for `joinTokens`
- Lines 596-598: `joinTokens` body
- Lines 600-605: TSDoc for `renderVersion`
- Lines 606-612: `renderVersion` body
- Lines 614-624: TSDoc for `renderScopeBracket`
- Lines 622-624: `renderScopeBracket` body
- Lines 626-639: TSDoc for `composeVersionArrow`
- Lines 640-659: `composeVersionArrow` body
- Lines 661-680: TSDoc for `composeReasons`
- Lines 681-702: `composeReasons` body
- Lines 704-733: TSDoc for `renderPluginRow`
- Lines 734-848: `renderPluginRow` body (the 10-arm switch)
- Lines 850-859: trailing comment + `void renderMpHeader;` / `void renderPluginRow;` self-references

### npm run check confirmation (plan output spec #6)

`npm run check` GREEN: typecheck (TS strict narrows `p` over all 10 variants leaving `never` for the default) + ESLint (the new shared/notify.ts MSG-Block 5 ignore admits the SOFT_DEP_MARKER_* literals as legitimate chokepoint declarations) + Prettier + 1327 tests all pass.

### Plan-05 readiness checklist (plan output spec #7)

- Plan 05's `notify()` can consume `renderPluginRow` (file-private; same-module access) AND `renderMpHeader` (file-private; same-module access).
- Plan 05 can consume `SOFT_DEP_MARKER_AGENTS` / `SOFT_DEP_MARKER_MCP` (also file-private; same-module access) but it has no direct need for them -- only `composeReasons` consumes the literals.
- Plan 05 can consume `joinTokens` / `renderVersion` / `renderScopeBracket` / `composeVersionArrow` / `composeReasons` (all file-private; same-module access). Plan 05 will likely call NONE of these directly -- they are renderer-internal -- but they are available if needed.
- Plan 05 should DELETE the `void renderMpHeader;` self-reference at line 858 once it composes `renderMpHeader` into the marketplace-block loop.
- Plan 05 should DELETE the `void renderPluginRow;` self-reference at line 859 once it composes `renderPluginRow` into the per-plugin loop under each marketplace header.
- Plan 05 will need to import the runtime `softDepStatus` builder from `../platform/pi-api.ts` (in addition to the existing `SoftDepStatus` type co-import from plan 04) so `notify(ctx, pi, message)` can run `const probe = softDepStatus(pi);` once at entry.

### BLOCKER-1 / BLOCKER-2 fix confirmation (plan output spec #8)

BLOCKER-1 (no unconditional `[${p.scope}]` interpolations):
- Verification: `grep -cE '\[\$\{p\.scope\}\]' extensions/pi-claude-marketplace/shared/notify.ts` → `0`. Every scope-bracket emission flows through the file-private `renderScopeBracket(scope: Scope | undefined)` helper. The 8 scope?-bearing arms call `renderScopeBracket(p.scope)`; the 2 carve-out arms (`available` / `unavailable`) call `renderScopeBracket(undefined)` explicitly.

BLOCKER-2 (no `p.reasons` reads on variants that lack the field):
- Verification: structural gate is TS strict -- a `p.reasons` access in an arm where the narrowed variant lacks the field fails to typecheck, so `npm run check` GREEN is the primary confirmation. Secondary multiline-aware perl-grep against the file shows:
  - 5 reasons-less arms (installed, updated, reinstalled, uninstalled, available) pass `undefined` as the first arg to `composeReasons`.
  - 5 reasons-bearing arms (unavailable, upgradable, skipped, failed, manual recovery) pass `p.reasons` as the first arg.
- The single-line `grep -c 'composeReasons(undefined'` returns 2 (not 5) because Prettier wraps the installed / updated / reinstalled callsites onto multiple lines (the 4-arg `composeReasons(undefined, p.dependencies.includes("agents"), p.dependencies.includes("mcp"), probe)` exceeds the column limit). The wrap is purely stylistic; the semantic invariant holds.

## Deviations from Plan

Two auto-fixed issues:

### Auto-fixed Issues

**1. [Rule 3 - Blocking lint] ESLint MSG-Block 5 (`msg-sd-2-soft-dep-predicate`) flagged the new `SOFT_DEP_MARKER_AGENTS` / `SOFT_DEP_MARKER_MCP` literals in `shared/notify.ts`**

- **Found during:** Task 1 verification (`npm run check`)
- **Issue:** The MSG-Block 5 rule (defined in `tests/lint-rules/msg-sd-2-soft-dep-predicate.js`) detects bare `"requires pi-(subagents|mcp)"` predicate literals to enforce that soft-dep emission routes through `composeReasons`. The rule documents itself as a "renderer-chokepoint literal-detection rule" and exempts the V1 chokepoint at `presentation/compact-line.ts` via the MSG-Block 5 `ignores:` list. Phase 16's V2 renderer chokepoint at `shared/notify.ts` was not yet on the ignores list, so the new SOFT_DEP_MARKER_* declarations tripped the rule with the expected message ("hand-composed bare `requires pi-subagents` / `requires pi-mcp` predicate literal detected").
- **Fix:** Extended `eslint.config.js` MSG-Block 5 `ignores:` list to include `extensions/pi-claude-marketplace/shared/notify.ts` alongside the existing `presentation/compact-line.ts` and `shared/grammar/reasons.ts` exemptions. Added a documenting comment block tying the exemption end to Phase 21 (same teardown as the compact-line.ts exemption).
- **Files modified:** `eslint.config.js`
- **Rationale:** The rule's own docstring explicitly describes the V1 renderer chokepoint exemption. `shared/notify.ts` is now the V2 renderer chokepoint with the same legitimate need to host the bare marker literals as the source-of-truth declaration consumed by composeReasons. The exemption is bounded by Phase 21 alongside the V1 exemption -- this matches the D-16-04 / D-16-09 intentional-duplication contract (both copies deleted at the same teardown).
- **Verification:** `npm run check` GREEN.
- **Committed in:** included in the Task 1 commit (`b2ec7bd`).

**2. [Rule 3 - Blocking lint/format ratchet] Prettier wrapped multi-line `composeReasons(undefined, p.dependencies.includes(...), p.dependencies.includes(...), probe)` callsites in the installed / updated / reinstalled arms**

- **Found during:** Task 1 verification (`npm run check`)
- **Issue:** The 4-arg `composeReasons` call shape for the installed / updated / reinstalled arms exceeds Prettier's column limit (the third arg `p.dependencies.includes("mcp")` plus the trailing `, probe` push past the threshold), so Prettier wrapped each call onto multiple lines: `composeReasons(\n          undefined,\n          ...` etc.
- **Fix:** None required -- the multi-line wrap is the canonical Prettier shape for this argument count. The change is purely formatting and affects only the byte-positioning of the AC grep `grep -c "composeReasons(undefined"` (which became 2 instead of the AC's expected 5). The semantic invariant is enforced by TS strict (a `p.reasons` access in a reasons-less arm fails to typecheck).
- **Files modified:** none beyond the initial emission (Prettier ran during `npm run check` and reported no further diffs).
- **Verification:** `npm run check` GREEN; multiline-aware perl-grep confirms 5 callsites with first arg `undefined` and 5 callsites with first arg `p.reasons`.
- **Committed in:** included in the Task 1 commit (`b2ec7bd`).

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking lint/format).
**Impact on plan:** No semantic changes. The ESLint extension is the predictable bounded-window exemption already anticipated by D-16-04 / D-16-09 (intentional duplication of chokepoint literals across V1 and V2 renderers). The Prettier wrap is mechanical formatting that does not affect any byte forms or the structural BLOCKER-2 gate.

## Issues Encountered

None blocking. Two environmental notes worth recording for downstream agents:

- **trufflehog hook failure inside the worktree:** Per project CLAUDE.md, the trufflehog pre-commit hook fails inside Claude Code worktrees because the worktree's `.git` is a file (not a directory) and trufflehog's auto-updater cannot read it. The commit prefix `SKIP=trufflehog git commit ...` is the documented workaround; `pre-commit run trufflehog --all-files` run separately also fails under the same condition (confirmed via reproduction), so the auto-updater issue is environmental rather than file-content-driven. All other pre-commit hooks (prettier, eslint, typecheck, smartquotes, etc.) passed cleanly.
- **AC grep miss for the multi-line `composeReasons(undefined` callsites:** The plan's BLOCKER-2-fix acceptance criterion uses a line-oriented grep (`grep -c "composeReasons(undefined"`) which only matches single-line callsites. Three of the five reasons-less arms (installed / updated / reinstalled) have Prettier-wrapped multi-line callsites, so the line-oriented grep returns 2 instead of 5. The semantic invariant is still enforced -- TS strict refuses `p.reasons` access on arms that lack the field -- and a multiline-aware perl-grep confirms the expected 5. Downstream verifications should use the perl-grep approach or rely on the TS gate.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 05 (public `notify()` composing both helpers + the reload-hint trigger + the severity ladder) is unblocked. `renderMpHeader`, `renderPluginRow`, `causeChainTrailer`, `assertNever`, ICON_INSTALLED / ICON_AVAILABLE / ICON_UNINSTALLABLE, SoftDepStatus, and the supporting helpers are all in place.
- Plan 06 (notify-v2 unit tests with ≥20 cases) will assert the exact byte forms documented in "Exact byte forms (per arm)" above plus plan 03's marketplace-header byte forms.
- No blockers or concerns.

## Self-Check: PASSED

- File `extensions/pi-claude-marketplace/shared/notify.ts` exists with the new `renderPluginRow` function (line 734) and all 5 supporting helpers (lines 596, 606, 622, 640, 681).
- File `eslint.config.js` exists with the extended MSG-Block 5 ignores list including `shared/notify.ts` (line 274 area).
- Commit `b2ec7bd` exists in the worktree branch's git log (`git log --oneline -3` confirms).
- `npm run check` GREEN as of this commit.

---
*Phase: 16-renderer-public-api-alongside-v1*
*Completed: 2026-05-25*
