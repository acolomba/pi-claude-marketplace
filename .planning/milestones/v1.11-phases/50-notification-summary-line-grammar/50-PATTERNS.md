# Phase 50: Notification Summary-Line Grammar - Pattern Map

**Mapped:** 2026-06-08
**Files analyzed:** 5 (3 MODIFY, 1 MODIFY-or-extend, 1 CREATE)
**Analogs found:** 5 / 5 (all in-repo; no RESEARCH-only fallback needed)

This is a surgical, single-module correctness fix plus a lockstep catalog/fixture/test
byte-rewrite. Every analog is an existing site in the SAME files being edited, so the
"analog" here is literally the correct sibling pattern already present in each file. All
RESEARCH.md line numbers and paths were re-verified against live source this session --
**no drift found** (one prose-vs-fixture staleness noted under Notes).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `extensions/pi-claude-marketplace/shared/notify.ts` | utility (notification renderer/dispatcher) | transform (message -> emitted string) | the cascade arm of `notify()` (same file, notify.ts:2324-2336) | exact (in-file sibling) |
| `docs/output-catalog.md` | config (byte-contract fixture doc) | transform (catalog fence == notify() output) | the already-prefixed error/warning cascade fence bodies (same file) | exact (in-file sibling) |
| `tests/architecture/catalog-uat.test.ts` | test (byte-equality + severity gate) | request-response (drive notify(), assert) | itself -- the existing forward-walk driver (catalog-uat.test.ts:2098-2211) | exact (no change to harness; fixtures unchanged) |
| `tests/shared/notify-v2.test.ts` | test (per-variant byte unit) | request-response (drive notify(), assert) | existing summary-prefix byte cases (notify-v2.test.ts:476-479, 540-543) + the existing standalone `marketplace-not-added` test to UPDATE (2735-2751) | exact (in-file sibling) |
| `tests/architecture/notify-grammar-invariant.test.ts` (CREATE) | test (cross-cutting structural invariant) | request-response (drive notify() over a set, assert grammar) | catalog-uat forward-walk harness (catalog-uat.test.ts:74-184, 2098-2211) | role+flow match (peer to catalog-uat) |

## Pattern Assignments

### `extensions/pi-claude-marketplace/shared/notify.ts` (utility, transform)

**Analog:** the cascade arm of `notify()` in the SAME file. The fix unifies the
broken standalone arm onto this correct sibling.

**The DEFECT site to fix** -- `dispatchInfoMessage` tail (notify.ts:2259-2264, VERIFIED):
```typescript
  const severity = computeSeverity(message);
  if (severity === undefined) {
    ctx.ui.notify(body);
  } else {
    ctx.ui.notify(body, severity);   // BUG: body-only, no summary prepend
  }
```
This is the glued-line defect: at error/warning severity it emits the bare row, so the
host `Error:` label glues onto `⊘ ghost-mp [project] (failed) {not added}`.

**The CORRECT sibling pattern to copy** -- cascade arm of `notify()` (notify.ts:2324-2336, VERIFIED):
```typescript
  const severity = computeSeverity(message);
  if (severity === undefined) {
    ctx.ui.notify(withHint);
  } else {
    const summarized = `${buildSummaryLine(message, severity)}\n\n${withHint}`;
    ctx.ui.notify(summarized, severity);
  }
```
The `${summary}\n\n${body}` shape (note the `\n\n` SEPARATE-block join, GRAM-01) is the
target. Per GRAM-04, extract this into ONE shared helper that BOTH arms call (RESEARCH
Pattern 1 sketch `emitWithSummary(ctx, message, body)`), so no standalone path can drift
back to a summary-less emission. The cascade arm passes `withHint`; `dispatchInfoMessage`
passes its rendered `body`.

**The `buildSummaryLine` standalone short-circuit to EXTEND** (notify.ts:1712-1751, VERIFIED;
the short-circuit block is 1720-1732):
```typescript
  if (isInfoKind(message)) {
    switch (message.kind) {
      case "marketplace-info":
      case "plugin-info":
      case "marketplace-info-cascade":
      case "plugin-info-cascade":
      case "marketplace-not-added":
        return "";                       // <-- standalone kinds currently get NO summary
      default:
        assertNever(message);
        return "";
    }
  }
```
Change the `marketplace-not-added` arm to return `` `${operationPhrase(1, "marketplace")} failed.` ``
(= `"1 marketplace operation failed."`) and split `plugin-info` so a FAILED row returns
`` `${operationPhrase(1, "plugin")} failed.` `` (= `"1 plugin operation failed."`), while
non-failed `plugin-info` and the three read-only/cascade kinds keep returning `""` (they
route through the `severity === undefined` arm and never reach the summary path). Narrow
through the SAME `isInfoKind` guard + `assertNever` tail so a future kind is a compile error.

**Helper to REUSE, do not hand-roll** -- `operationPhrase` (notify.ts:1690-1692, VERIFIED):
```typescript
function operationPhrase(count: number, kind: "plugin" | "marketplace"): string {
  return `${count} ${kind} ${count === 1 ? "operation" : "operations"}`;
}
```
Pluralizes correctly; count is hard-`1` for both standalone kinds (one absent marketplace /
one failed plugin row -- see Anti-Patterns). The verb is always `"failed"` (these kinds
compute `"error"`); `buildSummaryLine`'s existing `verb = severity === "error" ? "failed" : "skipped"`
already handles it -- pass the computed severity through.

**Severity routing to READ, do not touch** -- `computeSeverity` standalone arm (notify.ts:1571-1589, VERIFIED):
```typescript
  if (isInfoKind(message)) {
    switch (message.kind) {
      case "marketplace-not-added":
        return "error";
      case "plugin-info":
        return message.plugin.status === "failed" ? "error" : undefined;
      case "marketplace-info":
      case "marketplace-info-cascade":
      case "plugin-info-cascade":
        return undefined;
      ...
```
This already returns `"error"` exactly for the two summary-bearing cases. The new
`buildSummaryLine` arm must mirror this discriminator (`marketplace-not-added` -> marketplace
subject; `plugin-info` with `plugin.status === "failed"` -> plugin subject). Do NOT modify
`computeSeverity` (REQUIREMENTS Out of Scope).

**Type model to narrow against** (VERIFIED):
- `StandaloneKind` / `isInfoKind` (notify.ts:911-935) -- single-source guard.
- `MarketplaceNotAddedMessage` (notify.ts:877-881): `{ kind, name, scope? }` -- no `reasons`.
- `PluginInfoMessage` (notify.ts:751-757) with `PluginInfoRow.status: "...| failed"` (787-794).

**The standalone bodies the new summary prepends ABOVE** (so plan knows the body shapes):
- `renderMarketplaceNotAdded` (notify.ts:2124-2136) -> single row `⊘ <name> [scope?] (failed) {not added}`.
- `renderPluginInfo` (notify.ts:2160-2202) -> MULTI-LINE for a failed row (header + indented `⊘` row + `components: not resolved`). The summary is prepended as its own block: `{summary}\n\n{multi-line body}` (RESEARCH Pitfall 2).

---

### `docs/output-catalog.md` (config, transform)

**Analog:** the error/warning cascade fence bodies elsewhere in the SAME file that ALREADY
carry the `{summary}\n\n{body}` prefix (e.g. any `expectedSeverity: "error"` cascade state),
plus the catalog's own documented prefix discipline (catalog-uat.test.ts:211-221 comment).

**Current broken fence** -- install `missing-marketplace-not-added` (catalog line 380-382, VERIFIED):
````
```text
⊘ ghost-mp [project] (failed) {not added}
```
````
**New two-block form to write:**
````
```text
1 marketplace operation failed.

⊘ ghost-mp [project] (failed) {not added}
```
````

**Current broken multi-line fence** -- `manifest-invalid` (catalog line 1016-1020, VERIFIED):
````
```text
● bad-mp [user] <no autoupdate>
  ⊘ bad-mp (failed) {invalid manifest}
    components: not resolved
```
````
**New two-block form to write:**
````
```text
1 plugin operation failed.

● bad-mp [user] <no autoupdate>
  ⊘ bad-mp (failed) {invalid manifest}
    components: not resolved
```
````

**The ~9 fence bodies to rewrite** (all VERIFIED present at these lines; subject per GRAM-02):

| Catalog line | Section | State | Summary prefix (subject) |
|--------------|---------|-------|--------------------------|
| 381 | install | `missing-marketplace-not-added` | `1 marketplace operation failed.` |
| 437 | uninstall | `missing-marketplace-not-added` | `1 marketplace operation failed.` |
| ~562 / ~572 | reinstall | `missing-marketplace-not-added` / `-absent-from-both` | `1 marketplace operation failed.` |
| ~684 / ~694 | update | `missing-marketplace-not-added` / `-absent-from-both` | `1 marketplace operation failed.` |
| 1016-1019 | marketplace info | `manifest-invalid` (failed `plugin-info`) | `1 plugin operation failed.` |
| 1029 / 1039 | marketplace info | `absent-from-both` / `scope-mismatch-not-added` | `1 marketplace operation failed.` (fixtures are `marketplace-not-added`) |
| ~1143 / 1152 / 1162 | plugin info | `missing-plugin-not-in-manifest` (PLUGIN subj) / two `marketplace-not-added` (MP subj) | plugin vs marketplace per row |
| 1210 / 1220 | marketplace remove | `remove-missing-not-added` / `-bare` | `1 marketplace operation failed.` |
| ~1311 / ~1321 | marketplace update | `update-missing-not-added` / `-absent-from-both` | `1 marketplace operation failed.` |
| ~1377 / ~1387 | autoupdate\|noautoupdate | `autoupdate-missing-not-added` / `-bare` | `1 marketplace operation failed.` |

**Prose sentences to correct** (each currently ASSERTS the violation as contract; VERIFIED
present at these exact lines): `376`, `432`, `557`, `679`, `1208`, `1218`, `1306`, `1382`.
They read `NO summary line` / `no summary prefix` -- rewrite to state the new two-block
shape. (Line 1382 reads `no summary prefix`; the others vary between the two phrasings.)
Re-grep `NO summary line`/`no summary prefix` after editing to confirm none survive.

> The catalog parser pairs `<!-- catalog-state: STATE -->` with the NEXT fenced block
> (catalog-uat.test.ts:74-132). Only the fence BODY is byte-compared; the prose is not.
> Both must move together for human-doc accuracy, but only fence drift trips the test.

---

### `tests/architecture/catalog-uat.test.ts` (test, request-response)

**Analog:** itself. No harness change and **no FIXTURES data change** (RESEARCH confirms; the
`expectedSeverity: "error"` is already set on every relevant state). After the catalog fence
bodies gain the prefix, this gate passes again and becomes the primary regression lock.

**Driver to leave untouched** (catalog-uat.test.ts:2098-2211, VERIFIED): parses the catalog,
drives `notify(makeCtx(), fixture.pi, fixture.message)`, asserts exactly one
`ctx.ui.notify` call (IL-2), byte-compares `callArgs[0]` to the fence body (lines 2143-2160),
and asserts the severity 2nd arg (lines 2162-2181). The inverse walk (2213-2249) confirms no
orphan fixtures.

**Fixtures the planner can read for the message shapes** (all VERIFIED; do NOT edit data):
- install `missing-marketplace-not-added` (catalog-uat.test.ts:611-619): `{ kind: "marketplace-not-added", name: "ghost-mp", scope: "project" }`, `expectedSeverity: "error"`.
- `manifest-invalid` failed plugin-info (catalog-uat.test.ts:1552-1568): `kind: "plugin-info"`, `plugin.status: "failed"`, `reasons: ["invalid manifest"]`, `componentsResolved: false`, `expectedSeverity: "error"`.
- `absent-from-both` (1517) / `scope-mismatch-not-added` (1533) under marketplace info: `kind: "marketplace-not-added"` -> marketplace subject.
- `missing-plugin-not-in-manifest` (1730) under plugin info: failed `plugin-info` -> plugin subject.

Only `docs/output-catalog.md` (the byte side) changes; this file is the verifier.

---

### `tests/shared/notify-v2.test.ts` (test, request-response)

**Analog:** the existing summary-prefix byte cases in the SAME file, and the existing
standalone-kind tests that must be UPDATED.

**Existing summary-prefix byte case to copy structure from** (notify-v2.test.ts:526-544, VERIFIED) --
the marketplace-only singular form, the closest sibling to the new `marketplace-not-added` case:
```typescript
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `1 marketplace operation failed.\n\n⊘ demo [user] (failed)`,
    "error",
  ]);
```
Other summary-prefix exemplars: line 476-479 (mixed `1 plugin operation and 1 marketplace operation failed.`),
574-576, 593-595, 611-613. The byte-test idiom is: `makeCtx()` (line 151) + `piWith*Loaded()`
(165-186) -> `notify()` -> `assert.deepEqual(...arguments, [expectedString, "error"])`.

**Existing standalone test that must be UPDATED (drift caught -- this is the load-bearing finding):**
the current `marketplace-not-added` byte test (notify-v2.test.ts:2735-2751, VERIFIED) asserts
the OLD glued single-line form and WILL break:
```typescript
  const args = ctx.ui.notify.mock.calls[0]!.arguments;
  assert.equal(args[0], "⊘ my-mp [user] (failed) {not added}");   // <-- OLD; becomes two-block
  assert.equal(args[1], "error");
```
After the fix this must become `"1 marketplace operation failed.\n\n⊘ my-mp [user] (failed) {not added}"`.
The sibling reload-hint test (2753-2770) only asserts absence of `/reload` and stays green
(the summary contains no `/reload`), but re-read it to be safe.

**The 2 NEW byte cases to ADD** (GRAM-02 subject split):
1. A standalone `marketplace-not-added` -> `"1 marketplace operation failed.\n\n⊘ ... (failed) {not added}"` (or repurpose/expand the 2735 test).
2. A standalone failed `plugin-info` -> `"1 plugin operation failed.\n\n{multi-line plugin-info body}"`. NOTE: there is currently **no** failed-status standalone `plugin-info` test in this file (the `plugin-info` tests at 2830/2877 are info-severity installed/available). This case is genuinely new; model its message on the `manifest-invalid` fixture (catalog-uat.test.ts:1552-1568).

> Comment-cleanup policy (MEMORY): new/edited test comments KEEP the GRAM-01..05 requirement
> IDs; strip phase/plan narrative. Existing tests carry `Phase 42` lineage -- prune narrative
> when you touch a comment block but keep the requirement IDs.

---

### `tests/architecture/notify-grammar-invariant.test.ts` (CREATE) (test, request-response)

**Analog:** the catalog-uat forward-walk harness (catalog-uat.test.ts:74-184, 2098-2211).
Reuse its idioms: the `makeCtx()` mock (lines 142-144), the `piWith*Loaded()` factories
(155-174), and the forward driver loop that walks examples, calls `notify()`, and reads
`ctx.ui.notify.mock.calls[0]!.arguments` as `[string, string?]`.

**Invariant to assert** (RESEARCH GRAM-01/04/05): drive `notify()` over the same set the
catalog-uat forward walk uses (or the FIXTURES map), and for EVERY emission whose 2nd
`ctx.ui.notify` arg is `"error"` or `"warning"`:
1. The emitted message's first line is NON-EMPTY (a summary).
2. The first line is followed by `\n\n` and is DISTINCT from the detail block below
   (the first line is NOT a row: it must NOT start with an icon `●`/`○`/`⊘` and must NOT
   contain `(failed)`/`(skipped)`; it must match the summary grammar
   `^\d+ (plugin|marketplace) operation(s)?( and \d+ (plugin|marketplace) operations?)? (failed|skipped)\.$`).

This is the cross-cutting gate that catches a FUTURE standalone error/warning kind that
forgets the summary. **Placement (Open Q1):** RESEARCH recommends `tests/architecture/`
(peer to catalog-uat, cross-cutting structural invariant). Planner's discretion;
`tests/shared/` is also in the `npm test` glob (package.json:76, VERIFIED via the catalog
note). Import surface mirrors catalog-uat.test.ts:42-45:
```typescript
import { notify, type NotificationMessage } from "../../extensions/pi-claude-marketplace/shared/notify.ts";
```

## Shared Patterns

### Single shared summary-emission path (GRAM-04)
**Source:** the cascade arm `${buildSummaryLine(message, severity)}\n\n${body}` (notify.ts:2334).
**Apply to:** BOTH `dispatchInfoMessage` and the cascade arm via one extracted file-private
helper. This is the structural anti-divergence guarantee -- the whole point of the phase.

### Severity-gated prepend (info vs error/warning)
**Source:** `computeSeverity` (notify.ts:1560-1629) -> `severity === undefined` arm emits
body-only; the error/warning arm prepends. **Apply to:** the shared helper -- only the
error/warning branch prepends; the info branch is byte-unchanged (RESEARCH Pitfall 3:
`marketplace-info-cascade` / `plugin-info-cascade` / non-failed `plugin-info` must NOT gain a summary).

### Separate-block join discipline (GRAM-01)
**Source:** `\n\n` join everywhere (notify.ts:2334, 2320; cascade block join 2315).
**Apply to:** the summary->body separation. NEVER `\n` (single newline) -- that re-glues.

### Byte-test idiom
**Source:** notify-v2.test.ts:540-543 / catalog-uat.test.ts:2143-2160.
**Apply to:** the 2 new notify-v2 cases and the invariant test --
`assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [expected, "error"])`, and assert
exactly one `ctx.ui.notify` call (IL-2, catalog-uat.test.ts:2143).

### Helper reuse over hand-roll
**Source:** `operationPhrase` (notify.ts:1690), `computeSeverity` (1560), `isInfoKind` (925).
**Apply to:** the `buildSummaryLine` extension -- compose from existing helpers; introduce
no new formatter, severity check, or kind list.

## No Analog Found

None. Every file edited has an in-repo sibling pattern. The fix is plumbing + a small
`buildSummaryLine` extension + a lockstep doc/test rewrite -- no novel mechanism, no new
dependency. RESEARCH.md `## Code Examples` are real source excerpts, not external patterns.

## Notes / Drift Flags

- **No line-number drift in code.** Every notify.ts citation (dispatchInfoMessage 2229-2265,
  cascade arm 2324-2336, buildSummaryLine 1712-1751 with short-circuit 1720-1732,
  operationPhrase 1690-1692, computeSeverity 1560-1629, isInfoKind/StandaloneKind 911-935,
  renderMarketplaceNotAdded 2124-2136, renderPluginInfo 2160-2202, the type model 751-757 /
  877-881) was re-read and matches RESEARCH.md exactly.
- **No drift in tests/docs.** catalog-uat driver 2098-2211 / inverse walk 2213-2249 / parser
  74-132 / mocks 142-184; notify-v2 summary cases 476/540/574/593/611 and standalone tests
  2735/2753; catalog fences 380-382, 1016-1020, 1028-1030, 1036-1039 and prose lines
  376/432/557/679/1208/1218/1306/1382 -- all verified present.
- **One catalog prose-vs-fixture staleness (informational, not a code defect):** the
  `marketplace info` prose at catalog lines 1024 and 1034 narrates the `absent-from-both` /
  `scope-mismatch-not-added` states as emitted via a `PluginInfoMessage` with `{not added}`,
  but the authoritative catalog-uat FIXTURES (lines 1517, 1533) construct them as
  `kind: "marketplace-not-added"`. Both render the same `⊘ ... {not added}` row, so both take
  the `1 marketplace operation failed.` (marketplace-subject) summary -- consistent with the
  Catalog Map. While rewriting those fence bodies, consider correcting the stale prose
  variant-name too (optional; the byte gate only checks the fence).
- **The "add 2 cases" framing is slightly understated for notify-v2:** beyond ADDING 2 cases,
  the existing `marketplace-not-added` test at 2735-2751 must be UPDATED from the glued form to
  the two-block form, or it will fail. Plan should treat it as update-plus-extend.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/shared/notify.ts`,
`tests/architecture/catalog-uat.test.ts`, `tests/shared/notify-v2.test.ts`,
`docs/output-catalog.md` (all in-repo; the edited files are their own analogs).
**Files scanned:** 4 (every analog co-located with the edit site).
**Pattern extraction date:** 2026-06-08
