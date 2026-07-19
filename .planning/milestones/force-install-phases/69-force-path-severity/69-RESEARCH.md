# Phase 69: Force-Path Severity - Research

**Researched:** 2026-06-28
**Domain:** Internal notification-severity wiring (TypeScript; caller-stamped desired-state model)
**Confidence:** HIGH (all seams located in source; no external dependencies)

## Summary

This phase is pure severity wiring on an already-shipped model. Severity is a
caller-stamped, per-row optional field (`MessageBase.severity?: Severity`);
`cascadeSeverity` (the body of `computeSeverity`) takes the numeric MAX over
every row and maps it to the `info<warning<error` magic-string the Pi API's
`ctx.ui.notify(msg, type?)` second arg accepts. Nothing in the renderer infers
severity from content. The job here is to stamp the SEV-01..05 desired-state
values at the producer sites, conditioning each on a signal the codebase
already holds.

The model is fully in place: `Severity`, `MessageBase`, `cascadeSeverity`,
`composeReasons`, `narrowUnsupportedKinds`, and per-row render helpers
(`forceInstalledRow`, `pluginRow`, `installedLikeRow`) all exist and are wired.
Three of the five SEV items are partially or fully satisfied already (the
force-degrade `info` stamps and the reinstall manual-recovery `warning` stamp
are live). The remaining work splits cleanly into (a) one genuinely new
byte-visible string — the SEV-02 `--force` hint — which requires threading the
three-way resolver state into the thrown `PluginShapeError`; (b) one
behavioral change — SEV-03 making the autoupdate cascade TAKE the force path
instead of emitting `(skipped) {no longer installable}`; and (c) several
metadata-only severity flips conditioned on existing signals (invocation
cardinality, persisted `compatibility.unsupported`, soft-dep probe).

**Primary recommendation:** Treat each SEV item as a surgical stamp-site edit.
For the two items that change rendered bytes (SEV-02 hint, SEV-03
autoupdate-takes-force) land catalog + catalog-uat fixtures in the SAME commit
(the byte-equality gate goes RED otherwise). For the metadata-only flips
(SEV-01 missing-companion, SEV-04 targeted/bulk) the only test surface is the
catalog-uat fixture's `expectedSeverity` field plus any bulk summary-line tally.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-69-01 (SEV-03):** Read the plugin's PERSISTED `compatibility` record
  BEFORE the auto-update applies: prior `unsupported` empty (clean/installed)
  and the update degrades it -> NEWLY degraded -> **warning**; prior
  `unsupported` non-empty (already force-installed) and still degraded ->
  **info**. Reuses the same persisted force-state the Phase 66 deriver reads
  — no new tracking. The force-upgradable auto-update is TAKEN automatically —
  no `(skipped) {no longer installable}` for the unsupported-component case.
- **D-69-02 (SEV-04):** Thread the EXISTING invocation-shape signal the update
  orchestrator already has (specific `<plugin>@<marketplace>` ref = targeted;
  none = bulk/all) into the row severity stamp: targeted + declined
  force-upgradable -> **warning**; bulk + skipped force-upgradable -> **info**.
  No new detection; no inference from cascade shape.
- **D-69-03 (SEV-02):** Branch the no-`--force` install error on the THREE-WAY
  resolver state (Phase 64 discriminant): `unsupported` arm -> error message
  appends a `--force` hint; `unavailable` arm -> plain structural error with NO
  `--force` suggestion. Exact byte wording reconciled in Phase 70; the
  conditioning logic + a clear hint land here. (Completes the Phase 65 D-65-01
  deferral.)
- **D-69-04 (SEV-05):** Route `installed` / `force-installed` /
  `force-upgradable` rows through the SAME reason-composition seam other rows
  use (the Phase 64 render-time marker family `narrowUnsupportedKinds` + the
  existing brace composer), so a factual `{reasons}` brace renders whenever
  reasons are present. No new per-state mechanism. Rows without reasons stay
  brace-less (byte-identical to today).
- **SEV-01:** direct `install --force` / `update --force` degrade -> **info**
  (no `Warning:`); `reinstall` manual-recovery + missing soft-dep companion on
  an otherwise-successful install -> **warning**.

### Claude's Discretion
- Where exactly the targeted/bulk flag and the prior-compatibility lookup are
  threaded in the update orchestrator — left to planning, provided behavior
  matches D-69-01..04.
- Exact byte wording of the SEV-02 `--force` hint and all severity-affected row
  text is reconciled against the catalog in Phase 70; this phase implements the
  severity stamping + conditioning and updates tests/catalog to keep
  `npm run check` green.

### Deferred Ideas (OUT OF SCOPE)
- Byte-exact wording of the SEV-02 `--force` hint and all severity row text,
  plus the final PRD §11 reconcile and dropped-scope removal — **Phase 70**.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEV-01 | Direct force degrade -> info; reinstall manual-recovery + missing soft-dep companion -> warning | Force-degrade `info` stamps ALREADY LIVE (`install.ts:1412`, `update.ts:1590`); reinstall manual-recovery `warning` ALREADY LIVE (`reinstall.ts:389`). NEW: missing-companion warning needs a `softDepStatus(pi)` probe at the install stamp site. |
| SEV-02 | Install unsupported w/o --force -> error + `--force` hint; install unavailable -> error, no hint | Requires threading three-way `r.state` into `PluginShapeError` (`requireInstallable` throws `not-installable` losing the unsupported/unavailable distinction). Branch in `classifyEntityShapeError` + `composeInstallFailureMessage`. Byte-visible hint text lands now. |
| SEV-03 | Autoupdate of force-upgradable taken automatically (no skip); warning if newly degrades, info if already degraded | `cascadeAutoupdates` (`marketplace/update.ts:475`) must pass force; prior state read from persisted `compatibility.unsupported`; also stamp Phase 68 backfill force-installed rows (`reconcile/notify.ts:524`). |
| SEV-04 | Targeted update declining force-upgradable -> warning; bulk skip -> info | Thread `cardinality`/`opts.target.kind` (`update.ts:272`) into the skipped-row severity at `update.ts:1639` (currently `skipSeverity` always returns `warning` for `no longer installable`). |
| SEV-05 | Every row carries factual `{reasons}` brace when reasons present (installed/force-installed/force-upgradable) | Render seam ALREADY routes all three through `composeReasons`. Gap is producer-side: Phase 68 backfill force-installed row passes `reasons: []` (`reconcile/notify.ts:523`) — thread re-resolved unsupported kinds through `PluginBackfilledOutcome`. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Severity reduction + render | `shared/notify.ts` (notification core) | — | `cascadeSeverity`/`composeReasons` own the MAX-reduce and brace composition; this phase does NOT change them. |
| SEV-01 stamp | `orchestrators/plugin/install.ts`, `reinstall.ts`, `update.ts` | `platform/pi-api.ts::softDepStatus` | Producers stamp `severity`; missing-companion warning needs the soft-dep probe. |
| SEV-02 conditioning | `domain/resolver.ts` (throw site) + `orchestrators/plugin/install.ts` (catch/compose) | `shared/errors.ts` (PluginShapeError shape) | The three-way state lives in the resolver; the error shape must carry it to the catch site. |
| SEV-03 conditioning | `orchestrators/marketplace/update.ts` (autoupdate cascade) + `orchestrators/plugin/update.ts` | `persistence/state-io.ts` (compatibility record) | Autoupdate is a marketplace-update cascade; prior state is persisted per-plugin. |
| SEV-03 backfill stamp | `orchestrators/reconcile/notify.ts` + `apply-outcomes.ts` | `reconcile/apply.ts` (re-resolve) | Phase 68 backfill rows emit through reconcile notify. |
| SEV-04 conditioning | `orchestrators/plugin/update.ts` | `shared/notify-reasons.ts::skipSeverity` | Invocation cardinality is held by the update entrypoint. |
| SEV-05 producer threading | `orchestrators/reconcile/apply-outcomes.ts` + `notify.ts` | `shared/probe-classifiers.ts::narrowUnsupportedKinds` | Reasons must be populated by producers; the render seam already composes them. |

## Standard Stack

No new packages. This is an internal edit to an existing TypeScript codebase.
All tooling carries forward from the project (Node `node:test`, typebox,
ESLint 10 flat config, Prettier). No `## Package Legitimacy Audit` needed —
zero external packages installed.

## Architecture Patterns

### The severity model (DO NOT CHANGE — stamp into it)

```
Producer (orchestrator)  --stamps-->  row.severity?: "info"|"warning"|"error"
                                              |
                                  cascadeSeverity() MAX-reduce
                                  (shared/notify.ts:2184-2205)
                                              |
                          rank 0 -> undefined (info, no 2nd arg)
                          rank 1 -> "warning"      rank 2 -> "error"
                                              |
                                   ctx.ui.notify(body, severity?)
```

Key facts (all `shared/notify.ts`):
- `Severity = "info" | "warning" | "error"` (line ~500).
- `MessageBase.severity?` (line ~525); `TransitionMessageBase` REDECLARES it
  REQUIRED (line ~542). `PluginFailedMessage.severity` and `MpFailed.severity`
  are narrowed to REQUIRED `"error" | "warning"` (lines ~752, ~929) — a failed
  row cannot stamp `info`.
- `SEVERITY_RANK = { info: 0, warning: 1, error: 2 }` (line 2165).
- `cascadeSeverity` reads ONLY the stamped field — absent defaults to `info`
  (rank 0). No `status`/`reasons` content inference (lines 2184-2205).

### The reasons-brace composer (SEV-05 seam — already wired)

`composeReasons(reasons, declaresAgents, declaresMcp, probe)` (line 1750):
returns `""` for empty, else `{r1, r2, ...}`. Soft-dep markers
(`requires pi-subagents` / `requires pi-mcp`) append AFTER the typed reasons in
the SAME brace (MSG-GR-4). The three target rows are ALREADY routed through it:
- `installed` arm: `renderPluginRow` case `"installed"` (line 1940) threads
  `p.reasons` (optional, supports `orphan rewake`).
- `force-installed` arm: `forceInstalledRow` (line 1850) threads `p.reasons` +
  optional `dependencies`.
- `force-upgradable` arm: `pluginRow(ICON_INSTALLED, p, ..., "(force-upgradable)")`
  (line 2015) threads required `p.reasons`.

`narrowUnsupportedKinds(unsupported: string[])` (`probe-classifiers.ts:146`)
maps the resolver's typed `unsupported[]` component-kind list to closed-set
reasons (`lspServers` -> `lsp`; else `unsupported source`; first-wins dedup).
This is the SOLE shared per-kind marker helper used by `list`, `info`, and the
install/update success rows.

### Anti-Patterns to Avoid
- **Re-deriving severity from content in `notify.ts`.** The model is
  caller-stamped. Never add `status`-based inference to `cascadeSeverity`.
- **Inventing a new reasons mechanism for SEV-05.** D-69-04 mandates reuse of
  `composeReasons` + `narrowUnsupportedKinds`. The render seam already calls
  them; only producer-side `reasons[]` population is missing.
- **Substring-matching error `.message` for SEV-02.** Dispatch on the typed
  `PluginShapeError.shape` discriminant (the codebase already does this in
  `classifyEntityShapeError`).
- **GSD references in comments/titles.** Per `.claude/rules/typescript-comments.md`,
  use ID anchors (`SEV-03`, `D-69-01`) only — never `Phase 69`/`Plan NN`.

## Per-SEV Stamp-Site Findings

### SEV-01 — direct force degrade -> info; reinstall manual-recovery + missing companion -> warning

| Sub-clause | Stamp site | Conditioning signal | Status | Byte impact |
|-----------|-----------|---------------------|--------|-------------|
| `install --force` degrade -> info | `install.ts:1404-1424` (`installedRow` force-installed arm stamps `severity: "info"`) | `installCtx.resolved.state === "unsupported"` | **ALREADY LIVE** | none (verify-only) |
| `update --force` degrade -> info | `update.ts:1582-1592` (force-installed arm stamps `severity: "info"`) | `outcome.unsupportedKinds.length > 0` | **ALREADY LIVE** | none (verify-only) |
| reinstall manual-recovery -> warning | `reinstall.ts:389` (`severity: "warning"` on `manual recovery` row) | `findManualRecoveryError(err) !== undefined` | **ALREADY LIVE** | none (verify-only) |
| missing soft-dep companion on success -> warning | `install.ts` success arm (~1404-1424), both `installed` and `force-installed` branches | **NEW** — needs `softDepStatus(pi)` probe at stamp time | **NEW WORK** | metadata-only (no row bytes; `expectedSeverity` + possible bulk summary line) |

**Key SEV-01 finding (missing-companion warning):** the success row stamps
`severity: "info"` unconditionally today. The soft-dep MARKER (`{requires
pi-subagents}`) is a render-time concern (`composeReasons` + the single
`softDepStatus(pi)` probe at `notify()` entry), NOT visible to the orchestrator
at stamp time. To raise severity to `warning` when a DECLARED companion is
unloaded, the orchestrator must call `softDepStatus(pi)` itself
(`platform/pi-api.ts:121`, exported, `pi` is in scope at the install site) and
compare against the plugin's declared `dependencies` (`stagedAgentNames`/
`stagedMcpServerNames`). Stamp `warning` iff a declared dependency's companion
is absent from the probe; else `info`. This applies to BOTH the `installed` and
`force-installed` success arms.

> CONFIRM during planning whether SEV-01's "missing soft-dep companion" clause
> is scoped to `install` only or also `update`/`reinstall` success rows. The
> requirement text says "an otherwise-successful install"; recommend scoping to
> the install success arm (both clean + force) and the update success arm by
> symmetry, but flag for the planner. `[ASSUMED]`

### SEV-02 — unsupported install error gets `--force` hint; unavailable does not

**The blocking structural fact:** `requireInstallable(r, "install")`
(`resolver.ts:1084`) throws `PluginShapeError({ kind: "not-installable",
reasons: r.notes })` for BOTH `r.state === "unsupported"` AND `r.state ===
"unavailable"` — the three-way distinction is LOST at the throw. The catch site
`classifyEntityShapeError` (`install.ts:1616`) maps `not-installable` /
`no-longer-installable` to a single `status: "unavailable"` row
(`composeInstallFailureMessage` branch 3, `install.ts:1540-1549`).

**Required wiring (the seam D-69-03 names):**
1. Carry the three-way state on the thrown error. Add a discriminant field to
   the `not-installable` / `no-longer-installable` variants of
   `PluginShapeErrorShape` (`shared/errors.ts:404-416`) — e.g.
   `forceable: boolean` set to `r.state === "unsupported"`. `requireInstallable`
   sets it from `r.state`. (`buildPluginShapeMessage` byte form stays unchanged
   to preserve existing `.message.includes("is not installable")` assertions —
   the `--force` hint is added at the RENDER row, not the Error message.)
2. Branch at the renderer composition. In `classifyEntityShapeError` /
   `composeInstallFailureMessage`, when `forceable === true` append the
   `--force` hint to the rendered row (a new reasons token or trailer line);
   when `false`, emit the plain structural error with no hint.
3. Severity stays `error` for both arms (the row is `(unavailable)` /
   `(failed)` today, both already stamp/compute error).

**Byte impact:** BYTE-VISIBLE. The `--force` hint is new visible text. Current
no-force unsupported install renders `⊘ helper (unavailable) {unsupported
hooks, lsp}` (catalog `failure-unsupported-features`, `output-catalog.md:426`).
The exact hint wording is Phase 70's; this phase lands a clear placeholder hint
AND updates the catalog block + the catalog-uat fixture in lockstep. The
`unavailable` (structural) arm stays byte-identical to today.

> DECISION FOR PLANNING: where does the hint render — as a closed-set REASONS
> member (would require adding to the `REASONS` tuple, which is catalog-stable
> and order-frozen — heavier), or as a trailer line below the row (lighter,
> mirrors the cause-chain trailer)? Recommend a trailer line to avoid touching
> the frozen `REASONS` tuple; confirm against Phase 70's intended final form.
> `[ASSUMED]`

### SEV-03 — autoupdate of force-upgradable taken automatically; warning if newly degrades, info if already degraded

**Two distinct surfaces emit force-upgradable auto-update rows:**

**(a) Marketplace autoupdate cascade** — `cascadeAutoupdates`
(`marketplace/update.ts:475-527`) loops the autoupdate-enabled marketplace's
plugins calling `pluginUpdate(plugin, name, scope)` (injected
`updateSinglePlugin`). Today it passes NO force, so a candidate that degrades
throws `no-longer-installable` and becomes `(skipped) {no longer installable}`
(`update.ts:757-765` + cascade mapper `update.ts:1621-1644`). D-69-01 requires
this path to TAKE the force path automatically (so the row becomes
`(force-installed) {reasons}`, not a skip). Wiring:
- Thread a force-equivalent into the autoupdate cascade call so the candidate
  resolves via `requireForceInstallable` (`update.ts:743`) instead of
  `requireInstallable`. (`updateSinglePlugin`'s `force` already exists as the
  FORCE-02 opt-in at `update.ts:620`/`743`; the autoupdate cascade just never
  sets it.)
- BEFORE applying, read the persisted `compatibility.unsupported` for that
  plugin from the state record (`state-io.ts:57-62`,
  `PLUGIN_INSTALL_RECORD_SCHEMA.compatibility.unsupported: string[]`). Empty ->
  previously clean -> NEWLY degraded -> stamp **warning**; non-empty -> already
  force-installed -> stamp **info**. (`compatibility.installable === false` is
  the equivalent Phase 66 force-installed predicate, used at
  `reconcile/apply.ts:911`.)

**(b) Phase 68 load-time backfill** — `reconcile/notify.ts:498-527` (case
`"plugin-backfilled"`). The partial-backfill force-installed row currently
stamps `severity: "info"` with `reasons: []`. Per D-68-04 this is the deferred
SEV work. A backfill PROMOTION (re-materializing now-supported components) is
desired-state and benign -> **info** is correct here (it is not a NEW
degradation; the plugin was already force-installed). Verify info is right; the
SEV-05 reasons gap (below) is the real change on this row.

**Byte impact:** Surface (a) is BYTE-VISIBLE — the autoupdate row flips from
`(skipped) {no longer installable}` to `(force-installed) {<dropped kinds>}`,
plus the bulk summary-line tally shifts a skip->force-installed. New catalog
states + catalog-uat fixtures required. Surface (b) gains a `{reasons}` brace
(see SEV-05); otherwise severity stays info.

> CONFIRM the autoupdate cascade actually runs plugin updates in this build
> (it does, via `cascadeAutoupdates` when `snapshot.autoupdate === true` and a
> `pluginUpdate` fn is injected at `marketplace/update.ts:853`). The "newly
> degrades" warning only fires here, not in the `install --force`/manual
> `update --force` paths (those are explicit opt-ins -> info per SEV-01).

### SEV-04 — targeted decline -> warning; bulk skip -> info

The MANUAL `update <plugin>` path (no `--force`) declining a force-upgradable
candidate renders `(skipped) {no longer installable}`. The skip severity is
computed at `update.ts:1639-1642`:
```
severity:
  reasons.includes("not installed") || reasons.includes("not found")
    ? "error"
    : skipSeverity(reasons),
```
`skipSeverity` (`notify-reasons.ts:51`) returns `warning` for any
non-idempotent reason — so `no longer installable` is ALWAYS `warning` today.
D-69-02 requires: targeted (specific `<plugin>@<marketplace>`) -> warning;
bulk/all -> info.

**The signal already exists:** `cardinality` at `update.ts:272`:
`opts.target.kind === "plugin" ? "single" : "plural"`. Thread this (or
`opts.target.kind`) into `outcomeToCascadePluginMessage`
(`update.ts:1563`, currently takes only `target, outcome`) so the skipped arm
can stamp `info` for the bulk case when the reason is `no longer installable`.

**Byte impact:** Metadata-only for a single-target update (no tally renders for
`single` cardinality). For the BULK path, flipping a skip from warning->info
changes the summary-line "N skipped" tally bytes (`countSkippedOperations` /
`countRowsBySeverity` count by stamped severity, `notify.ts:2281-2289`). So the
bulk catalog states + catalog-uat fixtures (and their `expectedSeverity`)
update. The per-row `(skipped) {no longer installable}` bytes are unchanged.

> Scope check: SEV-04 is the NON-force decline. SEV-03 changes the AUTOUPDATE
> path to take force (so it no longer skips). A manual `update --force` TAKES
> the upgrade (force-installed, info, SEV-01). The three paths are distinct;
> ensure the targeted/bulk conditioning is applied only to the `no longer
> installable` decline, not to genuine `not installed`/`not found` errors
> (those stay `error` per the existing branch).

### SEV-05 — factual `{reasons}` brace on installed / force-installed / force-upgradable

**Render seam: ALREADY COMPLETE.** All three arms call `composeReasons`
(installed line 1940, force-installed via `forceInstalledRow` line 1850,
force-upgradable via `pluginRow` line 2015). A brace renders iff reasons are
present; empty reasons -> no brace (byte-identical to today).

**Producer gap (the only real SEV-05 work):** the Phase 68 backfill
force-installed row passes `reasons: []` (`reconcile/notify.ts:523`) because
`PluginBackfilledOutcome` (`apply-outcomes.ts:108-113`) does not carry the
re-resolved unsupported kinds. To make the factual brace render, thread the
re-resolved `unsupported[]` from the backfill re-resolve
(`reconcile/apply.ts:984+`, "re-resolve one force-installed plugin offline")
through `PluginBackfilledOutcome` into `narrowUnsupportedKinds(...)` at
`reconcile/notify.ts:517-526`.

Other surfaces already populate reasons correctly: `install.ts:1411`
(`narrowUnsupportedKinds(installCtx.resolved.unsupported)`), `update.ts:1589`
(`narrowUnsupportedKinds(outcome.unsupportedKinds)`), and the
list/info inventory rows (Phase 66). The clean `installed` row's optional
reasons (`orphan rewake`) already work.

**Byte impact:** The backfill force-installed row gains a `{<dropped kinds>}`
brace where it previously rendered bare. New/updated reconcile catalog state +
catalog-uat fixture. All other rows byte-identical.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Severity reduction | A new severity computation | `cascadeSeverity` (the existing MAX-reduce) | Already gated by catalog-uat; re-deriving breaks the caller-stamped invariant. |
| Reasons brace | Per-state brace formatting | `composeReasons` (line 1750) | Single canonical composer; handles soft-dep marker append + empty-collapse. |
| Per-kind unsupported markers | A new unsupported->reason map | `narrowUnsupportedKinds` (`probe-classifiers.ts:146`) | Sole shared helper; guarantees cross-surface byte parity (list/info/install). |
| Error classification | `.message` substring parse | `PluginShapeError.shape` discriminant | Typed throw shapes already carry the classification; substring parsing is the retired path. |
| Soft-dep probe | A new companion-loaded check | `softDepStatus(pi)` (`pi-api.ts:121`) | The single sanctioned probe the renderer also uses. |
| Idempotent/benign skip judgment | A new benign-reason set | `skipSeverity` (`notify-reasons.ts:51`) | Producer-local desired-vs-actual judgment already exists. |

## Common Pitfalls

### Pitfall: assuming a severity stamp is invisible to the byte contract
**What goes wrong:** Treating "severity is metadata" as "no byte change."
**Why:** The catalog cascade BODY is PREFIXED with a summary line
(`"N plugin operation(s) ... failed|skipped."`) whenever `computeSeverity`
returns warning/error, and the tally counts rows BY stamped severity
(`countRowsBySeverity`, `notify.ts:2281`). Flipping one bulk-cascade row from
info->warning changes the summary-line bytes. The catalog-uat fixture carries
`expectedSeverity` AND the catalog block must carry the matching prefix
(catalog-uat.test.ts:218-240).
**How to avoid:** For every severity flip, check: (1) does the surface render a
summary line (plural cardinality / cascade)? (2) update the catalog block +
fixture `expectedSeverity` together. Single-target surfaces (`single`
cardinality) emit no tally — only the `ctx.ui.notify` 2nd-arg changes, asserted
via `expectedSeverity`.

### Pitfall: SEV-02 distinction silently collapsing at the throw
**What goes wrong:** Adding the hint at the catch site without threading
`r.state` — both unsupported and unavailable reach the catch as
`not-installable`, so the hint appears on structural failures too (violates
D-69-03).
**How to avoid:** Carry the `forceable` discriminant on the thrown shape; assert
both arms in tests (a structural `unavailable` install MUST NOT show the hint).

### Pitfall: changing `buildPluginShapeMessage` bytes
**What goes wrong:** Putting the `--force` hint in the Error `.message` breaks
existing `err.message.includes("is not installable")` / regex assertions and
the orchestrated-mode `cause` string contract.
**How to avoid:** Add the hint at the RENDERED ROW (trailer/reason), keep the
`PluginShapeError.message` byte form frozen.

### Pitfall: catalog/fixture lockstep (the RED-window trap)
**What goes wrong:** Committing a renderer/severity change separately from the
catalog block or fixtures leaves the byte-equality gate (`catalog-uat.test.ts`)
RED between commits.
**How to avoid:** Land each byte-visible SEV item (SEV-02 hint, SEV-03
autoupdate-takes-force, SEV-05 backfill brace) with its `docs/output-catalog.md`
block AND its `tests/architecture/catalog-uat.test.ts` fixture in ONE commit
(the repo's documented atomic-supersession discipline).

## Runtime State Inventory

This phase is code/config only (severity stamps + conditioning logic + tests +
catalog docs). It does NOT rename, migrate, or restamp persisted data.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | SEV-03 READS persisted `compatibility.unsupported` (`state-io.ts:57-62`) for prior-state comparison. No WRITE/migration — the field already exists and is populated by install/update. | none (read-only consumption) |
| Live service config | None — verified by scanning orchestrators; no external service holds severity. | none |
| OS-registered state | None — verified; no OS registration involved. | none |
| Secrets/env vars | None — verified. | none |
| Build artifacts | None — no package rename; no egg-info/compiled-name analog. | none |

**The canonical question:** after the source edits, no runtime system holds a
stale severity — severity is computed fresh per notification from caller stamps.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node `node:test` | test suite (`npm test`) | ✓ | bundled (Node >=20.19) | — |
| typecheck/lint/format | `npm run check` | ✓ | project devDeps | — |

No external services or new CLIs. The phase is self-contained in the repo.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (Node built-in) |
| Config file | none — globs in `package.json` |
| Quick run command | `node --test "tests/architecture/catalog-uat.test.ts"` |
| Full suite command | `npm run check` (typecheck + eslint + prettier + `npm test` + integration) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEV-01 | force degrade info; missing-companion warning | unit (catalog-uat `expectedSeverity` + per-surface notify tests) | `node --test "tests/architecture/catalog-uat.test.ts"` | ✅ (extend fixtures) |
| SEV-02 | `--force` hint on unsupported, none on unavailable | unit (catalog byte block + resolver/install error tests) | `node --test "tests/architecture/catalog-uat.test.ts" "tests/orchestrators/**/install*.test.ts"` | ✅ (add states) |
| SEV-03 | autoupdate takes force; warning newly-degrades / info already-degraded | unit (catalog cascade + marketplace/update + reconcile tests) | `node --test "tests/orchestrators/**/*update*.test.ts" "tests/architecture/catalog-uat.test.ts"` | ✅ (add states) |
| SEV-04 | targeted warning / bulk info skip | unit (update cascade severity test + catalog-uat) | `node --test "tests/orchestrators/**/*update*.test.ts"` | ✅ (extend) |
| SEV-05 | factual reasons brace on backfill force-installed row | unit (reconcile notify + catalog-uat) | `node --test "tests/orchestrators/reconcile/**/*.test.ts"` | ✅ (extend) |

### Sampling Rate
- **Per task commit:** `node --test "tests/architecture/catalog-uat.test.ts"`
  plus the touched orchestrator's test file.
- **Per wave merge:** `npm test`.
- **Phase gate:** `npm run check` green before `/gsd-verify-work`.

### How severity is observable in tests
The catalog-uat runner (`tests/architecture/catalog-uat.test.ts`) asserts BOTH
the rendered byte block (from `docs/output-catalog.md`) AND the Pi-API severity
2nd-arg via the per-fixture `expectedSeverity?: "warning" | "error"` field
(line 202). Info severity = field OMITTED (no 2nd arg, no summary-line prefix).
So a metadata-only severity flip IS directly assertable even when row bytes do
not change — set/clear `expectedSeverity` on the fixture and (for cascades)
update the catalog body's summary-line prefix.

### Wave 0 Gaps
- None — existing test infrastructure (`catalog-uat.test.ts`,
  `tests/shared/notify-v2.test.ts`, per-orchestrator suites under
  `tests/orchestrators/`) covers all five SEV requirements. New `(section,
  state)` catalog fixtures are added in-place, not net-new files.

### Known pre-existing flake (warn the planner)
A tmpdir `ENOTEMPTY` flake affects `autoupdate` / `update` / `hooks-exec`
integration tests under PARALLEL runs ONLY (concurrent `rmSync`/tmpdir cleanup
races; files include `tests/transaction/with-state-guard.test.ts`,
`tests/integration/load-reconcile-race.test.ts`,
`tests/integration/concurrent-install.test.ts`). It is NOT a regression. If it
surfaces, re-run serially (`TEST_CONCURRENCY=1 npm test`) to confirm green
before attributing any failure to this phase's edits.

## Security Domain

`security_enforcement` is not set in project config; this phase is pure
internal notification-severity wiring with no new external input, no new
network surface (NFR-5 unchanged), no new file writes (NFR-1/NFR-10 unchanged),
and no auth/session/crypto. ASVS V5 (input validation) is N/A — the only new
read is the already-validated persisted `compatibility.unsupported` field
(typebox-checked at load via `PLUGIN_INSTALL_RECORD_SCHEMA`). No applicable
threat patterns introduced.

## Project Constraints (from CLAUDE.md)

- **Output channel (IL-2):** All user-visible messages MUST go through
  `ctx.ui.notify` via `shared/notify.ts`. The `--force` hint (SEV-02) MUST be
  composed into the notification row, never written to stdout/stderr.
- **No new telemetry (IL-4) / i18n (IL-1):** none introduced.
- **`npm run check` green (NFR-6):** the byte-exact catalog-uat gate is part of
  `check`; all five SEV edits must keep it green.
- **Comment/test-title policy (`.claude/rules/typescript-comments.md`):** use
  `SEV-NN` / `D-69-NN` / `NFR-N` anchors; NEVER `Phase 69`/`Plan NN`/`Wave N`.
- **Conventional Commits, ASCII-only commit messages, branch policy
  (`features/*`), `pre-commit run` before commit, `SKIP=trufflehog` only inside
  worktrees.** (No em dashes in commit messages — the fix-unicode-dashes hook
  rejects them.)
- **TypeScript strict; discriminated unions stay exhaustive** (`assertNever`
  tails in the renderer switches must remain total).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Content-inferred severity ladder | Caller-stamped per-row `severity` + MAX-reduce | notification-refactor workstream (pre-Phase 64) | This phase STAMPS values; never re-derives. |
| Binary `installable: true\|false` | Three-way `installable`/`unsupported`/`unavailable` | Phase 64 | SEV-02 conditions on the three-way state (must be threaded through the throw). |
| `(skipped) {no longer installable}` for degrading autoupdate | Autoupdate TAKES the force path | THIS phase (SEV-03/D-69-01) | Byte-visible flip to `(force-installed)`. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | SEV-01 missing-companion warning applies to install success arm (clean + force) and by symmetry update success; not reinstall | SEV-01 | Mis-scoped severity flip; extra/missing `expectedSeverity` fixtures |
| A2 | The `--force` hint should render as a trailer line, not a new `REASONS` tuple member | SEV-02 | If Phase 70 wants a closed-set reason, the tuple (catalog-stable/order-frozen) must change — heavier edit |
| A3 | Backfill PROMOTION (Phase 68 force-installed row) is benign -> stays `info`; only gains the reasons brace | SEV-03/SEV-05 | If it should be warning, the reconcile catalog summary-line tally also shifts |
| A4 | The autoupdate cascade is the sole surface where SEV-03 "newly degrades" warning fires | SEV-03 | If another auto-update entrypoint exists, a stamp site is missed |

## Open Questions

1. **Exact `--force` hint surface (reason token vs trailer line).**
   - What we know: D-69-03 defers byte wording to Phase 70 but lands a clear
     hint + conditioning now. The renderer supports both a closed-set reason
     brace and a 4-space trailer line.
   - What's unclear: which form Phase 70 will freeze.
   - Recommendation: trailer line (avoids mutating the frozen `REASONS` tuple);
     confirm with the planner/discuss-phase.

2. **SEV-01 missing-companion scope (install only vs install+update).**
   - What we know: requirement text says "an otherwise-successful install."
   - Recommendation: scope to install success (clean + force) + update success
     by symmetry; flag as `[ASSUMED]` for user confirmation.

3. **Whether the Phase 68 backfill force-installed row should be info or warning.**
   - What we know: it is a benign promotion (re-materializing now-supported
     components), not a new degradation; D-69-01's warning is specifically for
     NEWLY-degrading auto-updates.
   - Recommendation: keep `info`, add only the reasons brace (SEV-05); confirm.

## Sources

### Primary (HIGH confidence)
- `extensions/pi-claude-marketplace/shared/notify.ts` — `Severity`,
  `MessageBase`/`TransitionMessageBase`, `cascadeSeverity`/`computeSeverity`
  (2184-2252), `composeReasons` (1750), `forceInstalledRow`/`pluginRow`/
  `installedLikeRow` (1813-1923), `renderPluginRow` (1925+),
  `countRowsBySeverity`/summary counts (2270-2289).
- `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` —
  `narrowUnsupportedKinds` (146-160).
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` — success
  arm + force-installed stamp (1390-1444), `requireInstallable`/
  `requireForceInstallable` gate selection (485-505), `composeInstallFailureMessage`
  (1484-1580), `classifyEntityShapeError` (1616-1665).
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` —
  `cardinality` (272), candidate force gate (733-766), cascade mapper +
  skipped-severity (1563-1644).
- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` —
  `cascadeAutoupdates` (475-527), injection seam (853).
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` —
  manual-recovery `warning` stamp (389).
- `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts` —
  `plugin-backfilled` arm (498-527); `apply-outcomes.ts` `PluginBackfilledOutcome`
  (108-113); `apply.ts` backfill scan/re-resolve (802-1003).
- `extensions/pi-claude-marketplace/domain/resolver.ts` — three-way schema
  (64-128), `requireInstallable`/`requireForceInstallable` (1084-1124).
- `extensions/pi-claude-marketplace/shared/errors.ts` —
  `PluginShapeErrorShape` (404-444), `buildPluginShapeMessage` (446-459).
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` — `skipSeverity`
  (51-57), idempotent reasons (30-40).
- `extensions/pi-claude-marketplace/persistence/state-io.ts` — `compatibility`
  record schema (54-73).
- `tests/architecture/catalog-uat.test.ts` — `expectedSeverity` mechanism
  (202, 218-240), force-installed/force-upgradable fixtures (647-691).
- `docs/output-catalog.md` — force-installed/force-upgradable + install force
  catalog states (333-422), failure-unsupported-features (424-430).

### Secondary (MEDIUM confidence)
- `.planning/phases/{64,65,66,68}-*/`*-CONTEXT.md — upstream force decisions.

## Metadata

**Confidence breakdown:**
- Stamp sites: HIGH — every site located with file:line and conditioning signal.
- Byte-impact analysis: HIGH — verified against the catalog-uat
  `expectedSeverity` + summary-line mechanism and existing catalog blocks.
- SEV-01 missing-companion scope + SEV-02 hint surface: MEDIUM — implementation
  choice deferred to planning/Phase 70 (logged as assumptions).

**Research date:** 2026-06-28
**Valid until:** ~2026-07-28 (internal codebase; stable until the files move).
