# Phase 95: Manifest-independent installed inventory - Research

**Researched:** 2026-08-08
**Domain:** In-repo TypeScript behavior change on the `/claude:plugin list` inventory path (orchestrator row builders + command-local render map + LLM tool projection), plus a byte-exact characterization test suite.
**Confidence:** HIGH (every claim below is a `Read` of a file in this worktree; no external dependency research was required)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Copied verbatim from `.planning/phases/95-manifest-independent-installed-inventory/95-CONTEXT.md` § Implementation Decisions.

- **D-95-01:** Reverse the blanket omission of `reasons` on installed inventory
  rows using a **general rule**, not an allowlist: the row builder supplies
  whatever typed reasons apply and `shared/notify.ts` renders them, exactly as
  every other status arm already works. No gate in the render path restricting
  which reasons an installed row may carry. — **Reversibility:** reversible —
  the change is a single object field at `orchestrators/plugin/list.ts:485-499`;
  the renderer and the type already support it.

  Rationale for choosing the general rule over an allowlist: the house invariant
  is that orchestrators determine state and stamp reasons while `notify.ts`
  stays a dumb renderer. An allowlist living in the render path would invert
  that ownership.

- **D-95-02:** Record the durable-vs-transient principle as the editorial
  guidance governing which reasons belong on steady-state inventory rows.
  `{not in manifest}` is a **durable** property of the record's relationship to
  its marketplace — it stays true across reloads until either the manifest or
  the installation changes. The condition the original omission excluded was
  **transient**, tied to a pending action. Steady-state inventory rows may state
  durable facts; they should not carry pending ones.

  Under D-95-01 this is documented convention for future authors, not a
  code-enforced gate.

- **D-95-03:** The original rationale is not fully recoverable and must not be
  cited as though it were. The comments at `list.ts:323` and `list.ts:489`
  attribute the omission to keeping "the orphan-rewake brace" off inventory
  rows, citing `RLD-04 / D-08`. Neither ID is defined in any surviving artifact
  — a search across `extensions/`, `tests/`, `docs/`, and all of `.planning/`
  including the milestone archives finds them only in source comments
  (`list.ts` ×6, `tools.ts` ×3), and the term "orphan-rewake" appears nowhere
  but those two `list.ts` comments. When rewriting these comments, state the new
  durable-vs-transient rule directly rather than referencing the retired one.

- **D-95-04:** Thread the manifest-load outcome by replacing
  `enumerateMarketplacePlugins`' `manifest: MarketplaceManifest | undefined`
  parameter (`list.ts:729`) with the **existing `ScopedManifest` bundle type**
  already declared at `list.ts:789-792`. Both call sites pass the whole
  destructure result rather than picking one field. — **Reversibility:** costly
  — the signature change touches both call sites plus the row builders
  downstream of it, though all are within one file.

  Rejected: adding a parallel `manifestLoaded: boolean` alongside the existing
  param. Two fields that must be kept consistent is the exact drift shape that
  allowed this defect, since a caller can pass a manifest and the wrong flag.

- **D-95-05:** The `{not in manifest}` brace is gated on
  `loadError === undefined && manifestEntry === undefined`. A folded row whose
  manifest was never successfully read renders its existing bare `(installed)`
  form with no brace — the row is preserved, only the false claim is suppressed.

  Rejected: mirroring the primary path's early return and skipping the fold
  entirely on load error. BOUND-03 forbids the false brace, not the row; dropping
  folded rows would hide installed plugins, cutting against the milestone thesis.

- **D-95-06:** Widen `pluginReasons` (`edge/handlers/tools.ts:370-382`) to
  forward reasons for **both** `installed` and `partially-installed`, joining the
  existing `unavailable` / `partially-available` / `upgradable` set. This lands
  in **Phase 95 alongside INV-01** so the slash-command and tool surfaces are
  verified together and cannot diverge across a phase boundary. —
  **Reversibility:** costly — widening an LLM-facing payload is easy to add and
  awkward to withdraw once agents rely on the field.

  Implementation note: `PluginPartiallyInstalledMessage.reasons` is required
  (`notify.ts:871`) and drops in cleanly; `PluginInstalledMessage.reasons` is
  optional (`notify.ts:682`) and needs an undefined guard before the
  `.length > 0` check.

- **D-95-07:** COMPAT-01 still holds after the widening — it adds no status
  token, reason token, glyph, state field, migration, or network path.

- **D-95-08:** Characterization tests go in a **new dedicated file**,
  `tests/orchestrators/plugin/list-manifest-absent.test.ts`. `list.test.ts` is
  already 2481 lines, and this set has a distinct lifecycle: written before any
  production edit, with some cases deliberately widened by Phase 97. A separate
  file makes "what was pinned before anything changed" legible to the Phase 97
  executor. Matches existing subject splits (`git-source-probe` /
  `git-source-probe-upgrade`, `clone-gc` / `clone-gc-errors`).

- **D-95-09:** Assertions are **byte-exact rendered rows**, matching the
  project's existing byte-frozen output culture where `docs/output-catalog.md`
  is a contract and the catalog UAT gates compare byte-for-byte. This catches
  token, glyph, spacing, and ordering drift — the regression class INV-02 and
  INV-03 exist to prevent.

  Per INV-04, the characterization set covers the **canonical disabled shape
  only** (`enabled: false` with `compatibility.installable: true`). It must NOT
  pin the current partial-disabled rendering, which ENBL-06 deliberately changes
  in Phase 97.

- **D-95-10:** (satisfied) The requirement amendment landed as quick task
  `260808-dhm`; INV-05 exists and is mapped to Phase 95. Planning is unblocked
  per `.planning/STATE.md` § Blockers.

- **D-95-11:** Open decision 2 (component name fidelity on the state-only info
  arm) is **deferred to Phase 96 discuss**. It governs no Phase 95 code.

### Claude's Discretion

- Exact naming of the new requirement ID for the tool widening (`INV-05`,
  `TOOL-01`, or similar) — settle it in the amendment quick task.
  *(Settled: the ID is `INV-05`, per REQUIREMENTS.md line 16.)*
- Internal structure and fixture reuse within `list-manifest-absent.test.ts`.
- Whether the `ScopedManifest` param is threaded positionally or the signature
  is reshaped, provided both call sites pass the bundle.

### Deferred Ideas (OUT OF SCOPE)

- **Installed plugins hidden under a failed-manifest marketplace.** When a
  marketplace's `marketplace.json` fails to parse, the primary path
  (`list.ts:862-874`) emits a bare `(failed)` header with `plugins: []`, so
  every installed plugin under it disappears from the inventory. BOUND-01
  deliberately retains this. Out of scope for v1.18. **Log to
  `.planning/BACKLOG.md`.**
- **Open decision 2 — component name fidelity.** Deferred to Phase 96 discuss.
- **Coverage sweep todo** (`2026-06-12-coverage-sweep-test-rare-failure-arms-in-update-reinstall-in`)
  — not folded; its subject is mutation paths Phase 95 does not touch.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (abridged from REQUIREMENTS.md) | Research Support |
|----|---------------------------------------------|------------------|
| INV-01 | Default list renders an enabled, fully supported, manifest-absent record as `● <plugin> v<recorded-version> (installed) {not in manifest}`. | **Two** change points, not one — see § "The render-map suppression is real" and § Architecture Patterns Pattern 1. Change point A: `list.ts:485-499`. Change point B: `list.messaging.ts:97-106`. |
| INV-02 | Enabled record with persisted `compatibility.unsupported` kinds keeps `(partially-installed)` and its unsupported-kind reasons, **with `not in manifest` added first**. | Change point: `list.ts:441-450`. No render change (that arm already renders `p.reasons`, `list.messaging.ts:144-145`). Characterization first, then prepend. |
| INV-03 | `--installed` includes both fully installed and partially-installed manifest-absent records. | Already holds via `shouldShow` (`list.ts:221-230`). Regression coverage only. |
| INV-04 | A disabled manifest-absent record (canonical shape only) stays `(disabled)` with no `{not in manifest}`. | Structurally guaranteed: `PluginDisabledMessage` carries no `reasons` field at all, and `LIST_RENDER.disabled` hard-codes `composeReasons(undefined, …)`. Regression coverage only. |
| INV-05 | The LLM tool surface forwards reasons for `installed` and `partially-installed`. | Change point: `tools.ts:370-382`. Assertion surface: `tool.execute(...)` → `out.details.plugins[i].reasons` (existing precedent at `tests/edge/handlers/tools.test.ts:706-713`). |
| BOUND-03 | The fold path distinguishes a failed manifest read from a successful read with no entry; a folded row whose manifest never loaded never renders `{not in manifest}`. | Defect at `list.ts:977`. Fix threads `ScopedManifest` through `enumerateMarketplacePlugins` (`list.ts:724-731`) into `installedRowMessage`. Test model: `list.test.ts:1185-1303`. |
</phase_requirements>

## Summary

Phase 95 is a small, entirely local behavior change on one orchestrator file plus its
command-local render map, its LLM tool projection, and one new test file. It installs no
packages, adds no closed-set members, touches no persistence, and crosses no network
boundary.

The single most important finding contradicts a claim carried in 95-CONTEXT.md and in the
ROADMAP's own correction note: **the render-map suppression that the original ROADMAP
criterion 2 described is real and must be lifted.** The list surface does not render
through `shared/notify.ts::renderPluginRow`; it renders through its own command-local
`LIST_RENDER` map in `orchestrators/plugin/list.messaging.ts`, and that map's `installed`
arm passes a literal `undefined` where the reasons argument belongs. Setting `reasons` on
the message in `list.ts` alone produces **no visible output change**. Details and evidence
in the next section.

The second material finding is that **INV-02 is not pure characterization.** REQUIREMENTS.md
INV-02 and the design doc both state that the partially-installed row gains
`not in manifest` **prepended** before its unsupported-kind reasons. 95-CONTEXT.md's
`<code_context>` only names the `installed` arm as a change point. The partial arm at
`list.ts:441-450` is a second orchestrator edit.

The remaining work is mechanical. `enumerateMarketplacePlugins` is file-private with exactly
two call sites, both inside `list.ts`; the blast radius of the D-95-04 signature change is
one file. Existing tests give near-perfect templates for every fixture the phase needs, and
one existing test (`tests/edge/handlers/tools.test.ts:555-625`) is already seeded with a
manifest-absent partially-installed record — it is the natural INV-05 site, and its comment
at lines 553-554 goes stale.

**Primary recommendation:** Plan INV-01 as a two-file edit (`list.ts` row builder **and**
`list.messaging.ts` render arm), plan INV-02 as a production change rather than pure
characterization, and gate all five criteria on orchestrator-level byte-exact tests driven
through `listPlugins` — the catalog UAT cannot catch a `LIST_RENDER` regression because it
exercises the central `notify()` renderer instead.

---

## The render-map suppression is real (correction to a locked-context premise)

This is the finding that most changes the plan. It is stated first and with full evidence
because 95-CONTEXT.md records the opposite as established fact, and the planner would
otherwise scope INV-01 to a single field.

**Claim:** the list surface's `installed` row renders through `LIST_RENDER.installed`, which
discards `p.reasons`.

**Evidence 1 — the dispatch does not use the central switch.**
`extensions/pi-claude-marketplace/shared/notify-context.ts:110-113` documents the seam
verbatim `[VERIFIED: extensions/pi-claude-marketplace/shared/notify-context.ts:110-113]`:

```
/**
 * D-02 entry point. Dispatches each per-plugin row body through
 * `context.render[row.status]` (NOT the central renderPluginRow switch), then
 * routes the composed cascade through the shared severity/summary/reload +
```

And the dispatch itself `[VERIFIED: extensions/pi-claude-marketplace/shared/notify-context.ts:317-318]`:

```
  const arm = context.render[p.status as Status] as
    RenderFn<Extract<Msg, { status: Status }>> | undefined;
```

**Evidence 2 — the list orchestrator routes through `LIST_CONTEXT`.**
`extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:1210` calls
`notifyWithContext(ctx, pi, LIST_CONTEXT, marketplaces);`
`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:1210]`, and
`LIST_CONTEXT` binds `render: LIST_RENDER`
`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts:181-184]`:

```
export const LIST_CONTEXT = {
  Messaging: { label: "Plugin list" },
  render: LIST_RENDER,
} as const satisfies CommandContext<ListStatus, ListMsg>;
```

**Evidence 3 — the arm discards reasons.**
`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts:96-106]`,
quoted verbatim:

```
const LIST_RENDER: { [K in ListStatus]: RenderFn<Extract<ListMsg, { status: K }>> } = {
  installed: (p, probe, mpScope) =>
    installedLikeRow(
      ICON_INSTALLED,
      p,
      mpScope,
      renderVersion(p.version),
      "(installed)",
      undefined,
      probe,
    ),
```

The seventh positional argument is the reasons slot
`[VERIFIED: extensions/pi-claude-marketplace/shared/notify.ts:2137-2149]` — the signature is
`installedLikeRow(icon, p, mpScope, versionToken, label, reasons: readonly ContentReason[] | undefined, probe)`.

The map's own doc comment states the intent explicitly
`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts:90-92]`:

```
 * RLD-04 / D-08: the `installed` inventory arm passes `undefined` for `reasons`
 * so the orphan-rewake brace (an install-cascade surface) never leaks onto a
 * steady-state inventory row.
```

**What 95-CONTEXT.md got right and wrong.** It is correct that
`shared/notify.ts:2180-2193` composes reasons on the central `installed` arm and that
`PluginInstalledMessage.reasons?` exists at `notify.ts:682`. Both are true; neither is on
the list surface's code path. The ROADMAP's original criterion-2 wording ("requires lifting
the render map's suppression of reasons on installed rows") was accurate, and the
2026-08-08 correction note that retracted it is itself wrong.

**Consequence for D-95-01 and D-95-03.** D-95-01's substance survives intact: the fix is
still "the row builder supplies reasons and the renderer renders them," with no allowlist.
What changes is the *reversibility note* — the edit is two lines in two files, not one field
in one file. Two of the three comments D-95-03 names for rewriting are joined by a third:
`list.messaging.ts:90-92`, which asserts the now-false suppression rationale. (The central
`shared/notify.ts:2176-2179` comment also asserts "The list inventory row OMITS `reasons`",
which becomes false; whether to touch it is a judgment call — it lives in a file the phase
otherwise does not edit, and the D-95-03 "no sweep" guidance in `<specifics>` argues for
leaving it. Flag it as an Open Question rather than silently editing.)

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Deciding a record is manifest-absent | Orchestrator (`orchestrators/plugin/list.ts`) | — | House invariant: orchestrators determine state and stamp reasons. Confirmed by the whole `installedRowMessage` design and by the "notify.ts is a dumb renderer" project rule. |
| Threading the manifest load outcome | Orchestrator (`list.ts` internal signature) | — | `ScopedManifest` is already declared in `list.ts` (`list.ts:789-792`); nothing outside the file consumes it. |
| Rendering `{…}` reason braces on a list row | Command-local render map (`orchestrators/plugin/list.messaging.ts`) | Shared render helpers (`shared/notify.ts::installedLikeRow` / `composeReasons`) | Per D-10 the list surface owns a render map total over its own statuses; the helper bodies stay central per D-11. |
| Projecting rows for the LLM tool | Edge (`edge/handlers/tools.ts`) | — | Edge handlers own the tool payload shape; `PluginRow` is declared there (`tools.ts:137-144`). |
| Persistence | — | — | **No tier.** This phase writes nothing. `list.ts` is read-only by design (there is an architecture test asserting it does not use `withStateGuard`, `list.test.ts:1901`). |
| Network | — | — | **No tier.** NFR-5 forbids it and `tests/architecture/no-orchestrator-network.test.ts` enforces it. |

---

## Standard Stack

### Core

No new libraries. The phase uses only what is already imported in the files it edits.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:test` | bundled with Node ≥20.19.0 | Test runner for the new characterization file | Every suite under `tests/**` uses it `[VERIFIED: package.json scripts.test]` |
| `node:assert/strict` | bundled | Byte-exact assertions | Used by `list.test.ts:27` and every sibling |

### Supporting

| Helper | Location | Purpose | When to Use |
|--------|----------|---------|-------------|
| `withHermeticHome` | `tests/orchestrators/plugin/list.test.ts:83-104` | tmp `HOME` + tmp `cwd`, restored in `finally`, with retrying `rm` | Every orchestrator-level list test. Copy it into the new file (it is not exported). |
| `makeCtx` | `tests/orchestrators/plugin/list.test.ts:59-77` | Captures `{ message, severity }` per `ctx.ui.notify` call | Byte-exact capture. `pi.getAllTools()` returns `[]`, so both soft-deps read unloaded. |
| `seedMarketplace` | `tests/orchestrators/plugin/list.test.ts:154-277` | Writes marketplace root, `marketplace.json`, `state.json`, optional `claude-plugins.json` | The main fixture. Needs one extension for the soft-dep case — see § Pitfall 5. |
| `locationsFor` | `extensions/pi-claude-marketplace/persistence/locations.ts` | Scope-rooted path bundle | Needed to write project-scope state directly for the fold test. |
| `saveState` | `extensions/pi-claude-marketplace/persistence/state-io.ts` | Validated `state.json` write | Used directly (bypassing `seedMarketplace`) when a record needs a bespoke `manifestPath` / `marketplaceRoot` pair. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Threading `ScopedManifest` (D-95-04) | Pass `manifest !== undefined` as the loaded signal | Would work today — `loadMarketplaceManifestSoftly` returns `{ manifest, loadError: undefined }` on success and `{ manifest: undefined, loadError: <msg> }` on failure (`list.ts:794-803`), so "manifest defined" ⟺ "load succeeded". **Rejected by D-95-04**, and correctly: the equivalence is incidental, not enforced. |
| Adding tests to `list.test.ts` | — | **Rejected by D-95-08.** New file. |

**Installation:** none. `npm install` is not part of this phase.

## Package Legitimacy Audit

**Not applicable.** This phase installs no external packages. The Package Legitimacy Gate
was not run because there is no candidate to check.

- Packages removed due to `[SLOP]` verdict: none
- Packages flagged as suspicious `[SUS]`: none

---

## Architecture Patterns

### System Architecture Diagram

```text
/claude:plugin list
        │
        ▼
edge/handlers/plugin/list.ts ──────────► orchestrators/plugin/list.ts::listPlugins
                                                       │
                                                       ▼
                                          loadPluginListPayload  (reads BOTH scopes)
                                                       │
                          ┌────────────────────────────┼────────────────────────────┐
                          ▼                            ▼                            ▼
              (1) project blocks           (2) user blocks + orphan FOLD      final sort
                          │                            │
                          ▼                            ▼
             buildMarketplaceMessage        loadMarketplaceManifestSoftly(projectMp)
                          │                     {manifest, loadError}   ◄── BOUND-03 defect:
                          ▼                            │                    loadError DROPPED
        loadMarketplaceManifestSoftly(mpRecord)        ▼                    at list.ts:977
              {manifest, loadError}          enumerateMarketplacePlugins(…, manifest)
                          │                            │                    ◄── D-95-04 threads
          loadError? ──yes──► (failed) header,         │                        ScopedManifest here
                              plugins: []              │
                          │no                          │
                          ▼                            ▼
        enumerateMarketplacePlugins ─────────► installedRowMessage(record, manifestEntry, …)
                          │                            │
                          │                  ┌─────────┼──────────┬──────────────┐
                          │                  ▼         ▼          ▼              ▼
                          │            (disabled) (partially-  (upgradable)  (installed)
                          │             no reasons  installed)   reasons:[]   ◄── INV-01
                          │             field       ◄── INV-02                    reasons OMITTED
                          ▼                                                       today
                availableRowMessage (manifest entries not installed)
                          │
                          ▼
        notifyWithContext(ctx, pi, LIST_CONTEXT, rows)
                          │
                          ▼
        notify-context.ts::dispatchRow → context.render[status]
                          │                (NOT shared/notify.ts::renderPluginRow)
                          ▼
        list.messaging.ts::LIST_RENDER
              installed:            installedLikeRow(…, undefined, probe) ◄── INV-01 CHANGE B
              partially-installed:  pluginRow(…) → passes p.reasons ✓
              disabled:             composeReasons(undefined, false, false, probe) ✓
                          │
                          ▼
                  single ctx.ui.notify(message, severity?)


LLM tool lane (parallel, same payload builder):
  registerListPluginsTool.execute → loadPluginListPayload → renderPluginPayload
        → pluginReasons(p)  ◄── INV-05 CHANGE (tools.ts:370-382)
        → PluginRow { marketplace, scope, name, status, version?, reasons? }
        → { content:[{text}], details:{ plugins: PluginRow[] } }
```

### Component Responsibilities

| File | Responsibility in this phase | Lines of interest |
|------|------------------------------|-------------------|
| `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` | Stamp `reasons` on installed + partial rows; thread `ScopedManifest` | 331-345 (signature), 441-450 (partial arm), 485-499 (installed arm), 724-731 (enumerate signature), 738/756/760 (manifest consumers), 877-884 (call site 1), 977/987-993 (call site 2) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts` | Lift the `installed` reasons suppression | 96-106 (arm), 90-92 (stale comment) |
| `extensions/pi-claude-marketplace/edge/handlers/tools.ts` | Widen the reasons projection | 365-382 |
| `tests/orchestrators/plugin/list-manifest-absent.test.ts` | New — characterization then new behavior | new file |
| `tests/edge/handlers/tools.test.ts` | INV-05 assertions | 555-625 (existing manifest-absent partial fixture), 685-714 (details-assertion precedent) |

### Recommended change structure

```text
Wave A (characterization, before any production edit)
  tests/orchestrators/plugin/list-manifest-absent.test.ts
    - partial manifest-absent  -> (partially-installed) {<kinds>}      [pins pre-change]
    - canonical disabled       -> (disabled), no brace                  [INV-04]
    - --installed spans both enabled forms                              [INV-03]
    - fold with FAILED project manifest -> bare (installed), no brace   [BOUND-03 pre-pin]

Wave B (production)
  list.ts        : installed arm gains `reasons`, partial arm prepends "not in manifest"
  list.messaging.: LIST_RENDER.installed passes p.reasons
  list.ts        : enumerateMarketplacePlugins takes ScopedManifest; installedRowMessage
                   learns "manifest loaded" and gates the brace
  tools.ts       : pluginReasons adds installed + partially-installed arms

Wave C (new-behavior tests)
  list-manifest-absent.test.ts : INV-01 byte form, INV-02 prepend, soft-dep composition,
                                 BOUND-03 positive (loaded manifest, entry missing -> brace)
  tools.test.ts                : INV-05 on out.details.plugins[].reasons
```

### Pattern 1: Orchestrator stamps, render map renders

**What:** the row builder decides the reason set; the render arm passes it through.
**When to use:** every reason brace on the list surface.
**Current state (INV-01 change point A)** — `[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:485-499]`, quoted verbatim:

```typescript
  return {
    // RLD-04 / D-08: the list-surface inventory row is `installed` with
    // `needsReload: false` -- the stamped flag IS the old `present`
    // reload-suppression (the OR-reduce reload-hint stays suppressed for
    // steady-state inventory). `reasons` is OMITTED so the orphan-rewake brace
    // never leaks onto an inventory row.
    status: "installed",
    name: pluginName,
    dependencies: dependenciesFromDeclares(declaresAgents, declaresMcp),
    version: record.version,
    ...scopeField,
    ...descriptionField,
    severity: "info",
    needsReload: false,
  };
```

Note the comment conflates `needsReload: false` with the `reasons` omission. They are
independent — `shouldEmitReloadHint` reduces over `needsReload` only and never reads
`reasons` `[VERIFIED: extensions/pi-claude-marketplace/shared/notify.ts:2887-2891]`:

```
function shouldEmitReloadHint(message: NotificationMessage): boolean {
  // RLD-02: the reload hint is the OR-reduce of the caller-stamped
  // `needsReload` over the cascade rows (see the flattened loop below) -- NOT
  // status-token / cascade-kind inference.
```

**Current state (INV-02 change point)** — `[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:441-450]`, quoted verbatim:

```typescript
  if (status === "partially-installed" || status === "partially-installed-upgradable") {
    return {
      status: "partially-installed",
      name: pluginName,
      reasons: narrowUnsupportedKinds(record.compatibility.unsupported),
      version: record.version,
      ...scopeField,
      ...descriptionField,
    };
  }
```

INV-02 requires `"not in manifest"` prepended to that array when the manifest loaded and the
entry is missing. Source authority, quoted verbatim from
`[VERIFIED: .planning/REQUIREMENTS.md:13]`:

> **INV-02**: An enabled installation record with one or more persisted `compatibility.unsupported` kinds retains the existing `(partially-installed)` status and unsupported-kind reasons, with `not in manifest` added first.

Corroborated by `[VERIFIED: docs/plans/2026-08-07-manifest-independent-installed-plugin-info-design.md:52]`:

> - enabled record with unsupported kinds: the existing partially-installed inventory row, with `"not in manifest"` followed by the reasons derived from `compatibility.unsupported`;

### Pattern 2: `ScopedManifest` threading (D-95-04)

**What:** replace the bare `manifest` param with the bundle.
**Existing type** — `[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:789-792]`, quoted verbatim:

```typescript
interface ScopedManifest {
  readonly manifest: MarketplaceManifest | undefined;
  readonly loadError: string | undefined;
}
```

**Blast radius — complete enumeration.** `enumerateMarketplacePlugins` and
`installedRowMessage` are both file-private. A repo-wide grep across `extensions/` and
`tests/` finds no importer of either symbol; the only non-`list.ts` occurrences are prose
mentions in comments (`orchestrators/plugin/git-source-probe.ts:5`,
`orchestrators/plugin/plugin-state-classifier.ts:4`,
`tests/orchestrators/plugin/plugin-state-classifier.test.ts:6`,
`tests/orchestrators/plugin/list.test.ts:334` and `:603`). Neither appears in the `__test_`
re-export block, which exports only `narrowProbeError`, `narrowListFailReason`, and
`availableRowMessage` `[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:1273-1282]`.
**The entire signature change is confined to `list.ts`.**

Call sites (2, both in `list.ts`):

1. `list.ts:877-884` — primary path inside `buildMarketplaceMessage`. Reached only after the
   `loadError !== undefined` early return at `list.ts:862-874`, so `manifest` is always
   defined here.
2. `list.ts:987-993` — fold path. Reached with `manifest` possibly `undefined` because
   `list.ts:977` destructures only `{ manifest }`.

Consumers of the `manifest` param *inside* `enumerateMarketplacePlugins` (3):

- `list.ts:738` — `const manifestEntry = manifest?.plugins.find((p) => p.name === pluginName);`
- `list.ts:756` — `if (manifest === undefined) { return rows; }` (early return after installed rows are emitted; this is why the fold still shows folded rows on a failed manifest)
- `list.ts:760` — `for (const manifestEntry of manifest.plugins) {` (available/unavailable bucket)

The downstream signal must reach `installedRowMessage` (`list.ts:331-345`), whose current
parameter list ends `manifestEntry, cwd`. Adding the loaded-ness fact there is the minimal
change; whether it arrives as a `ScopedManifest` or a derived boolean is Claude's-discretion
per D-95-04's third bullet, provided the *caller* passes the bundle.

### Pattern 3: Byte-exact orchestrator assertion

**Example** — `[VERIFIED: tests/orchestrators/plugin/list.test.ts:1488-1495]`, quoted verbatim:

```typescript
    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    assert.equal(
      notifications[0]!.message,
      // Byte-identical to the non-path `info` row (sans the info-only
      // `components: not resolved` line) -- the WR-02 cross-surface parity.
      ["● mp1 [user]", "  ◉ remote v1.0.0 (partially-installed) {lsp}"].join("\n"),
    );
```

This is the exact model D-95-09 asks for. Note the two-space plugin-row indent, the
`● <mp> [<scope>]` header with no `<autoupdate>` marker when autoupdate is unset, and the
single-notification contract (`notifications.length === 1`).

### Anti-Patterns to Avoid

- **Editing `shared/notify.ts::renderPluginRow`'s `installed` arm to fix INV-01.** It already
  passes `p.reasons` and is not on the list code path. Editing it changes install-cascade
  output, not list output.
- **Adding a `manifestLoaded: boolean` beside the `manifest` param.** Explicitly rejected by
  D-95-04 as the drift shape that caused the defect.
- **Pinning the partial-*disabled* rendering in the characterization set.** D-95-09 and INV-04
  both forbid it; ENBL-06 changes it in Phase 97.
- **Relying on the catalog UAT as the INV-01 gate.** See Pitfall 1.
- **Carrying `RLD-04 / D-08` forward into rewritten comments** as though resolvable (D-95-03),
  and **no sweep** of the other seven sites (`<specifics>`).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Composing the `{a, b}` brace | String concatenation in the row builder | `composeReasons` (`shared/notify.ts:1990-2004`) | Returns `""` for an empty array so MSG-GR-4's "no empty `{}`" rule holds structurally; appends soft-dep markers in the correct position. |
| Mapping an unsupported kind to a reason token | A local switch | `narrowUnsupportedKinds` (`shared/probe-classifiers.ts:183-197`) | Already imported at `list.ts`; de-dupes and applies the `lspServers → lsp` / `hooks → unsupported hooks` carve-outs, everything else → `unsupported component` (`probe-classifiers.ts:207-217`). |
| Deciding "is this record disabled" | A local `enabled === false` check | `isRecordedButDisabled` (imported at `list.ts:73` from `../reconcile/plan.ts`) | It is the canonical predicate; Phase 97 replaces its *definition*, and any local copy would silently escape that repair. |
| Hermetic tmp `HOME`/`cwd` | Ad-hoc `mkdtemp` + manual cleanup | Copy `withHermeticHome` from `list.test.ts:83-104` | It restores `HOME` in a `finally` and uses `maxRetries: 5, retryDelay: 100` on `rm` to survive the ENOTEMPTY race documented at `list.test.ts:99-101`. |
| Writing a valid `state.json` by hand | Raw `writeFile` | `saveState` (`persistence/state-io.ts`) | It validates against `STATE_SCHEMA`; a hand-rolled record that drifts from the schema fails loudly at seed time instead of mysteriously at read time. |

**Key insight:** every piece of vocabulary this phase needs already exists as a closed-set
member with a canonical producer. The phase adds zero vocabulary — which is precisely what
COMPAT-01 asserts and what keeps `tests/architecture/notify-closed-set-locks.test.ts` from
needing a count bump.

---

## Common Pitfalls

### Pitfall 1: The catalog UAT will not catch a `LIST_RENDER` regression

**What goes wrong:** a plan that satisfies INV-01 only in `list.ts`, or a future refactor that
re-suppresses `LIST_RENDER.installed`, passes `npm run check` if the only byte gate is the
catalog.
**Why it happens:** `tests/architecture/catalog-uat.test.ts` drives the **central** renderer.
Its own header states the scope `[VERIFIED: tests/architecture/catalog-uat.test.ts:12-13]`:

```
// SCOPE GATE (SNM-31): this test drives `notify()` exclusively. Fixtures are
// pure `NotificationMessage` data -- they are not synthesized from domain
```

and the driver loop calls `notify(ctx as never, fixture.pi as never, fixture.message);`
`[VERIFIED: tests/architecture/catalog-uat.test.ts:3965]`. Fixtures are hand-written literals
(e.g. the `soft-dep-on-installed` fixture at `catalog-uat.test.ts:403-440`), so a Phase 98
catalog state carrying `reasons: ["not in manifest"]` would render correctly through the
central arm regardless of what `LIST_RENDER` does.
**How to avoid:** make the INV-01 gate an orchestrator-level byte-exact assertion driven
through `listPlugins`, per D-95-09. That is the only path that exercises `LIST_RENDER`.
**Warning signs:** a plan task whose verification is "catalog UAT green".

### Pitfall 2: INV-02 mis-scoped as characterization-only

**What goes wrong:** the partial row ships without `{not in manifest, …}`, and the phase
verifier marks INV-02 satisfied because the characterization test passes.
**Why it happens:** 95-CONTEXT.md's `<code_context>` names only `list.ts:485-499`; ROADMAP
criterion 2's sentence about the partial row concerns the *version*, not the reason.
**How to avoid:** treat REQUIREMENTS.md:13 ("with `not in manifest` added first") as the
authority. Plan two orchestrator edits and two byte forms.
**Warning signs:** a Wave-C test list with no partial-row `{not in manifest, …}` assertion.

### Pitfall 3: Ordering of the prepend

INV-02 says *first*. `composeReasons` joins with `", "` in array order
(`notify.ts:1996-2003`), and soft-dep markers are pushed **after** the caller's reasons
(`notify.ts:1997`). So the required order is
`["not in manifest", ...narrowUnsupportedKinds(...)]` — building the array the other way
around produces `{lsp, not in manifest}` and fails a byte-exact test.

### Pitfall 4: Soft-dep markers do not fire on partial inventory rows

Criterion 3 ("soft-dependency markers still compose after the new reason") is testable on the
`installed` arm **only**. The `partially-installed` render arm calls
`pluginRow(ICON_PARTIALLY_INSTALLED, p, mpScope, "(partially-installed)", probe)`
(`list.messaging.ts:144-145`), and `pluginRow` hard-codes both soft-dep flags to `false`
`[VERIFIED: extensions/pi-claude-marketplace/shared/notify.ts:2065-2071]`:

```
  return joinTokens([
    icon,
    p.name,
    renderScopeBracket(p.scope, mpScope),
    renderVersion(p.version),
    label,
    composeReasons(p.reasons, false, false, probe),
```

`PluginPartiallyInstalledMessage`'s doc comment confirms the intent: "The list/info INVENTORY
partial rows OMIT `dependencies` (the inventory surface carries no soft-dep markers)"
`[VERIFIED: extensions/pi-claude-marketplace/shared/notify.ts:859-861]`. Writing a soft-dep
test against a partial row will fail for the wrong reason.

### Pitfall 5: The `seedMarketplace` helper cannot seed a soft-dep-declaring record

`installedRowMessage` derives the flags from the record
(`list.ts:346-347`: `record.resources.agents.length > 0` / `record.resources.mcpServers.length > 0`),
but `seedMarketplace`'s installed-record builder only ever populates `skills`, or `hooks` under
`hooksOnly`, or nothing under `disabled` `[VERIFIED: tests/orchestrators/plugin/list.test.ts:201-207]`:

```typescript
    if (info.disabled === true) {
      resources = { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] };
    } else if (info.hooksOnly === true) {
      resources = { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [name] };
    } else {
      resources = { skills: [`${name}-skill`], prompts: [], agents: [], mcpServers: [], hooks: [] };
    }
```

The new file's copy of the helper needs an `agents?: boolean` / `mcp?: boolean` option (or the
soft-dep test writes state directly). `makeCtx`'s `pi.getAllTools()` returns `[]`
(`list.test.ts:66`), and both probes look for tools named `subagent` / `mcp`
(`platform/pi-api.ts:133-160`), so **both companions read unloaded by default** — the markers
will fire as soon as a record declares them.

### Pitfall 6: The fold fixture needs a shared `marketplaceRoot` but divergent `manifestPath`

`isCloneOfUserMarketplace` keys on `marketplaceRoot` equality only
`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:834]`:

```typescript
  return projectMp.marketplaceRoot === userMp.marketplaceRoot;
```

and the fold's manifest read uses `projectMp.manifestPath`
(`list.ts:977`, via `loadMarketplaceManifestSoftly(mpRecord)` → `loadManifestSoftly(mpRecord.manifestPath)`
at `list.ts:794-798`). So the BOUND-03 negative fixture points the project record's
`manifestPath` at a nonexistent file while keeping `marketplaceRoot` identical to the user
record's. The fold still triggers, the project manifest read throws, and the folded row must
render bare. Model the seeding on `list.test.ts:1234-1271`, which already writes a
shared-`marketplaceRoot` project record via `saveState`.

Because `enumerateMarketplacePlugins` emits installed rows **before** the
`manifest === undefined` early return at `list.ts:756`, the folded row survives — matching
D-95-05's "the row is preserved, only the false claim is suppressed."

### Pitfall 7: Severity and the reload trailer are inert here — do not assert them defensively

Severity is the max over caller-stamped row severities and never inspects reasons
`[VERIFIED: extensions/pi-claude-marketplace/shared/notify.ts:2509-2510]`:

```
  // SEV-02: the cascade severity is the MAX over the rows' caller-stamped
  // `severity` (see `cascadeSeverity`), NOT content inference.
```

The installed row stamps `severity: "info"` (`list.ts:497`), which surfaces as
`notifications[0].severity === undefined` in tests (see `list.test.ts:1005`). The reload
trailer reduces over `needsReload` only (Pitfall-2 quote above). Adding reasons changes
neither. Byte-exact full-message assertions cover both implicitly; extra probes add noise.

### Pitfall 8: Row ordering is name-then-scope, independent of reasons

`sortPluginsInBlock` compares `a.name.localeCompare(b.name, undefined, { sensitivity: "base" })`
then project-before-user (`list.ts:1148-1161`). Reasons never participate. A byte-exact
multi-row fixture should still choose deliberately distinct names so the expected order is
obvious to a reader.

### Pitfall 9: Scope-bracket suppression on same-scope rows

`installedRowMessage` omits the `scope` field entirely when `pluginScope === marketplaceScope`
`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:355-356]`:

```typescript
  const scopeField: { readonly scope?: Scope } =
    pluginScope === marketplaceScope ? {} : { scope: pluginScope };
```

So a single-scope fixture renders `  ● alpha v1.0.0 (installed) {not in manifest}` with **no**
`[user]` bracket, while the folded row renders `  ● alpha [project] v1.0.0 (installed)`. Getting
this backwards is the most common byte-exact failure in this file's history (see the extensive
comments at `list.test.ts:327-335` and `370-373`).

### Pitfall 10: One existing test's comment goes stale under INV-01/INV-02

`tests/edge/handlers/tools.test.ts:553-554` states verbatim:

```
// version through. `pluginReasons` OMITS the force-installed row's reasons on
// the tool surface (only unavailable / unsupported / upgradable carry reasons).
```

That test (`tools.test.ts:555-625`) seeds a partially-installed record whose plugin is absent
from the manifest (`plugins: []` at `tools.test.ts:562`, `unsupported: ["themes"]` at
`tools.test.ts:586`). Its assertions never touch `reasons`, so it will not red-fail — but the
comment becomes false and the fixture is the ready-made INV-05 site. Under the change the row
gains `reasons: ["not in manifest", "unsupported component"]` (`themes` is a non-carve-out kind,
`probe-classifiers.ts:207-217`).

---

## Code Examples

### Reading the tool payload for an INV-05 assertion

`[VERIFIED: tests/edge/handlers/tools.test.ts:698-713]`, quoted verbatim:

```typescript
    const { pi, registered } = makeMockPi();
    registerListPluginsTool(pi);
    const tool = registered.get("pi_claude_marketplace_plugin_list")!;
    const ctx = makeCtx(cwd);
    const out = await tool.execute("call-1", { installed: true }, undefined, undefined, ctx);

    // upgradable projects to 'installed' on the tool surface
    assert.match(out.content[0]!.text, /\[installed\] pupgrade/);
    const details = out.details as {
      plugins: { name: string; status: string; reasons?: unknown }[];
    };
    assert.equal(details.plugins.length, 1);
    assert.equal(details.plugins[0]!.name, "pupgrade");
    assert.equal(details.plugins[0]!.status, "installed");
    // pluginReasons returns undefined for empty reasons[] (line 337)
    assert.equal(details.plugins[0]!.reasons, undefined);
```

This satisfies criterion 5's "asserted on the tool output, not inferred from the row builder":
`out.details.plugins[i].reasons` is the payload field, and `out.content[0].text` is the flat
line (`renderPluginRow` at `tools.ts:219-231` appends `(<reasons joined>)`).

### The current `pluginReasons` gate (INV-05 change point)

`[VERIFIED: extensions/pi-claude-marketplace/edge/handlers/tools.ts:370-382]`, quoted verbatim:

```typescript
function pluginReasons(p: PluginNotificationMessage): readonly string[] | undefined {
  if (
    p.status === "unavailable" ||
    p.status === "partially-available" ||
    p.status === "upgradable"
  ) {
    // USTAT-01: the `partially-available` row carries the same per-kind reason braces as
    // the `unavailable` row, so surface them on the tool details too.
    return p.reasons.length > 0 ? p.reasons : undefined;
  }

  return undefined;
}
```

`partially-installed` can join the existing conjunct directly (its `reasons` is required —
`notify.ts:871`). `installed` cannot: `PluginInstalledMessage.reasons?` is optional
`[VERIFIED: extensions/pi-claude-marketplace/shared/notify.ts:682]` (`readonly reasons?: readonly ContentReason[];`),
so it needs its own arm with an undefined guard.

### Reason-token membership (no closed-set growth)

`[VERIFIED: extensions/pi-claude-marketplace/shared/notify-reasons.ts:125]` — the literal
`"not in manifest",` is already a member. It is a `ContentReason` because
`ContentReason = Exclude<Reason, "not added">`
`[VERIFIED: extensions/pi-claude-marketplace/shared/notify.ts:189]`, so it type-checks in both
`PluginInstalledMessage.reasons?` and `PluginPartiallyInstalledMessage.reasons`. No bump to
`tests/architecture/notify-closed-set-locks.test.ts` is needed — that gate asserts tuple
*lengths*, and no member is added.

### Expected byte forms

Derived from `docs/output-catalog.md` and the existing test corpus. Under a marketplace with
no `autoupdate`, header is `● <mp> [<scope>]`; rows are indented two spaces.

```text
INV-01, same scope, no soft-deps:
  ● alpha v1.0.0 (installed) {not in manifest}

INV-01 + soft-dep composition (criterion 3), record declares agents, companion unloaded:
  ● alpha v1.0.0 (installed) {not in manifest, requires pi-subagents}

INV-02, partial, lspServers dropped:
  ◉ plug v1.0.0 (partially-installed) {not in manifest, lsp}

INV-04, canonical disabled (no brace, ever):
  ◍ alpha v1.2.3 (disabled)

BOUND-03 negative, folded row whose project manifest failed to load:
  ● alpha [project] v1.0.0 (installed)

BOUND-03 positive, folded row, project manifest loaded without the entry:
  ● alpha [project] v1.0.0 (installed) {not in manifest}
```

Glyph authority: `◉` for partially-installed and `◍` for disabled, per
`docs/output-catalog.md:372-378` and `:324-330`. The soft-dep marker spelling
`requires pi-subagents` / `requires pi-mcp` is from `docs/output-catalog.md:227-236`.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact on this phase |
|--------------|------------------|--------------|----------------------|
| One central `renderPluginRow` switch for every surface | Per-command `CommandContext.render` maps (D-10/D-11); central helpers called, never duplicated | Before v1.18 | **This is the whole INV-01 correction.** Reasoning about `shared/notify.ts` arms is reasoning about the wrong file for list output. |
| `present` status token for list inventory | Collapsed into `installed` with `needsReload: false` (RLD-04 / D-08) | Before v1.18 | Explains the stale `"present"` mentions in `list.test.ts:334` / `:1196`. |
| `(unsupported)` collapsed token | De-collapsed into `(partially-available)` (not installed) vs `(partially-installed)` (installed) — USTAT-01 / FSTAT-02 | Before v1.18 | Older comments and the `--partial` flag key on the pre-collapse bucket; do not "fix" them. |

**Deprecated / not authoritative:**
- `docs/prd/pi-claude-marketplace-prd.md` PL-6 row and §5.3.1 flowchart — describe the retired
  v1 renderer. DOC-08 corrects them in Phase 98. Do not cite as contract.
- `RLD-04` / `D-08` — unresolvable IDs (D-95-03). Present in comments only.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Rewriting the stale `shared/notify.ts:2176-2179` comment ("The list inventory row OMITS `reasons`") is **optional** for Phase 95 — the D-95-03 `<specifics>` "no sweep" guidance is read as covering it. `[ASSUMED]` | § The render-map suppression is real | A verifier could read the stale comment as a contract violation. Low impact; cheap to include if the planner prefers. |
| A2 | Phase 95 does **not** need to add a `docs/output-catalog.md` catalog state for the new byte form; DOC-08 (Phase 98) owns catalog updates. `[ASSUMED]` — inferred from the REQUIREMENTS.md traceability table mapping DOC-08 to Phase 98, not from an explicit Phase 95 exclusion. | § Validation Architecture | If wrong, Phase 95 ships a byte form the catalog does not document for one phase. No gate red-fails (Pitfall 1). |
| A3 | No test outside `tests/orchestrators/plugin/list.test.ts`, `tests/edge/handlers/tools.test.ts`, `tests/integration/fold-adoption.test.ts`, and `tests/orchestrators/reconcile/pending.test.ts` renders list output. `[VERIFIED: repo-wide grep for `listPlugins|loadPluginListPayload` under tests/]` — but whether each of those seeds a manifest-absent installed record was checked by reading, not exhaustively for every test in the 2481-line file. `[ASSUMED]` for the exhaustiveness claim. | § Validation Architecture | An unnoticed byte-exact test could red-fail on the new brace. Mitigation: run `npm test` early in Wave B; the failure would be immediate and self-describing. |
| A4 | `tests/architecture/notify-producer-wire-coverage.test.ts` does not exercise `LIST_CONTEXT` (a grep for `LIST_CONTEXT` and `list` in that file returned nothing). `[VERIFIED: grep]` — but the file was not read in full. `[ASSUMED]` for "therefore no interaction". | § Validation Architecture | A stamped-severity gate could red-fail. Severity is untouched, so risk is very low. |

---

## Open Questions

1. **Does Phase 95 rewrite the central `shared/notify.ts:2176-2179` comment?**
   - What we know: it asserts "The list inventory row OMITS `reasons`", which becomes false.
     It lives in a file this phase otherwise does not edit.
   - What's unclear: whether D-95-03's "should only touch the ones in code it is already
     editing, not embark on a sweep" covers a comment made false by this change.
   - Recommendation: rewrite it. It is one comment, it is made false by this diff, and leaving
     a knowingly-false contract comment is worse than a one-line out-of-file edit. Surface the
     choice in the plan rather than deciding silently.

2. **Does the `installed` brace also apply when the row is `upgradable`?**
   - What we know: an `upgradable` row exists only when `manifestEntry?.version !== undefined`
     (`list.ts:348-349`), which requires a manifest entry — so `upgradable` and "not in
     manifest" are mutually exclusive by construction.
   - What's unclear: nothing, but a plan task that adds the reason generically to
     `installedRowMessage`'s prelude rather than to the specific return sites could
     accidentally stamp it on `upgradable` / `partially-upgradable`.
   - Recommendation: stamp at the two specific return sites (`441-450`, `485-499`); do not
     compute a shared `reasons` local at the top of the function.

3. **Is the D-95-04 reversibility note still accurate given the two-file INV-01 edit?**
   - Recommendation: no change needed to D-95-04 itself (it concerns the signature, which is
     still one file). But D-95-01's "reversible — the change is a single object field" note is
     now understated; the plan should record the corrected scope so the phase verifier does not
     flag the extra file as scope creep.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | ✓ | ≥20.19.0 required by `package.json` engines; the worktree runs the repo's checked-in toolchain | — |
| `node:test` | new test file | ✓ | bundled | — |
| npm | `npm run check` | ✓ | — | — |
| Network | — | not required | — | NFR-5 forbids it on this path |
| `pi-subagents` global peer | two integration tests only | ✗ locally (stale global 0.24.3 below the `>=0.35.0` floor) | — | Per `.planning/STATE.md:90-94`, point `PI_SUBAGENTS_ROOT` at Pi's managed 0.42.1 for a green baseline; CI skips those two checks. **Does not affect any Phase 95 test.** |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** the `pi-subagents` global peer — documented, pre-existing,
and orthogonal to this phase (see the `pi-subagents-integration-tests-global-peer` note in
project memory).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node ≥20.19.0 built-in), assertions via `node:assert/strict` |
| Config file | none — glob-driven from `package.json` scripts |
| Quick run command | `node --test "tests/orchestrators/plugin/list-manifest-absent.test.ts"` |
| Targeted pair | `node --test "tests/orchestrators/plugin/list*.test.ts" "tests/edge/handlers/tools.test.ts"` |
| Full suite command | `npm run check` (typecheck + lint + format:check + `npm test` + `npm run test:integration`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Kind | Test Type | Automated Command | File Exists? |
|--------|----------|------|-----------|-------------------|--------------|
| INV-02 | Manifest-absent partial record renders `◉ <p> v<v> (partially-installed) {<kinds>}` **before** any production edit | characterization | orchestrator | `node --test tests/orchestrators/plugin/list-manifest-absent.test.ts` | ❌ Wave A |
| INV-03 | `--installed` shows both the manifest-absent clean row and the manifest-absent partial row; excludes `available` | characterization | orchestrator | same | ❌ Wave A |
| INV-04 | Manifest-absent record in the **canonical** disabled shape renders `◍ <p> v<v> (disabled)` with no brace | characterization | orchestrator | same | ❌ Wave A |
| BOUND-03 | Folded row whose project-side manifest **failed to load** renders `● <p> [project] v<v> (installed)` with no brace | characterization → must still hold after the fix | orchestrator | same | ❌ Wave A |
| INV-01 | Manifest-absent clean record renders `● <p> v<v> (installed) {not in manifest}` | new behavior | orchestrator (byte-exact, full message) | same | ❌ Wave C |
| INV-01/INV-02 | Soft-dep marker composes **after** the new reason: `{not in manifest, requires pi-subagents}` | new behavior | orchestrator (byte-exact) | same | ❌ Wave C — needs a record declaring `resources.agents` (Pitfall 5) |
| INV-02 | Manifest-absent partial renders `{not in manifest, lsp}` — reason **first** | new behavior | orchestrator (byte-exact) | same | ❌ Wave C |
| BOUND-03 | Folded row whose project-side manifest **loaded without the entry** renders `{not in manifest}` | new behavior | orchestrator (byte-exact) | same | ❌ Wave C |
| INV-05 | `out.details.plugins[i].reasons` carries the reason on an `installed` row | new behavior | edge / tool-surface | `node --test tests/edge/handlers/tools.test.ts` | ✅ file exists; new test case |
| INV-05 | `out.details.plugins[i].reasons` carries the reason on a `partially-installed` row | new behavior | edge / tool-surface | same | ✅ fixture already exists at `tools.test.ts:555-625`; extend it or add a sibling |
| COMPAT-01 (carry) | No closed-set growth | invariant | architecture (existing) | `node --test tests/architecture/notify-closed-set-locks.test.ts` | ✅ exists, must stay green **without a count bump** |
| NFR-5 (carry) | `list.ts` stays network-free after the signature change | invariant | architecture (existing) | `node --test tests/architecture/no-orchestrator-network.test.ts` | ✅ exists |

**Observable signal per level.** Orchestrator tests assert `notifications[0]!.message` equals a
`[...lines].join("\n")` literal and `notifications.length === 1` — this is the only level that
exercises `LIST_RENDER` and therefore the only level that can prove INV-01 (Pitfall 1). Tool
tests assert on the object returned by `tool.execute(...)`: `out.details.plugins[]` for the
structured payload and `out.content[0].text` for the flat line — satisfying criterion 5's
"asserted on the tool output, not inferred from the row builder".

**Characterization vs new behavior.** INV-03, INV-04, and the BOUND-03 negative are pure
characterization: they must pass unchanged before and after Wave B. INV-02 is *both* — its
status/glyph/version are characterization, its reason set changes. INV-01, INV-05, and the
BOUND-03 positive are new behavior only.

### Sampling Rate

- **Per task commit:** `node --test tests/orchestrators/plugin/list-manifest-absent.test.ts` (< 5 s)
- **Per wave merge:** `node --test "tests/orchestrators/plugin/**/*.test.ts" "tests/edge/**/*.test.ts" "tests/architecture/**/*.test.ts"`
- **Phase gate:** `npm run check` green before `/gsd-verify-work` (per NFR-6)

### Wave 0 Gaps

- [ ] `tests/orchestrators/plugin/list-manifest-absent.test.ts` — new file; covers INV-01, INV-02, INV-03, INV-04, BOUND-03
- [ ] Local `withHermeticHome` / `makeCtx` / `seedMarketplace` copies inside that file (none of the three is exported from `list.test.ts`)
- [ ] `seedMarketplace` variant supporting `resources.agents` / `resources.mcpServers` for the soft-dep composition case (Pitfall 5)
- [ ] New INV-05 case(s) in the existing `tests/edge/handlers/tools.test.ts`, plus a comment fix at `tools.test.ts:553-554` (Pitfall 10)
- [ ] Framework install: **not needed** — `node:test` is built in

---

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so it is treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface is touched. `platform/git-credential.ts` is not reached from `list`. |
| V3 Session Management | no | No sessions. |
| V4 Access Control | no | No principals; scope selection (`user`/`project`) is a routing concern, not an authorization one. |
| V5 Input Validation | **yes (already satisfied, unchanged)** | `state.json` is validated on read by `persistence/state-io.ts` against `STATE_SCHEMA`; `marketplace.json` by `domain/manifest.ts` (its throw is what produces `loadError`). The phase adds no new parser and no new input. |
| V6 Cryptography | no | None involved. |
| V12 Files & Resources | **yes (unchanged)** | The only filesystem read this phase's diff influences is the already-guarded manifest read. `assertPathInside` (`shared/path-safety.ts`, NFR-10) governs every derived path via `ScopedLocations`; no new path is derived from state-supplied data. (Phase 96's INFO-11 hooks read is where that guard becomes newly load-bearing — not here.) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation | Status in this phase |
|---------|--------|---------------------|----------------------|
| Path traversal from a state-supplied plugin slug | Tampering | `assertPathInside` chokepoint via `ScopedLocations` | Not newly reached — no new path derivation |
| Output injection through a plugin name into the rendered row | Tampering / Repudiation | Names pass `domain/name.ts` safe-name assertions at install time; the renderer does no escaping and needs none (plain terminal text) | Unchanged |
| Information disclosure via reason text | Information disclosure | Reasons are a **closed set** of fixed literals; no free-text and no path ever reaches a `{}` brace. `collapseAbsolutePaths` (`notify.ts:192-201`) exists for the free-text cause-chain channel, which this phase does not touch | Unchanged; the closed set is what makes the new brace safe by construction |
| Network egress from a read-only command | Information disclosure | NFR-5 + `tests/architecture/no-orchestrator-network.test.ts` source-grep gate | Must stay green after the `enumerateMarketplacePlugins` signature change |

**Net assessment:** no new attack surface. The one thing to preserve is the network gate, which
is already an automated check.

---

## Sources

### Primary (HIGH confidence) — files read this session in the worktree

- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` (lines 100-500, 700-1060, 1186-1266)
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts` (lines 1-184)
- `extensions/pi-claude-marketplace/shared/notify.ts` (lines 660-700, 855-890, 1960-2010, 2053-2300, 2345-2360, 2508-2553, 2875-2910)
- `extensions/pi-claude-marketplace/shared/notify-context.ts` (lines 18-120, 258-340)
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` (lines 117-131)
- `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` (lines 183-217)
- `extensions/pi-claude-marketplace/edge/handlers/tools.ts` (lines 120-260, 300-480)
- `extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts` (lines 117-162)
- `extensions/pi-claude-marketplace/platform/pi-api.ts` (lines 133-167)
- `tests/orchestrators/plugin/list.test.ts` (lines 1-430, 978-1310, 1432-1560)
- `tests/edge/handlers/tools.test.ts` (lines 1-182, 525-714)
- `tests/architecture/catalog-uat.test.ts` (lines 1-80, 403-440, 3912-3970)
- `tests/architecture/notify-closed-set-locks.test.ts`, `notify-producer-wire-coverage.test.ts`, `notify-stamp-coverage.test.ts`, `partial-vocabulary-guard.test.ts` (headers)
- `tests/shared/notify-context-dispatch-guard.test.ts` (lines 1-100)
- `docs/output-catalog.md` (lines 62, 163-405, 1419-1545)
- `docs/plans/2026-08-07-manifest-independent-installed-plugin-info-design.md` (lines 39-60, 121-161)
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md` (Phase 95 section), `.planning/config.json`
- `.claude/rules/typescript-comments.md`
- `CLAUDE.md` (worktree copy)

### Secondary (MEDIUM confidence)

- Repo-wide greps for `enumerateMarketplacePlugins`, `installedRowMessage`, `not in manifest`,
  `listPlugins|loadPluginListPayload`, `LIST_RENDER` — used for blast-radius and
  coverage-gap enumeration. Greps confirm absence of occurrences; they are not a substitute
  for reading, and every claim above that a grep informed is flagged in the Assumptions Log
  where exhaustiveness matters (A3, A4).

### Tertiary (LOW confidence)

- None. No web search or external documentation lookup was performed or needed — the phase is
  entirely in-repo and no external package is involved.

---

## Project Constraints (from CLAUDE.md)

Directives the planner must not contradict:

- **Quality bar (NFR-6):** `npm run check` must stay green — typecheck + ESLint + Prettier +
  tests + integration tests.
- **Output channel (IL-2):** all user-visible messages go through `ctx.ui.notify`; no direct
  `process.stdout`/`process.stderr`. Enforced by an ESLint `no-restricted-syntax` block scoped
  to `extensions/pi-claude-marketplace/**/*.ts`.
- **Network policy (NFR-5):** `list` must not touch the network. Enforced by
  `tests/architecture/no-orchestrator-network.test.ts` (source-grep gate) — the
  `enumerateMarketplacePlugins` signature change must not introduce a `gitOps` field or a
  `platform/git` import.
- **Comment policy** (`.claude/rules/typescript-comments.md`): rewritten comments and new test
  titles may cite requirement/decision IDs (`INV-01`, `BOUND-03`, `D-95-04`, `NFR-5`) but must
  **not** cite `Phase 95`, `Plan NN`, `Wave N`, `Pitfall N`, or `v1.18 milestone`. This applies
  to the new test file's `test("…")` titles as much as to source comments.
- **TypeScript strictness:** `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`,
  `noUnusedLocals`. The `...scopeField` / `...descriptionField` spread idiom in
  `installedRowMessage` exists specifically because of `exactOptionalPropertyTypes` — a
  conditional `reasons` field must follow the same idiom, not `reasons: cond ? x : undefined`.
- **Import organization:** blank line between groups, alphabetized case-insensitively,
  type-only imports grouped last, explicit `.ts` extensions in test imports.
- **Git:** never commit to `main`; conventional commits; run `pre-commit run --files <changed>`
  before committing; prefix worktree commits with `SKIP=trufflehog`; never `--no-verify`;
  never rebase.
- **No new closed-set members** (COMPAT-01): no status token, reason token, glyph, state field,
  migration, or network path.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no external dependencies; every helper cited was read.
- Architecture / change points: HIGH — the `LIST_RENDER` finding is backed by three
  independent reads (dispatch comment, dispatch code, arm body) and a self-describing doc
  comment in the arm itself.
- Test mechanics: HIGH — fixture helpers, seeding shapes, and assertion idioms were read in
  full, including the exact `seedMarketplace` resources branch that limits soft-dep seeding.
- Coverage-gap analysis: MEDIUM — the "no existing test seeds a manifest-absent installed
  record on the list surface" claim rests on reading the disabled/partial/fold tests plus a
  grep across the four list-consuming test files; see Assumptions Log A3.
- Pitfalls: HIGH for 1-9 (all code-backed); HIGH for 10 (the stale comment and its fixture were
  both read).

**Research date:** 2026-08-08
**Valid until:** indefinite for the in-repo findings, provided `orchestrators/plugin/list.ts`,
`list.messaging.ts`, `edge/handlers/tools.ts`, and `shared/notify-context.ts` are not modified
before planning. Re-verify the `LIST_RENDER.installed` arm if any of those files changes.
