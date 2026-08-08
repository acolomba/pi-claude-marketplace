---
phase: 95-manifest-independent-installed-inventory
reviewed: 2026-08-08T20:05:00Z
depth: standard
iteration: 2
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
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 95: Code Review Report

**Reviewed:** 2026-08-08T20:05:00Z
**Depth:** standard (iteration 2, post-fix)
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Re-reviewed the full diff `60123d33^..HEAD`, including the five fix commits
(89334294, 76d8440a, d093b465, 43d62143, 46a0efa6), for INV-01..05 and
BOUND-03.

**Verification of the prior iteration's findings — all four addressed:**

| ID | Claim | Verdict |
| --- | --- | --- |
| CR-01 | `partially-upgradable` reasons dropped on the tool payload | **Fixed.** `tools.ts:380-390` now includes `partially-upgradable`; `tests/edge/handlers/tools.test.ts:777-808` proves the candidate's `lsp` kind reaches `details.plugins[0].reasons` and could not have come from `record.compatibility.unsupported` (empty for that fixture). |
| WR-01 | Fold-path absence claim not gated on manifest identity | **Fixed** via `ownsAbsenceClaim` (`list.ts:849-882`, `list.ts:1065-1068`) with a regression test at `list-manifest-absent.test.ts:643-677`. See WR-05 below for the residual behavior this fix chose not to cover. |
| WR-03 | New row forms missing from the byte-frozen catalog | **Fixed.** `docs/output-catalog.md:403-424` adds both states and `tests/architecture/catalog-uat.test.ts:834-885` byte-pairs them; the info-severity arm (no second `ctx.ui.notify` arg) is asserted by the driver's `else if (callArgs.length !== 1)` branch. |
| WR-04 | Unexercised fixture params | **Mostly fixed** (76d8440a). Residual instances remain — see IN-08. |
| WR-02 | Stale `shared/notify.ts` comments | **Out of scope by record** (95-CONTEXT.md; Phase 98 DOC-08). Not re-reported. |

**Gates run in the worktree:** `tsc --noEmit` clean; ESLint clean on all six
`.ts` files; 46/46 in `list-manifest-absent.test.ts`, and
`tests/{orchestrators,docs,integration,edge,architecture,shared}` at 1656 pass /
2 fail. The two failures are
`tests/integration/provenance-invisibility.test.ts` and its sibling — the known
global-`pi-subagents`-peer environment failures, not branch regressions.
`prettier --check` flags `docs/output-catalog.md`, but only for pre-existing
`______`-vs-`---` thematic breaks that `mdformat` owns; `format:check` globs
`**/*.{js,json,ts}` only, so markdown is not gated. No secret, injection,
path-traversal, network, or `ctx.ui.notify`-bypass exposure exists in this diff
— it is a read-only inventory path over `state.json` plus a closed-set reason
token.

The remaining findings are behavioral gaps the fix pass introduced or left
behind, not regressions of what it fixed.

## Warnings

### WR-05: The claim-authority gate SUPPRESSES rather than RE-EVALUATES, producing an INV-01 false negative and leaving two other facts unauthenticated

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:790-797`, `:849-882`, `:1065-1068`
**Severity:** WARNING

`ownsAbsenceClaim` answers "is the record's own manifest the one the block
header names", and when the answer is no the code drops the brace. It does not
re-evaluate membership against the authoritative manifest. Two consequences,
both reproduced against the current HEAD:

**(a) INV-01 false negative.** Same `marketplaceRoot`, two different
`manifestPath` values, and BOTH manifests load cleanly and BOTH omit the
record. The plugin is genuinely absent from the block's marketplace, yet the
brace is suppressed:

```text
● mp1 [user]
  ● alpha [project] v1.0.0 (installed)
```

REQUIREMENTS.md INV-01 asks for `{not in manifest}` whenever a record is absent
from a successfully-loaded manifest. Here it is absent from two of them and the
row states nothing. The suppression is fail-safe (no false claim), which is why
this is a WARNING rather than a BLOCKER, but the signal INV-01 exists to
deliver is lost in exactly the configuration WR-01 was raised about.

**(b) The non-authoritative manifest is still trusted for `(upgradable)` and
`description`.** Same shape, but `other.json` declares `alpha` at `9.9.9` with
`description: "FOREIGN-DESC"` while the block's own `marketplace.json` declares
`alpha` at `1.0.0` with `"USER-DESC"`:

```text
● mp1 [user]
  ● alpha [project] v1.0.0 (upgradable)
    FOREIGN-DESC
```

`manifestEntry` (`list.ts:790`) is computed from the same `manifest` the
authority check just disqualified, and it drives both the PL-5 version compare
(`list.ts:382-383`) and the PL-4 `descriptionField` (`list.ts:392-393`). The
row therefore asserts an upgrade path and a description sourced from a manifest
the header does not name, while refusing to assert absence from it. Trusting
one value for two claims and distrusting it for a third is not a coherent
authority model.

**Fix:** evaluate membership against the authority instead of gating on
identity — thread the authority manifest (already loaded for the user block)
into `enumerateMarketplacePlugins` and compute `manifestEntry` from it for
folded rows, so `notInManifest`, `upgradable`, and `description` all derive
from one authoritative source:

```ts
// enumerateMarketplacePlugins
const authority = scopedManifest.ownsAbsenceClaim ? scopedManifest : blockManifest;
const manifestEntry = authority.manifest?.plugins.find((p) => p.name === pluginName);
const notInManifest = authority.loadError === undefined && manifestEntry === undefined;
```

If the current suppress-only behavior is the intended trade-off, record it as a
decision (D-95-05 covers only the load-error arm) and amend INV-01's text, since
the requirement as written is not met in case (a).

### WR-06: The BOUND-03 load-error regression test is vacuous — it passes on the claim-authority conjunct, not the load-error one

**File:** `tests/orchestrators/plugin/list-manifest-absent.test.ts:569-602`; production condition at `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:796-797`
**Severity:** WARNING

The test named "a folded row whose project-side manifest FAILED to load is
preserved and carries no reason brace" seeds:

- user record `manifestPath` = `<sharedMpRoot>/.claude-plugin/marketplace.json`
  (via `seedMarketplace`, line 155)
- project clone `manifestPath` = `<sharedMpRoot>/.claude-plugin/does-not-exist.json`
  (line 586)

Those strings differ, so `ownsAbsenceClaim` is already `false` at
`list.ts:875` before `loadError` is ever consulted. Deleting
`loadError === undefined` from the conjunction at `list.ts:796-797` leaves this
test — and, from inspection of the fold call graph, the whole suite — green.
The one guard written specifically for the BOUND-03 defect no longer bites.

Worse, the conjunct looks unreachable in production now. Enumeration with a
`loadError` set is only possible on the fold path (`buildMarketplaceMessage`
early-returns the `(failed)` header at `list.ts:944-956` before enumerating),
and on the fold path a load error with `ownsAbsenceClaim === true` means both
records name the same file — which `domain/manifest-cache.ts` serves from one
memoized outcome, so the user block would fail identically and drop the folded
rows into `plugins: []`.

**Fix:** make the fixture isolate the axis it names — give both records the
SAME `manifestPath` and make that path fail to load — then assert whatever the
real behavior is. If the row disappears into the `(failed)` header (the
deferred BOUND-01 case), say so in the test name and demote
`loadError === undefined` to an explicitly-documented defensive conjunct rather
than one a misnamed test pretends to cover.

### WR-07: `installedRowMessage` now takes two parameters that must agree — the exact drift shape the same commit's rationale rejects

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:364-372`
**Severity:** WARNING

The `enumerateMarketplacePlugins` doc comment added by this diff
(`list.ts:764-768`) states the design rule outright:

> A caller that could pass a manifest and a separate consistency flag is the
> drift shape that produced the BOUND-03 defect, so there is one value, not two.

`installedRowMessage` was then given exactly that shape: `manifestEntry`
(param 6) and `notInManifest` (param 7), where `notInManifest === true` is only
valid when `manifestEntry === undefined`. Nothing in the signature or the body
enforces the invariant. A caller passing an entry alongside `true` yields a row
that renders `{not in manifest}` while simultaneously deriving `(upgradable)`
and a `description` from the entry it claims does not exist. There is one call
site today and it is consistent, so this is latent, not live — but the rule the
diff writes down for one function is violated by the next one it edits.

**Fix:** pass the resolution as a single discriminated value, e.g.

```ts
type ManifestLookup =
  | { readonly kind: "declared"; readonly entry: MarketplaceManifest["plugins"][number] }
  | { readonly kind: "absent" }        // manifest read, entry not declared
  | { readonly kind: "unverified" };   // not read, or not this block's manifest
```

so `{not in manifest}` and `manifestEntry`-derived fields cannot disagree by
construction. This also collapses two of the eight positional parameters (see
IN-09).

## Info

### IN-06: `partiallyInstalledReasons`'s stated rationale does not match the fixture that guards it

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:314-318`; mirrored at `tests/orchestrators/plugin/list-manifest-absent.test.ts:401-403`

Both comments justify gating the prepend on `notInManifest` because "this row
form is also reached by a `partially-installed-upgradable` record, which by
definition HAS a manifest entry." The guarding fixture
(`list-manifest-absent.test.ts:380-407`) seeds `remote` at version `1.0.0` with
a manifest entry also at `1.0.0`, so `upgradable` is `false` (`list.ts:382-383`)
and `classifyInstalledRecord` returns plain `partially-installed`, never
`partially-installed-upgradable`. The gate is needed for every *declared*
degraded record, not specifically the upgradable one, and no test in the new
file exercises `partially-installed-upgradable` at all.

**Fix:** restate the rationale as "a declared degraded record must not gain the
brace", and if the `partially-installed-upgradable` arm is worth pinning, add a
fixture whose manifest entry carries a higher version.

### IN-07: The catalog paragraph claims on-disk materialization the list surface never checks

**File:** `docs/output-catalog.md:412`

"The inventory is manifest-independent: the record is materialized on disk, so
the row keeps the clean `(installed)` token" — the row is derived from
`state.json` alone (`enumerateMarketplacePlugins` iterates `mpRecord.plugins`);
no artifact-presence probe runs on the installed arm. In a document that is the
byte contract, the sentence asserts a check that does not exist.

**Fix:** "the record is recorded installed in `state.json`, so the row keeps the
clean `(installed)` token".

### IN-08: Residual unexercised helper surface in the new test file (the WR-04 class)

**File:** `tests/orchestrators/plugin/list-manifest-absent.test.ts:100-163`

After 76d8440a two unexercised knobs remain in `SeedMarketplaceOpts`:

- `manifest?: unknown` is optional and documented as "When provided, written to
  ...", but all 12 `seedMarketplace({...})` call sites pass it, so the
  `if (manifest !== undefined)` branch at line 156 never takes its false arm.
- `scope: "user" | "project"` and `scopeRoot` are `"user"` /
  `<home>/.pi/agent` at all 12 call sites; the `project` arm of the helper is
  never taken (the project clone is seeded by the separate
  `seedFoldedProjectClone`).

**Fix:** narrow `manifest` to required and `scope`/`scopeRoot` to the user case,
or drop `scopeRoot` and derive it from `scope`.

### IN-09: Eight positional parameters on `installedRowMessage`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:364-372`

`installedRowMessage` reached eight positional parameters, four of which are
strings or booleans (`pluginName`, `pluginScope`, `marketplaceScope`,
`marketplaceRoot`, `notInManifest`, `cwd`). `buildMarketplaceMessage` in the
same file (`list.ts:921-930`) already uses the named-args-object convention.
Type differences currently prevent an argument swap from compiling, but two
`Scope` parameters sit adjacent at positions 2 and 3.

**Fix:** convert to a single `args: {...}` object, folding in the WR-07
discriminated lookup.

---

_Reviewed: 2026-08-08T20:05:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard (iteration 2)_
