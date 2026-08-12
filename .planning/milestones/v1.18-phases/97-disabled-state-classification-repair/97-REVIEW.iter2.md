---
phase: 97-disabled-state-classification-repair
reviewed: 2026-08-09T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
  - extensions/pi-claude-marketplace/persistence/state-io.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - tests/orchestrators/edge-deps.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/info-manifest-absent.test.ts
  - tests/orchestrators/plugin/list.test.ts
  - tests/orchestrators/plugin/plugin-state-classifier.test.ts
  - tests/orchestrators/plugin/update.test.ts
  - tests/orchestrators/reconcile/backfill.test.ts
  - tests/orchestrators/reconcile/plan.test.ts
findings:
  critical: 2
  warning: 6
  info: 3
  total: 11
status: issues_found
---

# Phase 97: Code Review Report

**Reviewed:** 2026-08-09T00:00:00Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Phase 97 collapses four copies of the disabled-state predicate onto one
(`isRecordedButDisabled`, keyed on `enabled` alone), repairs disabled-partial
rendering on `list` / `info`, makes the enable branch partial-capable, guards the
load-time backfill scan against disabled records, and derives the availability
discriminant in `update`'s `refreshDisabledRecord`.

The predicate collapse itself is correct and well-gated: the truth-table test and
the enable-bucket counter-case in `tests/orchestrators/reconcile/plan.test.ts`
cover the four cells and the over-reach case, and `list` / `info` / the completion
bucketizer all consume the one definition.

Two defects remain in the newly-opened paths. ENBL-07 widened the enable ledger's
admission gate but did not widen the row it renders, so a degraded
re-materialization is reported to the user as a clean `(installed)` — the exact
class of divergence ENBL-06 was fixing on `list` / `info`, now reintroduced on the
enable verb, and pinned by the phase's own test. ENBL-09 corrected two of the
three fields `refreshDisabledRecord` writes but left `resolvedSha` stale beside a
sha-derived version bump, so a later `reinstall` pins the re-clone to the previous
commit while the record advertises the new one.

The remaining findings are drift risks the phase created or left open: a fifth
inline copy of the predicate introduced by ENBL-08 in `reconcile/apply.ts` that
the new drift gate structurally cannot see, and a set of enable-path affordance
gaps (no `--partial` hint, no completion entry, no soft-dep markers).

## Structural Findings (fallow)

None supplied for this review.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: A partial re-enable renders `(installed)` — the enable row was never widened alongside the gate

**Classification:** BLOCKER
**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:200`, `:207-233`, `:981-1001`, `:817-829`

**Issue:**
ENBL-07 widened the enable branch's ledger admission gate:

```ts
// enable-disable.ts:200
const partial = !installed.compatibility.installable;
```

so a disabled soft-degraded record now resolves through `requirePartialInstallable`
and re-materializes with one or more component kinds dropped. Nothing downstream
was widened to match:

- `runEnableBranch` (`:207-233`) discards `result.installCtx` entirely and returns
  `{ kind: "fresh", version: recordedVersion }`. The resolution's `state`
  (`installable` vs `partially-available`) is available on the returned
  `InstallLedgerResult` (`install.ts:499-501`) and is thrown away.
- `composeOutcomeRow`'s `fresh` arm (`:991-1001`) hard-codes
  `status: "installed"` + `severity: "info"` for every enable.
- The orchestrated arm (`:817-829`) hard-codes `status: "enabled"`, so the
  reconcile row (`reconcile/apply.ts:679-687`, `buildSuccess` →
  `plugin-enabled`) is equally clean.

`installPlugin` does the opposite for the same ledger outcome
(`install.ts:1818-1828`): `installCtx.resolved.state === "partially-available"`
selects `status: "partially-installed"` with
`narrowUnsupportedKinds(...)` reasons, per FSTAT-07 / D-66-04. The record the
enable writes carries `installable: false` + a non-empty `unsupported` list
(`install.ts:1151-1154`), so the very next `list` renders
`(partially-installed) {lsp}` for the plugin the enable just called `(installed)`.
`docs/output-catalog.md` (the `/claude:plugin enable` section, around line 2110)
documents only the `(installed)` fresh-enable state — no partial state exists for
this verb.

The severity stamp is wrong for the same reason: the notification tri-state treats
`info` as "desired state reached" and `warning` as "carried out but short", and a
dropped-component enable is the second case (`install.ts` routes it through
`companionSeverity` / the WARN-01 raise; enable does not).

`tests/orchestrators/plugin/enable-disable.test.ts:587-591` pins the wrong byte
form (`/foo-plugin v1\.2\.3 \(installed\)/`) against a fixture that deliberately
resolves `partially-available` (a `.lsp.json` at the plugin root, seeded at
`:202-206`), so the defect is currently test-locked and will not self-correct.

**Fix:** thread the resolved state out of the ledger and branch the fresh-enable
row the same way `install.ts` does.

```ts
// runEnableBranch
const result = await runInstallLedger(state, locations, { ... , partial }, capture);
if (result.kind === "marketplace-absent") { /* unchanged */ }

return {
  kind: "fresh",
  version: recordedVersion,
  degradedKinds:
    result.installCtx.resolved.state === "partially-available"
      ? [...result.installCtx.resolved.unsupported]
      : [],
};

// composeOutcomeRow, enable arm
return degradedKinds.length > 0
  ? {
      status: "partially-installed",
      name: plugin,
      dependencies: [],
      ...(outcome.version !== undefined && { version: outcome.version }),
      reasons: narrowUnsupportedKinds(degradedKinds),
      severity: "warning",
      needsReload: true,
    }
  : { status: "installed", /* unchanged */ };
```

Update `tests/orchestrators/plugin/enable-disable.test.ts:587-591` to assert the
degraded byte form, and add the matching `catalog-state` block to
`docs/output-catalog.md`'s enable section.

### CR-02: `refreshDisabledRecord` bumps a sha-derived `version` without refreshing `resolvedSha`

**Classification:** BLOCKER
**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1353-1385`

**Issue:**
For a git source, the update's `toVersion` is derived from the newly resolved
commit: `deriveUpdateToVersion` returns `shaVersion(resolvedSha)` when the source
is git-backed (`update.ts:867-873`), and `preflight.resolvedSha` carries that full
sha (`update.ts:1099-1120`, `PluginPreflight.resolvedSha` at `:732-740`).

`refreshDisabledRecord` destructures only `{ installable, toVersion }`
(`:1358`) and writes `version`, `resolvedSource` and `compatibility` — never
`resolvedSha`. Its sibling `finalizeUpdateRecord` does write it (`:1471-1473`).
So after `update` on a **disabled git-source** plugin the record holds:

- `version` = `sha-<12 hex of the NEW commit>`
- `resolvedSource` = the NEW clone root
- `resolvedSha` = the **OLD** commit

That is precisely the "two fields that contradict each other" shape ENBL-09's own
comment (`:1372-1376`) declares unacceptable, left in the same object literal.

The contradiction is not cosmetic. `reinstall` pins its re-clone to the recorded
sha (`reinstall.ts:1193` → `resolveInstallable({ recordedSha: oldSnapshot.resolvedSha })`,
consumed at `:1428-1432`) and keeps `version: oldRecord.version`
(`reinstall.ts:1655-1666`). A `reinstall` after this refresh therefore materializes
the **previous** commit's tree while the record continues to advertise the new
sha-version — a silent revert of the user's update with no row saying so.
`reinstall.ts:1661-1665` documents this exact invariant ("dropping it corrupts GC
key derivation and a later reinstall's pin"); `refreshDisabledRecord` breaks it.

**Fix:**

```ts
const { installable, toVersion, resolvedSha } = preflight;
...
    sRecord.version = toVersion;
    sRecord.resolvedSource = installable.pluginRoot;
    // PURL-09 / D-77-02: the pin and the sha-derived version must move together.
    if (resolvedSha !== undefined) {
      sRecord.resolvedSha = resolvedSha;
    }
```

Add a git-source case to the ENBL-09 suite in
`tests/orchestrators/plugin/update.test.ts` asserting
`shaVersion(rec.resolvedSha) === rec.version` after the refresh.

## Warnings

### WR-01: ENBL-08 introduced a fifth inline copy of the predicate the drift gate cannot see

**Classification:** WARNING
**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:1044`, `extensions/pi-claude-marketplace/persistence/state-io.ts:129-154`, `tests/orchestrators/reconcile/plan.test.ts:717-723`

**Issue:**
`state-io.ts:129-134` declares `isRecordedButDisabled` "the SOLE disabled-state
predicate … a module that re-derives the rule locally is a drift twin the gate in
`tests/orchestrators/reconcile/plan.test.ts` rejects." The ENBL-08 commit in this
same phase then wrote the rule inline:

```ts
// reconcile/apply.ts:1044
if (!record.enabled) {
  return false;
}
```

The gate enumerates exactly four paths (`plan.test.ts:718-723`:
`reconcile/plan.ts`, `plugin/update.ts`, `plugin/enable-disable.ts`,
`plugin/plugin-state-classifier.ts`) and its own comment claims it "can see a
FIFTH copy appearing elsewhere" — it cannot; it is an allowlist, not a repo scan.
`orchestrators/plugin-path.ts:39` carries the same inline form (pre-existing).
The doc claim in `state-io.ts` is therefore false as of this phase.

**Fix:** import the predicate in `apply.ts` and either broaden the gate or soften
the claim.

```ts
import { isRecordedButDisabled } from "../../persistence/state-io.ts";
...
if (isRecordedButDisabled(record)) {
  return false;
}
```

Then replace `FORMER_DEFINITION_SITES` with a walk of
`extensions/pi-claude-marketplace/**/*.ts` asserting that any file matching
`/!\s*\w+\.enabled\b/` (comments stripped) also imports the single predicate, so
a sixth copy fails the gate wherever it lands.

### WR-02: enable derives its partial gate from a persisted flag and gives no `--partial` affordance when that flag is stale

**Classification:** WARNING
**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:200`, `:1024-1037`

**Issue:**
`partial` is derived from `installed.compatibility.installable`, a value persisted
at install/update time. A record that was fully installable when disabled but
whose manifest entry has since gained an unsupported kind derives `partial = false`,
so `runInstallLedger` runs `requireInstallable`, which throws `PluginShapeError`.
`narrowEnableFailure` (`:1024-1037`) only recognises `ENOENT`, so the row renders
with an **empty reasons array** — a bare `⊘ <plugin> (failed)` plus a cause
trailer. `install` and `update` both surface the resolver's `partialable`
discriminant and append the `--partial` hint (`install.ts:1925-1932`,
`update.ts:1974-1981`); enable has no `--partial` flag and emits no hint, so the
user is told the enable failed and given nothing to act on. The only recovery
(`update --partial`, which rewrites `compatibility.installable` via
`refreshDisabledRecord`) is undiscoverable.

**Fix:** narrow the `PluginShapeError` in `narrowEnableFailure` the way
`composeUpdateDeclineRow` does, and render a hint pointing at
`update --partial` (or accept `--partial` on `enable` and widen the gate on
request rather than on the persisted flag).

### WR-03: the reconcile-driven enable opts into a degrading install with no user flag and no signal

**Classification:** WARNING
**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:200`, `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:797-801`

**Issue:**
`--partial` is documented as an explicit opt-in gate (D-65-03 / FORCE-05: "`--partial`
widens the gate … the default gate still blocks it"). After ENBL-07, the
load-time reconcile path reaches `setPluginEnabled({ notifications: { mode:
"orchestrated" } })` for every config-declared-enabled disabled record
(`apply.ts:797-801`), and `runEnableBranch` sets `partial: true` from the record
with no user involvement. Combined with CR-01 the reconcile row is
`plugin-enabled` with no degrade marker, so a `/reload` can drop component kinds
from a plugin with neither a command typed nor a row naming the drop. The
autoupdate cascade has a documented precedent for the automatic partial stance
(`update.ts:560-569`, D-69-01) — but that path renders `(partially-installed)`
with the dropped kinds. This path renders nothing.

**Fix:** fixing CR-01 covers the signalling half. Additionally record the
automatic-opt-in decision beside the derivation at `:193-200` with the D-69-01
precedent cited, so the departure from the FORCE-05 explicit-opt-in rule is
deliberate rather than incidental.

### WR-04: `update --partial` completion excludes the records for which it is the only remediation

**Classification:** WARNING
**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts:120-138`, `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1562`

**Issue:**
The classifier collapses every disabled record to `installed`, which by design
keeps it out of the `update --partial` candidate set
(`plugin-state-classifier.ts:29-33`, pinned by
`tests/orchestrators/edge-deps.test.ts:794`). But `update`'s disabled-record
short-circuit is only reachable **with** `--partial` when the candidate resolves
`partially-available` — the phase's own test header states this
(`tests/orchestrators/plugin/update.test.ts:2913-2919`) and pins it at `:3024`.
So refreshing a disabled partial's pin requires typing a command the completion
provider will never offer, and per WR-02 that same command is the prerequisite for
a successful `enable`.

**Fix:** either surface disabled records in the `--partial` completion bucket
(a distinct `disabled` classification consumed only by the completion path), or
make the disabled short-circuit reachable without `--partial` (it stages nothing,
so the strict-gate rationale does not apply to it) and document the choice at
`update.ts:1551-1562`.

### WR-05: `refreshDisabledRecord` rewrites the record unconditionally while rendering `(skipped) {up-to-date}`

**Classification:** WARNING
**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1370-1383`

**Issue:**
The function always writes `version`, `resolvedSource`, the whole `compatibility`
block and `updatedAt`, then the caller returns the `unchanged` outcome that renders
`⊘ <plugin> (skipped) {up-to-date}` (`update.ts:1562-1570`, byte-pinned at
`tests/orchestrators/plugin/update.test.ts:3054-3058`). Every repeated
`update --partial` on an already-current disabled record therefore rewrites
state.json — bumping mtime and `updatedAt` while telling the user nothing changed.
ENBL-09 widened the blast radius by adding the whole `compatibility` block to the
unconditional write. The idempotency test at `:3085-3149` acknowledges the drift
by explicitly excluding `updatedAt` from its comparison. The function's own doc
(`:1345-1351`) argues the config write-back is skipped precisely to avoid touching
mtime "without changing user-visible bytes" — the state write does not follow the
same rule.

**Fix:** compute the prospective values first and return without calling
`withStateGuard` when `version`, `resolvedSource` and every `compatibility` field
already match, mirroring the deep-equal short-circuit `maybeWritePluginConfigBack`
uses (`update.ts:1477-1486`).

### WR-06: the fresh-enable row hard-codes `dependencies: []`, suppressing the soft-dep markers and the SEV-01 severity raise

**Classification:** WARNING
**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:995`

**Issue:**
`composeOutcomeRow`'s enable arm emits `dependencies: []` unconditionally, so a
re-enable that stages agents or MCP servers never renders
`{requires pi-subagents}` / `{requires pi-mcp}` and never takes the SEV-01
info→warning raise `install.ts:1809-1817` applies for an unloaded companion. The
enable ledger stages exactly the same artifacts as the install ledger, so the
signal is equally relevant. The condition predates the phase, but ENBL-07 makes
enable the sanctioned re-materialization surface for degraded records, which are
the ones most likely to need the marker.

**Fix:** thread the staged-name counts out of `runInstallLedger`'s `installCtx`
(the same `stagedAgentNames` / `stagedMcpServerNames` `install.ts:1811-1815`
reads) and build `dependencies` + `severity` through `companionSeverity` rather
than pinning them.

## Info

### IN-01: retired `force-*` vocabulary survives in the touched test titles and comments

**Classification:** INFO
**File:** `tests/orchestrators/plugin/plugin-state-classifier.test.ts:168`, `:171`, `:178`, `:182`; `tests/orchestrators/edge-deps.test.ts:474`, `:481`, `:490`, `:509`

**Issue:** the classification names moved to `partially-installed*` /
`partially-upgradable`, but the titles and comments in these two files still say
`force-installed-upgradable`, `force-upgradable`, `force-installed` and
`update --force`. The title at
`plugin-state-classifier.test.ts:168` names `force-installed-upgradable` while the
body asserts `"partially-installed-upgradable"`, so a reader has to run the test
to learn what it checks. `tests/architecture/partial-vocabulary-guard.test.ts`
does not reserve these spellings, so nothing catches the drift.

**Fix:** rename to the current tokens in the same pass, and consider adding
`update --force` / `force-upgradable` / `force-installed` to the vocabulary guard's
reserved set.

### IN-02: the planner's disable-branch comment still describes the retired empty-resources marker

**Classification:** INFO
**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:305-313`

**Issue:** the phase corrected the file header (`:18-23`) and the enable-branch
comment (`:329-331`), but the disable branch still reads "the terminal state of a
successful disable is exactly `recorded with empty resources + config enabled:
false`". Emptied arrays are now explicitly documented as a *consequence* of
disabling, not the marker (`state-io.ts:146-149`), so this is the one surviving
statement of the retired rule in a file the phase edited.

**Fix:** restate as "recorded with `enabled: false` + config `enabled: false`".

### IN-03: the completion fixture seeds disabled records in a shape `DisabledPluginRecord` forbids

**Classification:** INFO
**File:** `tests/orchestrators/edge-deps.test.ts:437-447`

**Issue:** `layoutFixtureMarketplace` writes `skills: [`${p.name}-skill`]` for
every installed record and then sets `enabled: p.disabled !== true`, producing a
disabled record with a populated `resources.skills`. That combination is the exact
fourth quadrant `DisabledPluginRecord`'s empty-tuple typing was introduced to make
unrepresentable (`state-io.ts:85-109`); the typebox schema is permissive, so
`saveState` accepts it. The fixture still proves what it intends (the predicate
reads only `enabled`), but it is not a shape production can produce, which weakens
it as a regression pin for the bucketizer.

**Fix:** zero the `resources` arrays when `p.disabled === true`, matching
`toDisabledRecord`; the predicate assertions are unaffected and the fixture becomes
reachable state.

---

_Reviewed: 2026-08-09T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
