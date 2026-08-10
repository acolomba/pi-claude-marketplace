---
phase: 98-lifecycle-regression-and-contract-documentation
reviewed: 2026-08-10T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - docs/output-catalog.md
  - docs/prd/pi-claude-marketplace-prd.md
  - extensions/pi-claude-marketplace/edge/handlers/tools.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/README.md
  - extensions/pi-claude-marketplace/persistence/state-io.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/architecture/compat-01-no-expansion.test.ts
  - tests/architecture/no-orchestrator-network.test.ts
  - tests/helpers/source-scan.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/orchestrators/plugin/update.test.ts
  - tests/orchestrators/reconcile/notify.test.ts
findings:
  critical: 1
  warning: 8
  info: 0
  total: 9
status: issues_found
---

# Phase 98: Code Review Report

**Reviewed:** 2026-08-10T00:00:00Z
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Reviewed the phase-98 source diff (`97c8e956..HEAD`, commits with subject scope `(98)`) at standard depth: the four folded Phase-97 carriers (IN-07, WR-06, WR-02, WR-04), the COMPAT-01 no-expansion gate plus its extracted `source-scan.ts` mechanic, the LIFE-04/05/06 characterization suites, and the DOC-08 catalog/PRD sweep. Read the five plan SUMMARYs and 98-06-SUMMARY before classifying; the recorded deviations (plural-cardinality tally pins, the `not-installable` narrowing key, the per-surface SEV-01 asymmetry on the reconcile projection, the three documentation-only deferrals) are honoured below and are NOT reported as findings. SEV-03 and WARN-01 are not re-raised.

What the review found is concentrated in three places:

1. The WR-02 remediation trailer ships an instruction that fails when followed on the surface it was newly widened onto.
2. The WR-04 gate is materially broader than the rationale recorded for it and admits a consent-free degradation class that no test covers.
3. The IN-07 "asymmetry becomes a compile error" claim does not hold: the shared shape is intersected on only two of the three ledger-driven outcomes, and on the install side three of its five fields are never populated.

The gates themselves (COMPAT-01 enumeration equality, the persistence key-set pin, the delegation clause) are well-constructed; two mechanical weaknesses in the scanning clauses are noted below because the file's own header claims stronger assurance than the code provides.

No security defect, no path-containment gap, no state-write outside a guard, no nested lock, no new network surface, no closed-set expansion, and no forbidden `Phase NN` / `Pitfall N` comment token was found in the changed source.

## Critical Issues

### CR-01: The stale-gate enable failure tells the user to re-run a command with a flag that command rejects

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:3760-3762` (gate), `extensions/pi-claude-marketplace/shared/notify.ts:2478-2479` (literal), `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:1132-1138` (producer)
**Issue:** WR-02 widens the XSURF-03 trailer gate so a `failed` row stamping `partialHint` renders the frozen `PARTIAL_UPDATE_HINT_TRAILER`:

```text
  ⊘ foo-plugin v1.2.3 (failed) {lsp}
    Re-run with --partial to update with the supported components.
```

The only producer of that stamp is the ENABLE branch (`staleGateDropped`). `/claude:plugin enable` does not accept `--partial`: `edge/handlers/plugin/enable-disable.ts:26-29` declares `Usage: /claude:plugin enable <plugin>@<marketplace> [--scope user|project] [--local]`, and the parse path is `extractLocalFlag` + `parseRequiredPluginMarketplaceRef` (positional `ref` + `--scope` only), so an unrecognized long flag falls through to `notifyUsageError` with `Unknown flag: "--partial".` A user who follows the emitted instruction literally — "re-run" unambiguously names the command that just failed — gets a usage error, not a remedy.

The decision record (98-03-SUMMARY, key-decisions) justifies the reuse with "`update --partial` is the real remedy for a stale gate, so the update wording is truthful". That reasoning holds for the sentence's second half but not its first: on the XSURF-03 decline surface the failed command IS `update`, so "re-run" resolves correctly; on the enable surface it resolves to the wrong command. The catalog prose at `docs/output-catalog.md:2251` states the real remedy correctly ("`update --partial` re-pins the record"), which confirms the emitted bytes and the documented intent disagree.

Compounding it: per WR-04 (this same phase), the record in this scenario is disabled, so plain `update` alone now re-pins it — `--partial` is not even required. The instruction is wrong on both the command and the flag.

**Fix:** Either name the command in the trailer, or route the stale-gate row through a new enable-worded literal. The minimal change that keeps the byte contract explicit:

```ts
/**
 * WR-02 / D-98-03: the stale-gate enable-failure remediation. Distinct from
 * PARTIAL_UPDATE_HINT_TRAILER because the failed command is `enable`, which
 * accepts no --partial flag -- "re-run" would name the wrong command.
 */
const STALE_GATE_UPDATE_HINT_TRAILER =
  "Run update on this plugin to re-pin it, then enable it again.";

// composePluginLinesWith
if (p.status === "failed" && p.partialHint === true) {
  lines.push(`    ${STALE_GATE_UPDATE_HINT_TRAILER}`);
} else if (p.status === "partially-upgradable" && p.partialHint === true) {
  lines.push(`    ${PARTIAL_UPDATE_HINT_TRAILER}`);
}
```

This mints one literal (D-98-05 forbade minting a REASONS / STATUS_TOKENS / glyph member; a trailer literal is not a closed-set member and `PARTIAL_INSTALL_HINT_TRAILER` / `PARTIAL_UPDATE_HINT_TRAILER` already establish that two trailers coexist). It requires updating the `enable-failed-stale-gate` catalog fixture and the WR-02 test in the same change.

## Warnings

### WR-01: The WR-04 partial gate is broader than its rationale and admits a consent-free NEW degradation

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1085-1095`
**Issue:** The widened gate is

```ts
partial: args.partial === true || isRecordedButDisabled(record),
```

`isRecordedButDisabled` reads the `enabled: false` boolean and nothing else (ENBL-05). The rationale directly above it, and the whole WR-04 discussion in 98-03-SUMMARY, is about a **disabled PARTIAL** record: "Without this widening a disabled PARTIAL record is declined by the one command that can re-pin it against the current manifest entry." But the gate also admits a disabled record that is currently **CLEAN** (`compatibility.installable === true`) whose refreshed manifest entry has newly gained an unsupported kind. For that record:

- before: `resolveUpdateCandidate` ran the strict gate, threw `PluginShapeError`, and produced the `(partially-upgradable)` decline row with the `--partial` remediation trailer (XSURF-03) — the user was asked to consent;
- now: the candidate resolves, the D-UPD short-circuit runs `refreshDisabledRecord`, and `update.ts:1396-1401` writes `compatibility.installable = installable.state === "installable"` → `false` plus the non-empty `unsupported` list, with no flag typed and no row naming the new degradation (the row renders `(skipped) {up-to-date}`, see WR-02 below).

The consent hole closes only downstream and only partially: the next `enable` derives its gate from that record (`enable-disable.ts:245` `const partial = !installed.compatibility.installable`), takes the partial path automatically, and renders `(partially-installed)` with the dropped kinds. So the degradation IS eventually signalled — one command later, on a different verb, after the record has already been rewritten.

The same widening rides the bulk paths (`updatePlugins` marketplace/global targets and the autoupdate cascade all funnel through `preflightUpdate`), so an autoupdate cascade can flip a clean disabled record to degraded without a user command at all.

No test covers this case. `tests/orchestrators/plugin/update.test.ts` "WR-04: a targeted update with NO partial flag ..." seeds `makeDisabledPartialPluginRecord("1.0.0")` — a record that is ALREADY partial. The clean-disabled → newly-degrading transition is untested in both directions.

**Fix:** Narrow the gate to the record shape the rationale names, and keep the decline row for a clean disabled record:

```ts
partial: args.partial === true || isDisabledAndAlreadyDegraded(record),

/** WR-04 / D-98-04: only an ALREADY-degraded disabled record widens the gate --
 *  a clean disabled record whose candidate would NEWLY degrade keeps the
 *  XSURF-03 decline row, so the degrade still needs an explicit --partial. */
function isDisabledAndAlreadyDegraded(record: PluginRecord): boolean {
  return isRecordedButDisabled(record) && !record.compatibility.installable;
}
```

Add the missing case: clean + disabled + newly-degrading candidate → `(skipped) {…} ` decline row with the `--partial` trailer, and the record unchanged.

### WR-02: The disabled-record refresh renders `{up-to-date}` after rewriting version, source, sha and compatibility

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1581-1608`, catalog state `disabled-record-refresh` (`docs/output-catalog.md`), fixture in `tests/architecture/catalog-uat.test.ts`
**Issue:** The short-circuit calls `refreshDisabledRecord` (which writes `version`, `resolvedSource`, `resolvedSha`, the whole `compatibility` block and `updatedAt`) and then returns

```ts
return { partition: "unchanged", name: plugin, fromVersion, toVersion: fromVersion, ... };
```

so the row is `⊘ hello (skipped) {up-to-date}` at info severity. The WR-04 test itself asserts the pin moved `1.0.0` → `1.1.0` in the same call that rendered `{up-to-date}`. The `unchanged` partition is defensible for the *artifact* state, but `up-to-date` is a claim about the version, and the version is exactly what changed. The operator has no way to learn from the output that the record was re-pinned or that its compatibility block flipped.

This is pre-existing D-UPD behavior, but WR-04 materially widens its reach (every disabled record now takes this arm, including the newly-degrading ones from WR-01), so it is worth resolving now rather than inheriting.

**Fix:** Report the refresh truthfully without minting a token. `updated` is already in `PLUGIN_STATUSES` and already carries the required `from`/`to` pair:

```ts
return {
  partition: "updated",
  name: plugin,
  fromVersion,
  toVersion,          // the refreshed pin, not fromVersion
  declaresAgents: false,
  declaresMcp: false,
};
```

If the `(updated)` token is unacceptable because nothing was materialized, keep `unchanged` but drop the `up-to-date` reason so the row states no false fact, and pin the new bytes in the `disabled-record-refresh` catalog state.

### WR-03: `InstallPluginOutcome` advertises three ledger signals `installPlugin` never populates

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:232-240` (type), `:1859-1870` (producer), `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts:53-91` (shape)
**Issue:** The `installed` arm now intersects the full `LedgerDegradationSignals`, whose doc claims "a signal added to one row's vocabulary cannot be silently dropped from the other — the asymmetry class becomes a compile error instead of a review finding." Every field is optional, so nothing is a compile error. In fact `installPlugin`'s return sets only `orphanRewake` and `degradedKinds`; `unsupported`, `stagedAgents` and `stagedMcpServers` are **never** written on this outcome. Consequences:

- A consumer reading `result.unsupported` on an install outcome silently gets `undefined`. Today that path is unreachable (reconcile and import both call `installPlugin` without `partial`, so a `partially-available` plugin fails the strict gate), but the type says otherwise, and the very asymmetry this shape was introduced to prevent ("a bare `(installed)` row here would contradict the `(partially-installed)` row `list` renders one command later", `enable-disable.ts:285-289`) is now reachable by adding one `partial: true` at either call site.
- `declaresAgents` / `declaresMcp` (required booleans) and `stagedAgents` / `stagedMcpServers` (optional booleans) are two names for the same fact, both derived from `installCtx.stagedAgentNames.length > 0` / `stagedMcpServerNames.length > 0`. The outcome now carries the duplicate vocabulary permanently.

**Fix:** Either populate the fields install can produce, so the shape is honest:

```ts
return {
  status: "installed",
  resourcesChanged: stagedAny,
  declaresAgents: installCtx.stagedAgentNames.length > 0,
  declaresMcp: installCtx.stagedMcpServerNames.length > 0,
  ...(installCtx.stagedAgentNames.length > 0 && { stagedAgents: true }),
  ...(installCtx.stagedMcpServerNames.length > 0 && { stagedMcpServers: true }),
  ...(installCtx.resolved.state === "partially-available" && {
    unsupported: [...installCtx.resolved.unsupported],
  }),
  ...
};
```

or intersect only the subset install genuinely emits (`Pick<LedgerDegradationSignals, "orphanRewake" | "degradedKinds">`) and say so in the doc, instead of claiming a compile-time guarantee the optional fields do not provide.

### WR-04: The IN-07 asymmetry persists on the third ledger-driven reconcile arm (`plugin-backfilled`)

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts:133-148`, `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts:611-645`, `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:1224-1240`
**Issue:** IN-07 closed the install↔enable gap by threading `orphanRewake` onto the reconcile `plugin-installed` arm. The backfill arm runs the same class of ledger (`reinstallPlugin` with `render: "none"`), but `PluginBackfilledOutcome` declares neither `orphanRewake` nor `degradedKinds`, and `apply.ts`'s push site propagates neither. A load-time backfill of a plugin whose `hooks.json` declares `rewakeMessage` without `asyncRewake: true`, or whose skill frontmatter is unparseable, renders a clean `(installed)` / `(partially-installed)` row that names neither fact — exactly the contradiction the phase's own comments condemn.

Note also that neither `PluginInstalledOutcome` nor `PluginBackfilledOutcome` extends `EnableDegradationSignals` (only `PluginEnabledOutcome` does), so the "cannot drift" argument recorded in `apply-outcomes.ts:169-186` covers one of the three arms.

**Fix:** Have `PluginBackfilledOutcome` and `PluginInstalledOutcome` extend the shared shape and populate it from the reinstall/install outcome, then read it in `installedRowFromOutcome` / the backfilled arm, mirroring the enable arm's `degradationFromEnable` lift. If the backfill gap is a deliberate deferral, record it as one — nothing in the phase artifacts mentions the third arm.

### WR-05: `staleGateDropped` can erase the narrowed base reasons via `?? `

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:1210-1220`, consumed at `:1132-1138`
**Issue:** The predicate returns `readonly ContentReason[] | undefined` and the caller writes `reasons: staleGate ?? baseReasons`. `??` treats `[]` as present, so a stale-gate match that narrows to an EMPTY reason list would (a) discard the `narrowEnableFailure` result and (b) still stamp `partialHint: true`, producing a brace-less `(failed)` row carrying a remediation trailer.

Today this is unreachable: `decideResolution` (`domain/resolver.ts:1415`) only builds the `partially-available` arm when `partial.unsupported.length > 0`, and `kindToReason` maps every string to a member, so `narrowUnsupportedKinds` on that list is always non-empty. The guard is one resolver change away from firing, and the helper's contract ("`undefined` means leave the row exactly as it was", per the phase's own patterns-established note) is not enforced.

**Fix:**

```ts
function staleGateDropped(cause: Error): readonly ContentReason[] | undefined {
  if (
    cause instanceof PluginShapeError &&
    cause.shape.kind === "not-installable" &&
    cause.shape.partialable
  ) {
    const narrowed = narrowUnsupportedKinds(cause.shape.unsupportedKinds ?? []);
    // An empty narrowing names no fact: leave the row exactly as it was.
    return narrowed.length > 0 ? narrowed : undefined;
  }

  return undefined;
}
```

### WR-06: `assertNoForbiddenSurface` silently skips a missing target, uncovering the NFR-5 gate on rename

**File:** `tests/helpers/source-scan.ts:71-83`
**Issue:** A target that cannot be read with `ENOENT` is `continue`d, and the header documents this as intentional ("a gate may be authored before the file it will guard"). The consequence is that renaming, moving, or deleting `orchestrators/plugin/install.ts` / `list.ts` / `uninstall.ts` / `info.ts` turns the NFR-5 network-boundary gate green on zero inspected files. The COMPAT-01 delegation clause (`compat-01-no-expansion.test.ts:323-338`) inherits the same hole: it verifies the two info-surface path strings still appear in the network gate's SOURCE, not that those files exist.

This behavior was carried forward verbatim from the pre-refactor gate, so it is not a phase-98 regression — but the extraction is the moment it became shared by two gates and re-justified in a new header, which makes it in-scope.

**Fix:** Make existence explicit rather than implicit. Either fail on ENOENT and keep a separate `pendingTargets` list for not-yet-authored files, or assert coverage:

```ts
export async function assertNoForbiddenSurface(
  targets: ReadonlyArray<string>,
  patterns: ReadonlyArray<{ readonly name: string; readonly pattern: RegExp }>,
  describeViolation: (offenders: ReadonlyArray<string>) => string,
  opts: { readonly allowMissing?: ReadonlyArray<string> } = {},
): Promise<void> {
  // ... on ENOENT:
  if (code === "ENOENT") {
    assert.ok(
      opts.allowMissing?.includes(rel),
      `source-scan: target ${rel} does not exist. A renamed target silently uncovers this gate; add it to allowMissing only while it is genuinely unwritten.`,
    );
    continue;
  }
```

### WR-07: The eighth-glyph clause matches a declaration form the codebase is not required to use

**File:** `tests/architecture/compat-01-no-expansion.test.ts:251-264`, helper `tests/helpers/source-scan.ts:44-48`
**Issue:** The file header states this is "the only way to catch" an eighth glyph export, because there is no exported collection to compare. The clause implements it as

```ts
(await readStrippedSource(NOTIFY_REL)).match(/^export const ICON_[A-Z_]+ = /gm)
```

Two forms slip past it: a type annotation (`export const ICON_EIGHTH: string = "◎";` — no match on `= ` immediately after the name) and any declaration not at line start, which `stripComments` can produce by collapsing a preceding multi-line block comment into the same line. Additionally `stripComments`'s `/\/\*[\s\S]*?\*\//g` is content-blind: a `/*` inside a string or regex literal in the scanned file would swallow real source up to the next `*/`. So the one clause the file calls load-bearing provides less assurance than the header claims.

**Fix:** Compare against a collection rather than scanning source. Export a frozen glyph record from `notify.ts` and pin it by enumeration, which removes the source-scan clause entirely and catches an eighth glyph by value:

```ts
// notify.ts
export const ICONS = Object.freeze({
  installed: ICON_INSTALLED,
  available: ICON_AVAILABLE,
  uninstallable: ICON_UNINSTALLABLE,
  disabled: ICON_DISABLED,
  remote: ICON_REMOTE,
  partiallyInstalled: ICON_PARTIALLY_INSTALLED,
  partiallyAvailable: ICON_PARTIALLY_AVAILABLE,
});

// compat-01-no-expansion.test.ts
assert.deepEqual(Object.entries(ICONS).map(([k, v]) => `${k}=${v}`), [ /* seven pins */ ]);
```

If the source scan must stay, loosen the anchor to `/\bexport const ICON_[A-Z_]+\b/g`.

### WR-08: The catalog's glyph names for `◉` and `◍` are wrong, and `◍`'s name belongs to `◉`

**File:** `docs/output-catalog.md:13` (added this phase) and `docs/output-catalog.md:15`
**Issue:** The Glyphs section reads:

- line 13: ``- `◉` -- bullseye.``  — `◉` is U+25C9 FISHEYE; BULLSEYE is U+25CE, a different character the codebase does not use.
- line 15: ``- `◍` -- fisheye.``  — `◍` is U+25CD CIRCLE WITH VERTICAL FILL. "Fisheye" is `◉`, the glyph two lines above.

So the catalog gives the same descriptive name to one glyph that owns it and denies it to the glyph two rows up. The same phase's COMPAT-01 gate names both correctly (`compat-01-no-expansion.test.ts:237,240-243`: "ICON_DISABLED is CIRCLE WITH VERTICAL FILL", "ICON_PARTIALLY_INSTALLED is FISHEYE"), which makes this a self-inconsistency inside phase 98's own DOC-08 sweep — the commit that added line 13 is `f486c608 docs(98): redraw the list decision path and fix its glyph claims`.

**Fix:** Match the gate's naming, and keep the section's existing descriptive register:

```markdown
- `◉` -- fisheye (filled circle inside a ring). On plugin rows: ...
- `◍` -- circle with vertical fill. On plugin rows: ...
```

---

_Reviewed: 2026-08-10T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
