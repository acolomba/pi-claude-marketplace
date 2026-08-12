---
phase: 98-lifecycle-regression-and-contract-documentation
reviewed: 2026-08-10T13:30:00Z
depth: standard
iteration: 3
files_reviewed: 15
files_reviewed_list:
  - docs/messaging-style-guide.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/architecture/compat-01-no-expansion.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/plugin/reinstall.test.ts
  - tests/orchestrators/plugin/update.test.ts
findings:
  critical: 0
  warning: 2
  info: 0
  total: 2
status: issues_found
---

# Phase 98: Code Review Report (iteration 3 — final)

**Reviewed:** 2026-08-10T13:30:00Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found (both findings are carriers, not blockers)

## Summary

Final re-review of the three iteration-2 fix commits — `94f1c8a4` (WR-09), `f6b1a5c2`
(WR-10), `9e94195a` (WR-11) — verified at the source rather than accepted from
`98-REVIEW-FIX.md`, then read as new code.

**All three fixes are genuine.** Per-fix verdicts below. Independently re-run in the
worktree: `npx tsc --noEmit` exits 0; ESLint is clean over every changed production and
test file; the six suites that own the changed contracts
(`reinstall`, `marketplace/update`, `plugin/update`, `catalog-uat`,
`compat-01-no-expansion`, `reconcile/notify`) pass with 0 failures. The three commits add
**no** `eslint-disable`, `@ts-*`, or `sonarjs` suppression of any kind — WR-09's
complexity relief came from a real extraction (`reinstalledRowFromOutcome`), not a
silenced rule. No closed set gained or lost a member; the only structural widening is one
OPTIONAL `reasons` field on `PluginReinstalledMessage`, the shape `PluginInstalledMessage`
already establishes. `shared/notify.ts` stays a dumb renderer: both reinstall arms only
thread `p.reasons`; the `info -> warning` raise is stamped in the orchestrator composer.
Comment policy holds — `WR-NN` / `CR-NN` are sanctioned anchors and no `Phase NN` /
`Pitfall N` token appears.

Two NEW findings, both WARNING, both carriers. Neither is a regression from the fix
commits. **WR-12** is a real user-visible defect the WR-09 fix makes conspicuous by
symmetry — `update` is now the one ledger-driven verb that degrades a component and says
nothing — proven by running the real verb, not by reading. **WR-13** is documentation drift
the WR-09 commit left behind in the file it edited.

Recorded rulings (per-surface SEV-01 asymmetry, the `not-installable` key, the plural tally
counting by stamped severity, SEV-03 / WARN-01, the per-kind LIFE-04 fixtures, the three
documentation deferrals in `98-06-SUMMARY.md`) are honoured and not re-raised.

## Per-fix verification

**WR-09 — FIXED, and more completely than the finding asked.** `reinstalledRowFromOutcome`
(`orchestrators/plugin/reinstall.ts:909-930`) is the SOLE composer of a
`PluginReinstalledMessage` in the tree — a repo-wide grep for `status: "reinstalled"` finds
exactly one production literal (`reinstall.ts:915`) plus the type declaration. Both the
standalone branch (`:351`) and the bulk cascade mapper (`:954`) call it, so the two surfaces
cannot disagree. The finding named only the cascade mapper; the fixer correctly found the
third site — `REINSTALL_RENDER.reinstalled` in `reinstall.messaging.ts:57-71`, the map that
actually renders the standalone verb — which passed a hard-coded `undefined` independently
of the central arm. Fixing only the cited site would have raised severity while still
dropping the brace, so this is the right blast radius. Both render paths agree byte-for-byte:
`installedLikeRow` (`notify.ts:2172`) and the central `reinstalled` arm (`notify.ts:2245-2262`)
compose the same `joinTokens([icon, name, scope, version, label, composeReasons(...)])`.
The byte pins are real and go through the public verb, not a seam: the degraded row asserts
the full five-line payload including `severity === "warning"` on the Pi API argument, and the
clean row asserts the unchanged three-line payload with `severity === undefined` (the NREG-01
guard). The catalog gained `reinstall-degraded-component` with its UAT fixture; the style
guide's optional-`reasons` inventory names both variants. The `version` spread changed from
unconditional to `outcome.version !== ""` on the standalone branch — byte-equivalent, since
`renderVersion` suppresses the token for both `""` and `undefined`.

**WR-10 — FIXED (behavior kept, pinned).** The gate is unchanged
(`orchestrators/marketplace/update.ts:1031`), and keeping it is the right call for the reason
the commit gives: `unchanged` means nothing was written, and a disabled-record refresh
rewrites version / `resolvedSource` / `resolvedSha` / `compatibility`. Widening it would
restate at the marketplace level the falsehood WR-02 removed one level down. The new
end-to-end case seeds an autoupdate-ON path marketplace with a disabled record pinned at the
plugin's current content hash, moves plugin CONTENT while leaving `marketplace.json`
byte-identical (reachable only because the version ladder is content-derived — the fixture
declares no version in either `plugin.json` or the manifest entry), and asserts the whole
two-line cascade byte form plus `severity === undefined`. It is discriminating by
construction: the collapse renders ONE line and no rows, so the equality fails. It also
asserts the re-pin really happened (`after.version !== pinnedVersion`, `after.enabled ===
false`), which is what makes the `{up-to-date}` denial a lie rather than a preference. The
`update-autoupdate-disabled-repin` catalog state and the amended no-op prose land in the same
commit. Note the follow-on this makes safe: the refresh persists the new pin, so the next
autoupdate run reports `unchanged` and collapses again — the new rows are one-shot per content
move, not recurring startup noise.

**WR-11 — FIXED.** `InstallSignalKey = keyof InstalledOutcome & keyof LedgerDegradationSignals`
(`tests/architecture/compat-01-no-expansion.test.ts:122-123`) with
`const populated: Record<InstallSignalKey, true>` is bidirectional as claimed: a signal added
to the shared shape flows through the `Omit` into `keyof InstalledOutcome`, enters the
intersection, and fails as a missing property; a signal removed there — or newly excluded in
`install.ts`'s `Omit` — fails as an excess property on the annotated object literal. Deriving
the key type from the production types rather than restating the exclusion list keeps both
halves live, and the expected member list stays hand-written, so the gate does not become the
derived-expectation tautology this file's own header forbids. A discriminant rename would
collapse `Extract<..., { status: "installed" }>` to `never`, which widens the key set to all
five signals and still fails loudly. The type IS the gate — the runtime clause is a
report-only length echo and can never fail by itself — and the comment says exactly that
rather than implying otherwise. `install.ts:230-236` now names the gate instead of asserting
an unenforced guarantee. `npx tsc --noEmit` exits 0 with the clause in place.

## Narrative Findings (AI reviewer)

### WR-12: `update` is now the one ledger-driven verb that degrades a component and reports nothing

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1169-1191`
(`prepareUpdateHandles` — the handles carry `result.degraded` and nothing reads it),
`extensions/pi-claude-marketplace/shared/notify.ts:691-704`
(`PluginUpdatedMessage` declares no `reasons`)
**Severity:** WARNING (carrier — pre-existing, not a regression from the fix commits)

**Issue:** `update` stages through the same bridge entry points as install and reinstall
(`prepareStageSkills` / `prepareStageCommands`, `update.ts:1170` and `:1181`) and therefore
degrades an unparseable component identically — synthesized `disable-model-invocation` for a
skill, neutralized frontmatter for a command. `install` reads `prep.result.degraded`
(`install.ts:931-933`, `:970-973`), `reinstall` reads it (`reinstall.ts:1742-1743`), `enable`
reads it (`enable-disable.ts:292`), and both reconcile projections read it. `update` never
does: `handles.skills.result.degraded` and `handles.commands.result.degraded` have no reader,
`UpdatePluginOutcome` carries no `degradedKinds`, and `PluginUpdatedMessage` has no `reasons`
field to render one on.

Verified by running the real verb (`updatePlugins`, marketplace target, project scope,
malformed `SKILL.md` on the new revision):

```text
● mp [project]
  ● alpha v1.0.0 → v1.0.1 (updated)

Plugin update: 1 updated

/reload to pick up changes
```

severity `undefined` (info) — while the artifact the same run wrote is:

```yaml
---
name: alpha-tool
description: Source frontmatter could not be parsed.
disable-model-invocation: true
---
```

The skill was silently stripped of model invocation and the operator was told the update
succeeded, at info, with no token. That is the exact class CR-01 and WR-09 closed on the
enable and reinstall surfaces. It matters most here: `update` is the verb that pulls a NEW
upstream revision, so it is the likeliest place for a component to start failing to parse,
and the row it renders is the only notice the operator gets.

The WR-09 comments are precisely worded and remain true — `reinstall` was the last verb whose
OUTCOME carried the signal but whose ROW discarded it; `update`'s outcome never carried it —
so this is not a false claim in the shipped code. It is the remaining hole in the invariant
those comments now assert as a pattern.

**Fix (carry, do not attempt at loop cap):** collect the degradations in
`prepareUpdateHandles` the way `reinstall.ts:1742-1743` does, add `degradedKinds?: readonly
DegradeKind[]` to the `updated` outcome arm, and thread
`malformedReasonsForKinds(outcome.degradedKinds)` with the WARN-01 `info -> warning` raise
into the `(updated)` row. That requires an OPTIONAL `reasons` field on
`PluginUpdatedMessage` — the third such variant after `installed` and `reinstalled` — plus an
`update-degraded-component` catalog state and its byte fixture in the same change, and an
amendment to the D-15-01 discipline bullet in `docs/messaging-style-guide.md:66`, which
currently says exactly two transition variants carry the optional field. If the silence is
deliberate, record the reason: nothing in the phase artifacts rules on `update` for WARN-01.

### WR-13: the `installedLikeRow` JSDoc still says only the `installed` arm threads `p.reasons`

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:2166-2170`
**Severity:** WARNING (carrier)

**Issue:** `94f1c8a4` made `REINSTALL_RENDER.reinstalled` thread `p.reasons` through
`installedLikeRow`, and updated the `composeReasons` per-variant inventory
(`notify.ts:2058-2069`) and the style guide to match. It did not update the JSDoc of
`installedLikeRow` itself, which still reads:

```ts
 * `reasons` is the optional reason set (the `installed` arm threads `p.reasons`, the
 * reasons-less variants pass `undefined`)
```

This is the doc a future author reads before adding or editing a soft-dep-bearing arm — it is
the sole-composition-site contract for exactly the parameter WR-09 changed the meaning of.
Leaving it naming one caller when there are now two invites the next arm to pass `undefined`
by imitation, which is how WR-09's defect arose in the first place.

(Adjacent and NOT raised: the per-variant discipline block at `notify.ts:585-591` is stale
from long before this phase — it counts 5 reasons-bearing variants against today's 19 plugin
statuses and omits `partially-available`. Pre-existing rot, out of this phase's blast radius,
and correcting it is a separate deliberate sweep.)

**Fix:** one line, in the same file the fix already edits:

```ts
 * `reasons` is the optional reason set (the `installed` and `reinstalled` arms thread
 * `p.reasons`; the reasons-less variants pass `undefined`)
```

---

_Reviewed: 2026-08-10T13:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: 3 (final — loop cap reached; both findings are carriers)_
