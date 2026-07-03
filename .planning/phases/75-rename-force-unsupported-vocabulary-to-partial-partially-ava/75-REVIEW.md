---
phase: 75-rename-force-unsupported-vocabulary-to-partial-partially-ava
reviewed: 2026-07-02T18:58:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - extensions/pi-claude-marketplace/domain/components/hooks.ts
  - extensions/pi-claude-marketplace/domain/index.ts
  - extensions/pi-claude-marketplace/domain/resolver.ts
  - extensions/pi-claude-marketplace/edge/completions/data.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts
  - extensions/pi-claude-marketplace/shared/completion-cache.ts
  - docs/output-catalog.md
  - docs/messaging-style-guide.md
  - CHANGELOG.md
  - tests/architecture/partial-vocabulary-guard.test.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/architecture/notify-closed-set-locks.test.ts
  - tests/architecture/notify-grammar-invariant.test.ts
  - tests/architecture/notify-stamp-coverage.test.ts
findings:
  critical: 0
  warning: 4
  info: 1
  total: 5
status: issues_found
---

# Phase 75: Code Review Report

**Reviewed:** 2026-07-02T18:58:00Z
**Depth:** standard
**Files Reviewed:** 22 (plus tree-wide grep analysis of `extensions/pi-claude-marketplace/**/*.ts`)
**Status:** issues_found

## Summary

Phase 75 is a behavior-preserving 1:1 rename of the `force`/verdict-`unsupported`
vocabulary to `partial`/`partially-available`. **The functional rename is complete
and correct in the CODE.** I verified, against the actual on-disk bytes:

- **Flag plumbing** (`list`/`install`/`update`/`reinstall` handlers + `shared.ts`):
  `--partial` is parsed and threaded; `--force`/`--unsupported` are gone and rejected
  as unknown flags. Orchestrator option fields are renamed to `partial`
  (`InstallPluginOptions.partial` install.ts:275,368; `UpdatePluginsOptions.partial`
  update.ts:200,648) — no `force` option field survives.
- **Status literals / render tokens** (`notify.ts`, `list.messaging.ts`,
  `plugin-state-classifier.ts`, `resolver.ts`, `completion-cache.ts`,
  `completions/data.ts`): fully renamed to `partially-installed` /
  `partially-upgradable` / `partially-available` / `partially-installed-upgradable`.
- **completion-cache schemaVersion 3→4:** all three sites bumped (schema literal
  line 82; poison write line 335; success write line 349); self-heal drop+rebuild
  path intact; no lingering transform. Correct.
- **Out-of-scope homonyms preserved** (over-rename check clean): component-level
  `compatibility.unsupported`, `"unsupported source"` / `"unsupported hooks"`
  reasons, `narrowUnsupportedKinds` / `unsupportedKinds`, the component-level
  ` (unsupported)` hook-event suffix, the `⊖` / `◉` glyph characters, and every
  fs/git `{ force: true }` overwrite call.
- **Invariant tests NOT weakened** (review-focus #5): `catalog-uat` fixtures use the
  new `partially-*` `status` values; `notify-closed-set-locks` length tripwires
  (23/18/etc.) still enforced; `notify-grammar-invariant` `WILL_TOKEN_RE` updated to
  match `(will partially install)`; `notify-stamp-coverage` `TRANSITION_STATUS_LIST`
  uses `"partially-installed"` compile-pinned via `satisfies readonly PluginStatus[]`.

**No BLOCKER-level defects were found: no incorrect behavior, no security gap, no
data-loss risk.** `npm run check` is green and the byte-equality catalog-UAT passes,
consistent with my trace.

**The defect this review surfaces is pervasive rot in the *descriptive* layer.** The
rename was applied to code identifiers, literals, render tokens, and the guarded
double-quoted/paren forms — but NOT to the comments, doc prose, catalog-state
labels, and test fixture prose that describe them. Across ~25 production `.ts` files,
both docs, and the invariant tests, the surrounding narration still names the retired
`force-*` / verdict-`unsupported` vocabulary. Many of these comments now **actively
misdescribe the code** — they name a token, literal, or field the code no longer
emits (e.g. a comment says the classifier "returns `force-upgradable`" when it returns
`"partially-upgradable"`; a doc-comment points at `InstallPluginOptions.force` when the
field is `.partial`). This violates the project comment policy
(`.claude/rules/typescript-comments.md`: comments describe "what the code does") and,
pointedly, the shipped guard test's own stated invariant ("the rename is total (no
aliases, no stale prose)"). The guard test does not catch any of it (WR-02).

## Warnings

### WR-01: Pervasive production comment-rot — comments name the retired vocabulary the code no longer uses

**File:** `extensions/pi-claude-marketplace/**/*.ts` (~25 files; representative + actively-wrong instances below)

**Issue:** Production comments still describe the renamed concepts with the retired
`force-installed` / `force-upgradable` / `force-installable` / `force-degradable` /
`force-materializable` / `force install` and verdict-`(unsupported)` vocabulary.
`grep -a` finds the word `force` in comments across ~25 in-scope production files (in
addition to the ~30 legitimate `{ force: true }` fs/git homonyms). The strongest cases
are comments that name a token, literal, or field **the code no longer produces**, so a
maintainer following them is actively misled:

- `orchestrators/plugin/install.ts:367` — `(see InstallPluginOptions.force)`; the
  field is `InstallPluginOptions.partial` (install.ts:275,368). Points at a nonexistent field.
- `orchestrators/plugin/update.ts:642` — "Set by `updatePlugins` from
  `UpdatePluginsOptions.force`"; the field is `UpdatePluginsOptions.partial`
  (update.ts:200,648).
- `orchestrators/plugin/plugin-state-classifier.ts:33,36,39,62,67,96–108,114–132` —
  describes the return values of `classifyInstalledRecord` as
  `force-installed` / `force-upgradable` / `force-installed-upgradable`; the function
  returns `"partially-installed"` / `"partially-upgradable"` /
  `"partially-installed-upgradable"` (lines 137,140,147,152).
- `orchestrators/plugin/list.ts:413` — "The classifier returns `force-upgradable`
  ONLY when…"; it returns `"partially-upgradable"` (list.ts:417). Also list.ts:129,
  200,357,364,393,397,484,522,556,908,910,1011.
- `orchestrators/plugin/list.messaging.ts:58–61` — the block comment names the two
  `LIST_STATUSES` entries defined immediately below (lines 62–63,
  `"partially-installed"` / `"partially-upgradable"`) as `force-installed` /
  `force-upgradable`. Also lines 51,121.
- `orchestrators/plugin/info.ts:927` — "only `unsupported` maps to force-installed";
  it maps to `partially-installed` (info.ts:938). info.ts:968 — "renders the distinct
  `(unsupported)` / `⊖` token"; the row renders `(partially-available)` (info.ts:1000).
  info.ts:1022 — "`resolveStrict` decides between `(available)`, `(unsupported)`, and
  `(unavailable)`"; the not-installed non-installable arm renders `(partially-available)`.
  Also info.ts:306,348,845,847,924.
- `domain/resolver.ts:18–19,148–149,187,225–227,353,383,415,915,1258` — "force-degradable
  arm", "force-materializable arms", "force-install path", "force degrade the unsupported
  parts" prose throughout the arm/constructor documentation.
- `edge/completions/data.ts:24–33,66–84,392–399` — the (mode,`--partial`) filtering
  doc-comments name `unsupported` / `force-installed` / `force-upgradable` /
  `force-installed-upgradable`; the actual status Sets (lines 51–90) use the new
  `partially-*` literals.
- `shared/notify.ts` — 43 `force` references in comments (e.g. 219–234, 403–410,
  689–772, 1182–1186, 1440–1451, 2255–2274, 3511–3546), plus `domain/components/hooks.ts:7`,
  `shared/errors.ts:418`, `shared/probe-classifiers.ts:154`, `shared/concerns/hooks.ts:34`,
  `orchestrators/marketplace/shared.ts`, `orchestrators/marketplace/update.ts:642,661,669`,
  `orchestrators/reconcile/{notify,apply,pending,reconcile.messaging}.ts`,
  `orchestrators/plugin/{reinstall,update,install,install.messaging,update.messaging}.ts`,
  `orchestrators/types.ts:152,194,196`, `edge/completions/provider.ts:98,113,197`,
  `edge/handlers/tools.ts:164–166,178,324,402`.

**Fix:** Update the comments/prose in lockstep with the code they describe. The
mechanical substitutions (mirroring the code rename): `force-installed` →
`partially-installed`; `force-upgradable` → `partially-upgradable`;
`force-installed-upgradable` → `partially-installed-upgradable`;
`force-installable`/`force-degradable`/`force-materializable`/verdict `unsupported`/
`(unsupported)` → `partially-available`/`partial`; `InstallPluginOptions.force` →
`InstallPluginOptions.partial`; `UpdatePluginsOptions.force` →
`UpdatePluginsOptions.partial`. Leave requirement-ID anchors (`FORCE-02`,
`FSTAT-*`, `USTAT-*`) unchanged (they are allowed traceability anchors per
`.claude/rules/typescript-comments.md`), and leave the fs/git `{ force: true }`
overwrite homonyms unchanged.

### WR-02: `partial-vocabulary-guard.test.ts` claims to catch stale prose but structurally cannot — false assurance

**File:** `tests/architecture/partial-vocabulary-guard.test.ts:78-80, 104-143`

**Issue:** The guard's header asserts "the rename is total (no aliases, no stale prose)"
and "Substring tokens catch comments too", but its ABSENT tokens are only the
double-quoted-literal (`'"force-installed"'`, `'"(unsupported)"'`), bare-paren-render
(`(force-installed)`, `(will force install)`), and camelCase-identifier
(`ICON_FORCE_INSTALLED`, `forceHint`, …) forms — the exact forms that appear in *code*.
It does **not** check the backtick/prose forms (`` `force-installed` ``,
`` `(unsupported)` ``, `force-degradable`, `InstallPluginOptions.force`) that pervade the
*comments*. This is precisely why every WR-01 / WR-03 / WR-04 instance passes the guard.
Two concrete gaps:

1. `'"(unsupported)"'` (double-quoted) does not match the comment form
   `` `(unsupported)` `` at `info.ts:968,1022` — the guard is green while those
   verdict-`(unsupported)` comments survive.
2. `'"force-installed"'` (double-quoted status literal) does not match the backtick
   prose `` `force-installed` `` that appears in dozens of comments.

Additionally, `collectExtensionSources()` walks only `extensions/pi-claude-marketplace`
(line 24), so the stale docs prose, the 13 stale `catalog-state:` labels, and the
invariant-test prose (WR-03/WR-04) are entirely unguarded.

**Fix:** Either narrow the header comment to describe what the guard actually enforces
(code-form literals/identifiers only — drop the "no stale prose" / "catch comments too"
claims), OR add regex-based prose assertions for the retired vocabulary that exclude the
out-of-scope homonyms. For example, forbid the word `force` except in the
`force:\s*true` / `options?.force` / `platform/git.ts` / requirement-ID-anchored contexts,
and forbid `(unsupported)` in `extensions/` except the leading-space component suffix
in `shared/concerns/hooks.ts`. Consider extending the scan to `docs/` and the invariant
tests if those surfaces are meant to be covered.

### WR-03: Documentation rot — output-catalog.md and messaging-style-guide.md prose/labels describe the retired vocabulary

**File:** `docs/output-catalog.md` (30 lines) and `docs/messaging-style-guide.md:65,68,80`

**Issue:** The rendered bytes inside the catalog fences are correctly updated to
`(partially-installed)` / `(partially-upgradable)` / `(partially-available)` (byte-equality
holds), but the surrounding *contract prose* and the state labels are stale:

- `docs/output-catalog.md:343` references the glyph const as `` (`ICON_FORCE_INSTALLED`) ``;
  the actual const is `ICON_PARTIALLY_INSTALLED` (imported in `list.messaging.ts:4`).
  Points at a const name the guard test forbids in code.
- `docs/output-catalog.md` prose lines 12, 137, 165, 194, 343 describe
  "force-installable" / "derived `force-installed` / `force-upgradable`" / plugins that
  "resolve `unsupported`".
- 13 `<!-- catalog-state: STATE -->` labels still use the retired vocabulary:
  `force-installed-inventory`, `force-installed-inventory-hooks`,
  `force-upgradable-inventory`, `success-force-installed-with-soft-dep`,
  `failure-unsupported-features`, `decline-force-upgradable-targeted`,
  `skip-force-upgradable-bulk`, `add-unsupported-source`, `mp-add-plugin-force-install`,
  `backfill-force-installed`, `backfill-force-installed-no-reasons`,
  `autoupdate-force-installed-already-degraded`, `autoupdate-force-installed-newly-degraded`
  (these are coupled 1:1 with the `catalog-uat.test.ts` fixture keys, so renaming both
  in lockstep keeps the byte-equality gate green).
- `docs/messaging-style-guide.md:65,68,80` list `unsupported` as a current
  `PluginNotificationMessage` variant name in the field-carve-out prose; the variant is
  `partially-available` (`PluginPartiallyAvailableMessage`, correctly named at line 43).

**Fix:** Apply the same substitutions as WR-01 to the doc prose; update
`ICON_FORCE_INSTALLED` → `ICON_PARTIALLY_INSTALLED` at output-catalog.md:343; and rename
the 13 `catalog-state:` labels together with the matching `catalog-uat.test.ts` fixture
keys. (Note: the CHANGELOG is correct — the `[Unreleased]` entry documents the rename
precisely, and the historical `[0.7.0]` entry correctly retains the old vocabulary as
append-only history; do not touch historical entries.)

### WR-04: Invariant/architecture test comment, label, and fixture-key rot

**File:** `tests/architecture/catalog-uat.test.ts` (header 259-278; fixture keys/comments
681,711,736,883,911,1684,1724), `notify-closed-set-locks.test.ts:34-46`,
`notify-grammar-invariant.test.ts:184,195-200,232`, `notify-stamp-coverage.test.ts:61-65`,
`notify-will-reload-agreement.test.ts:195-200`

**Issue:** Per review-focus #5, the invariant-test *assertions* are correctly updated and
NOT weakened or disabled (confirmed above). However, the same files carry stale
`force`/verdict-`unsupported` vocabulary in their explanatory comments, fixture labels,
and — in `catalog-uat.test.ts` — the fixture state-KEY identifiers
(`force-installed-inventory`, `success-force-installed-with-soft-dep`,
`failure-unsupported-features`, `decline-force-upgradable-targeted`,
`skip-force-upgradable-bulk`). Examples: the `catalog-uat` header (line 268) says the row
"renders `force-installed`" though the modeled `status: "partially-installed"` renders
`(partially-installed)`; `notify-closed-set-locks.test.ts:34,43` explains the counts as
"+2 for `force-installed` / `force-upgradable`" and "+1 for `unsupported`";
`notify-grammar-invariant.test.ts:184` labels the `partial: true` fixture "will force
install (force modifier set)". None affect correctness, but the narration misdescribes the
data the tests now assert on.

**Fix:** Update the test comments/labels to the `partially-*` vocabulary and rename the
`catalog-uat` fixture state keys together with the matching `output-catalog.md`
`catalog-state:` labels (WR-03), in one change, so the byte-equality gate stays green.

## Info

### IN-01: Internal resolver constructor still named `unsupported()` while it builds the `partially-available` state

**File:** `extensions/pi-claude-marketplace/domain/resolver.ts:417`

**Issue:** The private helper `function unsupported(name, pluginRoot, partial)` returns
`{ state: "partially-available", … }` (line 422) and is invoked at line 1162. The name is
now inconsistent with the state it constructs. It is internal-only and green under
`npm run check`; `unsupported` is also the (out-of-scope, preserved) component-level term,
so the carryover is defensible — noting it because a maintainer scanning for the
`partially-available` constructor would not expect it under `unsupported()`.

**Fix (optional):** Rename to `partiallyAvailable()` for symmetry with the `installable()`
/ `unavailable()` sibling constructors, or add a one-line comment clarifying that this
constructor emits the `partially-available` verdict. Not required for correctness.

---

_Reviewed: 2026-07-02T18:58:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
