---
phase: 95-manifest-independent-installed-inventory
reviewed: 2026-08-08T22:40:00Z
depth: standard
iteration: 3
files_reviewed: 7
files_reviewed_list:
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/edge/handlers/tools.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/edge/handlers/tools.test.ts
  - tests/orchestrators/plugin/list-manifest-absent.test.ts
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 95: Code Review Report

**Reviewed:** 2026-08-08T22:40:00Z
**Depth:** standard (iteration 3, post-fix)
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Re-reviewed the full diff `60123d33^..HEAD`, with attention on the three
iteration-2 fix commits (06875fa4, c003405d, 8c3656b9) and on whether they
broke anything the earlier commits had established.

**Verification of the iteration-2 fixes — all three land:**

| ID | Claim | Verdict |
| --- | --- | --- |
| WR-05.1 | `ownsAbsenceClaim` / `claimAuthorityPath` replaced by a discriminated `ScopedManifest`; INV-01 false negative closed; BOUND-03 guard non-redundant | **Fixed.** `ownsAbsenceClaim` is gone from the tree. `ScopedManifest` (`list.ts:865-867`) is `{ok:true,manifest} | {ok:false,loadError}` and `manifestLookupFor` (`list.ts:880-887`) is the single translation into `ManifestLookup`. `installedRowMessage` derives BOTH `manifestEntry` and `notInManifest` from that one value (`list.ts:397-400`), so `{not in manifest}`, `(upgradable)` and `description` now all read the record's OWN manifest — the incoherent authority split flagged as WR-05(b) is reduced to "which manifest SHOULD a folded row describe", which is the deferred BOUND-01/02 question. The guard is genuinely load-said: `buildMarketplaceMessage` early-returns the `(failed)` header on `!ok` (`list.ts:968`), so the `unverified` arm is reachable only on the fold path, where `loadMarketplaceManifestSoftly(projectMp)` may fail — exactly one check, no redundancy. |
| WR-06 | Vacuous divergent-path test rewritten; failed-load fixture added | **Fixed.** The two BOUND-03 tests (`list-manifest-absent.test.ts:568-600` and `:602-631`) are now a proper differential pair: identical seeds, differing only in `manifestPath` (nonexistent vs. the real file), producing bare `(installed)` vs. `{not in manifest}`. The load-failure axis is the only thing that varies, so mutating `manifestLookupFor`'s `unverified` arm to `absent` fails the first test. The new `INV-01` fold test (`:642-678`) pins the reversed behavior — a folded row absent from its own manifest DOES claim the absence even when the user block names another manifest — which is the case iteration 1's `ownsAbsenceClaim` had silenced. |
| WR-07 | `manifestEntry` + `notInManifest` collapsed into one `ManifestLookup` | **Fixed.** `installedRowMessage` takes one `lookup: ManifestLookup` (`list.ts:388`); an entry alongside an absence claim is now unrepresentable. Parameter count dropped 8 → 7 (the named-args refactor is the documented IN-09 skip). |

**Gates run in the worktree:** `tsc --noEmit` clean. `eslint` clean on all six
`.ts` files. Tests: `list-manifest-absent.test.ts` 46/46,
`orchestrators/plugin/list.test.ts` 73/73, `edge/handlers/tools.test.ts` 28/28,
`architecture/catalog-uat.test.ts` 6/6, `orchestrators/edge-deps.test.ts` 14/14,
`integration/fold-adoption.test.ts` 2/2 — the adjacent fold and output-parity
suites the fix pass could plausibly have broken are green.

**Security:** nothing to report. The path is read-only over `state.json` plus a
fixed closed-set reason token; no network (NFR-5 holds — no `gitOps` surface
appears in `list.ts`), no writes, no shell, no interpolation of untrusted data
into anything but a notify string that already carried manifest-derived
`description` before this phase. All output still routes through
`notifyWithContext` (IL-2).

**Also checked and found sound:** the `LIST_RENDER.installed` arm now forwards
`p.reasons` where it previously hard-passed `undefined` — the old comment's
"orphan-rewake brace must not leak onto an inventory row" concern cannot
materialize, because `orchestrators/plugin/list.messaging.ts`'s `LIST_CONTEXT`
is consumed only by `orchestrators/plugin/list.ts` (the same-named export in
`orchestrators/marketplace/list.messaging.ts` is a separate module), and the
only producer of `installed` rows on that surface is `installedRowMessage`. The
`disabled`, `upgradable` and `partially-upgradable` arms cannot carry the
absence brace by construction (the disabled branch returns before the reasons
field is built; the two upgradable statuses require `lookup.kind === "declared"`
via the `manifestEntry?.version !== undefined` conjunct), which matches INV-04
and the two catalog states.

One doc/code contradiction remains, introduced by the fix pass itself.

## Warnings

### WR-08: The catalog paragraph still documents the claim-authority rule the fix pass reverted

**File:** `docs/output-catalog.md:412` (the `manifest-absent-inventory` prose)
**Severity:** WARNING

Commit 43d62143 wrote the catalog paragraph against the iteration-1
`ownsAbsenceClaim` behavior. Commit 06875fa4 then reversed that behavior, but
the paragraph was not updated. It currently reads:

> The claim is made ONLY about a manifest that was actually read **and that the
> block header names** -- a manifest-read failure renders the bare `(failed)`
> marketplace header instead (BOUND-01), and **a cross-scope folded row whose
> owning record names a different manifest drops the brace** (BOUND-03 /
> D-95-05).

Both bolded clauses are now false, and the test added in the same fix pass
asserts the opposite:
`list-manifest-absent.test.ts:642` ("a folded row absent from its OWN manifest
claims the absence even when the user block names another manifest") pins
`● alpha [project] v1.0.0 (installed) {not in manifest}` for precisely the
configuration the catalog says drops the brace. The header-naming condition no
longer exists anywhere in `list.ts`.

Two further inaccuracies in the same sentence:

- It attributes the (now removed) rule to **BOUND-03 / D-95-05**. Those anchors
  cover the load-failure arm only; citing them for a deleted identity rule
  will mislead the Phase 96 BOUND-01/02 work, which is chartered to decide this
  exact question and will read this paragraph as the current contract.
- Its only statement about a manifest-read failure is the non-fold form (bare
  `(failed)` marketplace header). The fold-path failure form — the row survives
  as a bare `● <name> [project] v<ver> (installed)`, pinned at
  `list-manifest-absent.test.ts:568` — is the actual BOUND-03 / D-95-05
  behavior and is undocumented.

This is not the deferred IN-07 item (that is the "materialized on disk" wording
in the preceding sentence) and not the deferred WR-02 item (stale comments in
untouched files). It is a line this phase added, invalidated by a later commit
in the same phase. Nothing catches it: `catalog-uat.test.ts` byte-checks only
the fenced block, never the prose.

**Fix:** replace the sentence with the shipped rule.

```markdown
The claim is made ONLY about a manifest that was actually READ, and it is
judged against the manifest the plugin's OWN marketplace record names
(INV-01) -- on the cross-scope orphan fold that is the project-side record's
manifest, even though the row renders under the user-scope header. A
manifest-read failure claims nothing: a same-scope failure renders the bare
`(failed)` marketplace header (BOUND-01), and a folded row whose own manifest
failed to read keeps its bare `(installed)` form (BOUND-03 / D-95-05). Which
manifest a folded row should describe at all is open (BOUND-01 / BOUND-02).
```

## Info

### IN-10: `ScopedManifest.loadError` is now write-only

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:865-867`, `:905`

The rewrite kept the error payload on the `ok: false` arm, but no consumer
reads it: `buildMarketplaceMessage` tests `!scopedManifest.ok` (`:968`),
`manifestLookupFor` tests `!scopedManifest.ok` (`:881`), and the `(failed)`
marketplace header carries no cause trailer by catalog contract. So
`errorMessage(err)` is computed and discarded on every failed manifest read.
The pre-rewrite shape had the same property (it only ever tested
`loadError !== undefined`), so this is inherited, not introduced — but the
commit that rewrote the type is the natural place to resolve it.

**Fix:** either drop the field (`{ readonly ok: false }`) so the type stops
promising a diagnostic it never delivers, or route it somewhere an operator can
see it — `debug-log.ts` is the low-risk option, since the catalog forbids a
marketplace-level cause trailer here.

### IN-11: `seedMarketplace`'s `scopeRoot` parameter is now redundant with its hardcoded scope

**File:** `tests/orchestrators/plugin/list-manifest-absent.test.ts:100-110`, `:145-146`

8c3656b9 hardcoded `const scope = "user"` inside the helper but kept
`scopeRoot` as a caller-supplied parameter. All 12 call sites pass
`path.join(home, ".pi", "agent")`, which is exactly
`locationsFor("user", cwd).scopeRoot` — a value the helper already computes one
line later. The parameter is therefore a silent-divergence hazard: a future
caller passing a different root would write the marketplace tree somewhere the
state file's `marketplaceRoot` does not point, and the failure would surface as
a confusing `(failed)` header rather than a helper error.

**Fix:** drop the parameter and use `locations.scopeRoot`:

```ts
const locations = locationsFor("user", cwd);
const mpRoot = path.join(locations.scopeRoot, "marketplaces", mpName);
```

`seedFoldedProjectClone` is unaffected — it takes an explicit
`marketplaceRoot` because sharing the user root is the point of the fold
fixture.

### IN-12: `loadManifestSoftly` is a pass-through whose doc comment describes behavior it does not implement

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:262-269`

```ts
/**
 * Per-marketplace manifest load. Wraps `loadMarketplaceManifest` so a thrown
 * error becomes a `(failed)` MarketplaceNotificationMessage ...
 */
async function loadManifestSoftly(manifestPath: string): Promise<MarketplaceManifest> {
  return loadMarketplaceManifest(manifestPath);
}
```

The function catches nothing and softens nothing; the softening lives in
`loadMarketplaceManifestSoftly` (`:898-907`), whose near-identical name now sits
at the center of the authority model this phase rewrote. Reading the new
`ScopedManifest` plumbing means disambiguating two ten-character-apart names,
one of which is a no-op. Pre-existing, but adjacent to every line the fix pass
touched.

**Fix:** inline `loadMarketplaceManifest(mpRecord.manifestPath)` into
`loadMarketplaceManifestSoftly` and delete the wrapper.

---

_Reviewed: 2026-08-08T22:40:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard (iteration 3)_
