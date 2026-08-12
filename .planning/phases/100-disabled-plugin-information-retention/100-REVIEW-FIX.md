---
phase: 100-disabled-plugin-information-retention
fixed_at: 2026-08-11T20:20:00Z
review_path: .planning/phases/100-disabled-plugin-information-retention/100-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 100: Code Review Fix Report

**Fixed at:** 2026-08-11
**Source review:** `.planning/phases/100-disabled-plugin-information-retention/100-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 6 (CR-01, WR-01..WR-05)
- Fixed: 6
- Skipped: 0
- Info findings (IN-01..IN-04): out of scope per the operator ruling, untouched

All six were real defects. Each was verified against the source before the fix, and each landed as one commit.

## Verification

`npm run check` (typecheck -> ESLint -> Prettier -> unit -> integration) was run from the phase worktree
`/home/acolomba/pi-claude-marketplace/.worktrees/manifest-independent-plugin-info`, which has its own real
`node_modules`. **The gates ran in that worktree, not in the main checkout** — the numbers are reproducible
from the branch as committed.

- typecheck: pass
- ESLint: pass
- Prettier `format:check`: pass
- unit (`tests/{architecture,bridges,docs,domain,edge,helpers,orchestrators,persistence,platform,shared,transaction}`):
  **3443 pass / 0 fail**
- integration: 16 pass / **2 fail** — `tests/integration/provenance-invisibility.test.ts` and
  `tests/integration/skill-path-resolution.test.ts`, the two documented environment failures caused by the stale
  global `pi-subagents` peer resolved from `npm root -g`. Both are unrelated to every file touched here
  (no bridge, no frontmatter, no skill-path code was changed).

Per-file `pre-commit run --files` was run before each commit. The only hook failure was `trufflehog`, which fails
structurally in a linked worktree; the sanctioned filesystem scan
(`trufflehog filesystem <paths> --results=verified,unknown --fail`) was run clean before every commit
(`verified_secrets: 0`, `unverified_secrets: 0`) and each commit carried the `SKIP=trufflehog` prefix and nothing else.

### Mutation checks

| Finding | Test | Reverted fix | Result |
|---|---|---|---|
| CR-01 | `ENBL-17 / NFR-5: 'info --fetch' on a DISABLED record the manifest still DECLARES makes ZERO seam calls` | gate replaced with `const blockFetchCtx = fetchCtx;` | **FAILS** — `ENBL-17: a disabled declared record must not clone` (clone counter 1) |
| WR-01 | `ENBL-16 / D-96-03: a DISABLED record whose recorded hooks container cannot be listed keeps the read reason` | filter narrowed back to the single token | **FAILS** — byte mismatch, `{not in manifest}` instead of `{not in manifest, source missing}` |
| WR-02 | `ENBL-18: a DISABLED owner still reserves its generated names, and the conflict names it as disabled` | qualifier dropped | **FAILS** |
| WR-04 | 4-arm parity suite | `p.reasons` -> `undefined` in both arms | **FAILS** on both changed arms (2 of 4), passes on the 2 already-correct arms |

All four pass with the fixes restored.

## Fixed Issues

### CR-01: `info --fetch` on a disabled plugin the manifest still declares hits the network, then reports it fetched nothing

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`,
`tests/orchestrators/plugin/info-manifest-absent.test.ts`
**Commit:** `a0d4e816`

Reproduced as described. `buildBlock` arm (c) threaded `fetchCtx` into `buildInstalledRow` for every installation
record, so a disabled git-source plugin cloned and fetched for real, then received the `warning`-severity
`(skipped) {already disabled}` note whose only purpose is to say the fetch did nothing — contradicting
`InfoBlock.skipReason`, `buildFetchSkipBlock` and `docs/output-catalog.md:1649` at once.

Applied the reviewer's fix: gate the fetch context off when `isRecordedButDisabled(installed)` holds, so the
skip reason and the fetch decision are one decision. Arm (b) needs no gate —
`buildStateOnlyInstalledRow` cannot express a fetch by signature.

New coverage: a zero-call test on the manifest-**DECLARED** disabled arm. Every pre-existing disabled `--fetch`
fixture seeds `manifest: { plugins: [] }`, which routes to the state-only arm, so this branch had none.

**Residue, deliberately not fixed:** the reviewer's "second, milder face" — a disabled PATH-source plugin gets the
`{already disabled}` note while an ENABLED path-source plugin under `--fetch` gets no note at all, because nothing
is fetchable for either. That asymmetry predates this phase, lives in `skipReasonFor`'s manifest-arm keying rather
than in the disabled path, and the reviewer's own Fix section proposes only the gate. It is now harmless (the note
is true — a fetch was requested and nothing was fetched) and is worth its own finding if the operator wants the
enabled path-source case to account for its no-op too.

### WR-01: `applyDisabledRowShape` discarded failure-class reasons that block `enable`

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`,
`tests/orchestrators/plugin/info-manifest-absent.test.ts`, `docs/output-catalog.md`
**Commit:** `fc2232e8`

Widened the allow-list from one token to `not in manifest` plus the five durable blockers
(`source missing`, `unreadable`, `permission denied`, `network unreachable`, `authentication required`), exactly per
the operator ruling. The unsupported-kind suppression is untouched and still pinned by
`info-manifest-absent.test.ts:1131` / `:1233` (both green).

`unparseable` and `invalid manifest` were deliberately left out of the set — both name a marketplace-manifest
defect, and a block that could not read its manifest returns at arm (a) before this shape applies.

Coverage: a disabled record naming a hooks container with no `hookEntries` and no materialized file. This is the
reachable failure-class case after CR-01 (the git-source repro the review cited is no longer reachable — with the
fetch declined, a bare presence-probe failure degrades silently by design, D-78-04). The suppression there was a
second face of the same bug: D-96-03 exists precisely so "container unlistable" cannot read as "no hooks", and the
filter was collapsing them back together.

Catalog: corrected two states whose prose claimed manifest absence was the only reason a disabled row can carry —
the list-surface `disabled-inventory-not-in-manifest` (scoped to that surface, which runs no probe and therefore
never HAS another reason) and the info-surface `state-only-disabled-with-components`. **No byte fixture changed**;
`tests/architecture/catalog-uat.test.ts` is green.

### WR-02: disabled records reserve generated names and refuse unrelated installs

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts`,
`tests/orchestrators/plugin/shared.test.ts`, `docs/output-catalog.md`
**Commit:** `1e7005c9`

Took the reviewer's second option — **keep the reservation**, make it explainable. Excluding disabled records from
`collectOwners` would let a second plugin take a name the disabled owner needs back, breaking the later `enable`,
and would let an `uninstall` of the disabled plugin unstage the other plugin's artifact by name. The reservation is
the correct semantics; the defect was that the refusal was unexplainable from disk.

- `collectOwners` now carries each owner's `isRecordedButDisabled` verdict in a named `NameOwner` type.
- `collectConflicts` renders `already owned by disabled plugin "alpha"` for a disabled owner, unchanged wording for
  an enabled one.
- One test pins both wordings in a single `deepEqual`, so they cannot drift apart.
- The behaviour is recorded under the install section of `docs/output-catalog.md` as prose, with the exact conflict
  lines and the `uninstall <owner>` remedy. It is **prose without a `catalog-state:` annotation** on purpose: this
  text rides the `cause:` trailer of the existing `failure-runtime-with-cause` row and is not a new row form, and
  the catalog gate requires a paired `NotificationMessage` fixture for every annotated state.

### WR-03: `update` of a disabled record moves the pin but leaves the inventory describing the old version

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`, `docs/output-catalog.md`
**Commit:** `66ec1f38`

Real and confirmed: `refreshDisabledRecord` writes `version` / `resolvedSource` / `resolvedSha` / `compatibility`
and touches neither `resources.*` nor `hookEntries`.

Took the **documented floor**, and did not change `update` semantics. Stating the reasoning explicitly, because
this is the one finding where I declined the reviewer's "better" options:

- *Clearing `resources.*` and `hookEntries` when the pin moves* would trade a stale answer for no answer, which is
  exactly the self-describing record ENBL-18 was built to keep. It would also resurrect a variant of the invariant
  WR-05 is about.
- *Refusing to move the pin without re-materializing* would leave a later `enable` installing a version the
  marketplace no longer declares — the failure mode `D-UPD` / `ENBL-09` added the refresh to prevent.

The skew is bounded and self-healing: `enable` re-materializes and overwrites the inventory. Documented at the
write site (why each option was rejected) and in the `state-only-disabled-with-components` catalog state (what the
user sees). **This one is a documentation fix by choice — if the operator wants the pin and the inventory made
structurally inseparable, that is a design change worth its own phase, not a review fix.**

### WR-04: `PluginDisabledMessage.reasons` was silently dropped by two of four disabled render arms

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts`,
`extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts`,
`tests/shared/notify-disabled-reasons.test.ts` (new)
**Commit:** `057f7f52`

Threaded `p.reasons` in the disable-cascade and reconcile-applied arms and rewrote both comments. **No rendered
byte changes** — neither producer stamps a reason today, which is precisely why nothing caught the omission.

Added a four-arm parity test that stamps one reason per arm (central `notify` switch, `LIST_CONTEXT`,
`DISABLE_CONTEXT`, `RECONCILE_APPLIED_CONTEXT`) and asserts the brace reaches the wire. It covers the two arms that
were already correct as well, so the four cannot drift apart again. Bytes only — severity and the reload trailer
stay with `notify-inert-fields` / `notify-producer-wire-coverage`.

### WR-05: comments still asserted the removed "disabled implies empty resources" invariant

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`,
`extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts`,
`tests/orchestrators/plugin/enable-disable.test.ts`
**Commit:** `d14393d9`

All four cited sites rewritten to the actual rule: disable changes `enabled` and `updatedAt` and nothing else;
`resources.*` and `hookEntries` are preserved and are no part of the marker. The `update.ts:1520` site was rewritten
as part of WR-03's commit (the truthful skew statement replaces that exact sentence); the other three are here.

One adjacent line was corrected with them: `plan.ts`'s enable-branch steady-state comment three lines below the
cited one read "Declared-enabled, recorded, **populated**: steady state", the same falsified claim, and my rewrite
of the disable branch refers to that steady state by name.

Comment policy followed: decision and requirement IDs (`D-100-xx`, `ENBL-xx`, `NFR-x`, `WR-05`) kept as anchors; no
phase / plan / wave / milestone references introduced.

**Uncited residue of the same class, left alone deliberately** (out of the finding's four sites; report rather than
sweep):

- `tests/orchestrators/plugin/list-manifest-absent.test.ts:178` — "ENBL-04: empty resources + installable:true IS
  the disabled marker". Flatly false since ENBL-05 moved the marker to `enabled: false`. The strongest remaining
  case for a follow-up.
- `tests/orchestrators/plugin/update.test.ts:3142` (title) and `:3156` — "keeps resources empty" / "the
  isRecordedButDisabled marker". The title is true of that fixture's outcome; the marker phrasing is stale.
- `tests/orchestrators/marketplace/autoupdate.test.ts:678` — describes its own fixture; accurate as written.
- `extensions/pi-claude-marketplace/persistence/migrate.ts:20,153` — describes the LEGACY pre-ENBL-02 on-disk
  shape. Accurate; must NOT be changed.

---

_Fixed: 2026-08-11_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
