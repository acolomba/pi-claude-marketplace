---
phase: 99-post-audit-tech-debt-closure
reviewed: 2026-08-10T00:00:00Z
depth: standard
iteration: 2
diff_base: 5c5f981e
files_reviewed: 14
files_reviewed_list:
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/architecture/manifest-lookup-drift.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/plugin/update.test.ts
  - tests/orchestrators/reconcile/plan.test.ts
findings:
  critical: 0
  warning: 3
  info: 6
  total: 9
status: issues_found
---

# Phase 99: Code Review Report — iteration 2 (fix review)

**Reviewed:** 2026-08-10
**Depth:** standard
**Diff:** `5c5f981e..HEAD` (6 fix commits + 1 docs commit, 14 files, +710/-186)
**Status:** issues_found

## Gates run for this review

Run directly, exit code read from the shell, not through a pipe:

| Gate | Command | Exit |
|---|---|---|
| typecheck | `npm run typecheck` | 0 |
| lint | `npm run lint` | 0 |
| catalog + drift gates | `node --test tests/architecture/catalog-uat.test.ts tests/architecture/manifest-lookup-drift.test.ts tests/orchestrators/reconcile/plan.test.ts` | 0 (46/46) |
| update suites | `node --test tests/orchestrators/plugin/update.test.ts tests/orchestrators/marketplace/update.test.ts` | 0 (153/153) |

Two isolated `tsc` probes were run against a scratch file (outside the repo, no
source modified) to verify the `?: never` pins behave as the fixer claims; both
results are quoted under WR-01 below.

## Summary

The fix pass is substantially sound. The critical finding is genuinely closed —
both row forms of the `updated` partition now have exactly one producer, and I
verified by grep that no other `status: "updated"` / `status:
"partially-installed"` plugin-row literal exists on the update path. The two
refutations both hold: I re-ran the fixer's regex claims against the actual
patterns and both are correct, and the anchor the iteration-1 review proposed
really does miss `= mp.plugins[plugin]`, `= rec`, `= r`.

The new leaf module is a real leaf: `../types.ts` has **zero** runtime exports
(`grep '^export \(const\|function\|class\|enum\)'` returns nothing), so
`update-row.ts`'s only runtime edges are two `shared/` leaves.

What the pass did not do is install any gate behind its own structural fixes.
WR-03's module-graph fix rests entirely on future authors not re-adding the
import — and the repository has **no** `import-x/no-cycle` rule at all, despite
`ARCHITECTURE.md` claiming one enforces exactly this. And the WR-02 fix's
benefit silently evaporates if `disabledPinProjection` ever becomes
order-unstable, a property iteration 1 flagged (IN-03) and this pass left
unfixed while adding a second consumer that depends on it.

Two comments in the new surface assert properties the code does not have — the
same defect class as iteration-1's WR-05, one level down.

## WR-02 referral — verdict

**ACCEPT the change. It does not violate a stated invariant, and "the next
update writes it" is a sound recovery story.**

Reasoning, with the load-bearing evidence:

1. **The staleness the pre-lock compare introduces is not a new class.** The
   in-transaction guard was never fully TOCTOU-safe either. Both callers derive
   the `next` side from `nextDisabledPin(preflight, …)`
   (`orchestrators/plugin/update.ts:1458`), and `preflight.installable` /
   `preflight.toVersion` were produced by `preflightUpdate`
   (`:997`–`:1176`) **outside any lock** — `loadState` at `:1001`,
   `resolveUpdateCandidate` at `:1122`. So the in-lock comparison is live only
   about the *record*, never about the *resolution*. The pre-lock compare widens
   an already-open window rather than opening a new one.

2. **The failure mode is a deferred idempotent refresh, which is exactly what
   NFR-3 asks for.** The skip is fail-clean: no partial write, no lock, no state
   mutation. Re-running `/claude:plugin update` re-derives everything from
   scratch. Nothing requires a Pi restart, so NFR-2 holds.

3. **It cannot strand a record indefinitely in any structural sense.** The
   record only ever refreshes on an update, before and after this change. The
   only way to reach the skip is for the pre-lock snapshot to *already* match
   the freshly-derived pin, which means a concurrent writer had to move it
   between `loadState` and the compare — and every writer that can move it
   (`install`, `update`, `enable`, `reconcile`) writes a manifest-coherent
   value, not garbage. `disable` preserves `compatibility` by contract
   (`enable-disable.ts`, ENBL-02). The worst case is one deferred refresh, and
   the deferral is bounded by the next update of that plugin.

4. **The regression it prevents is real and worse.** `updatePlugins`'s catch
   fires `notifyDirectFailure` and `return`s, so a `StateLockHeldError` on one
   disabled plugin aborts every target after it in the batch. Trading a
   deferred idempotent write for the loss of a whole batch is the right trade.

Two conditions on the accept, filed as findings below: the comment claiming the
in-lock compare is "TOCTOU-safe" overstates (WR-07), and the whole benefit is
contingent on the projection staying order-stable (WR-08).

## Iteration-1 findings confirmed CLOSED

| ID | Verdict | Evidence |
|---|---|---|
| **CR-01** | Closed | `grep 'status: "partially-installed"'` and `grep 'status: "updated"'` over `extensions/` show `update-row.ts:109` / `:121` as the only producers reachable from the `updated` partition; `install.ts:1840`, `list.ts:488`, `enable-disable.ts:1035`, `reconcile/notify.ts:562,622` belong to other verbs; `marketplace/update.ts:990,1039` are marketplace-level rows, not plugin rows. Emit order matches `install.ts:1786-1848` (orphan rewake → malformed → dropped). Catalog state + byte fixture added in **both** directions (`catalog-uat` forward walk at `:4576` and inverse walk at `:4818` both green). |
| **WR-01** (structural) | Closed | `tsc` probe: `enableRowDependencies(o: PluginUpdateUpdatedOutcome)` now `error TS2379`. Second probe confirms `unsupported: ["lspServers"]` on the outcome is `error TS2322: Type 'string[]' is not assignable to type 'never'`. A third probe shows a plain `{ stagedAgents: true }` still compiles, so the enable/reconcile callers are untouched. The pins do **not** make a future value unrepresentable: a member added to `LedgerDegradationSignals` tomorrow arrives unpinned, which is the inheritance's stated purpose. No consumer anywhere reads `.unsupported` / `.stagedAgents` / `.stagedMcpServers` off an update outcome (`grep` returns only enable/reconcile sites). |
| **WR-01** (render) | Closed | `installable.orphanRewake` is present on **both** `MaterializablePlugin` arms (`domain/resolver.ts:445`, spread by `materializableFields` into `installable` and `partiallyAvailable` alike), so `update.ts:2142` reads a field that genuinely exists on the update path. Rendered at `update-row.ts:102` for both row forms, with a byte test (`tests/orchestrators/plugin/update.test.ts`, WR-01 / SURF-05). |
| **WR-03** | Closed (see WR-06 for the caveat) | `update-row.ts`'s only value imports are `shared/notify-reasons.ts` and `shared/probe-classifiers.ts`; `../types.ts` is `import type` and has no runtime exports, so it erases. `marketplace/update.ts` has exactly one `../plugin/` import (`:125`, the leaf). No stale re-export of `updatedRowFromOutcome` survives in `plugin/update.ts`. |
| **WR-04** | Closed | Six restorations, each verified against RLD-04's definition (`.planning/milestones/notification-refactor-REQUIREMENTS.md:30`, "`present` collapses into `installed` — its only role was reload suppression, now handled by `needsReload: false`"): `list.messaging.ts:37`, `list.ts:29`, `:104`, `:1103`, `:1204`, `notify.ts:459`. All six are about that exact sentence. See IN-10 for the seventh. |
| **WR-05** | Closed — **both refutations verified sound** | (a) The proposed anchor `=\s*(?:\w*[Rr]ecord\w*\|\w*[Pp]lugin\w*)\b` does **not** match `= mp.plugins[plugin];` — `\w*` cannot cross the `.`, so no backtrack reaches `[Pp]lugin`; nor `= rec;` nor `= r;`. The fixer is right that it is a naming heuristic that walks past real record-axis twins. (b) `function f({ scope, enabled }: Args = defaults)` does **not** match `/\{[^{}]*\benabled\b[^{}]*\}\s*=(?![=>])/` — after `}`, `\s*` matches empty and the next character is `:`, not `=`. The iteration-1 report's second over-reach example was wrong. The `DELIBERATE_OVER_REACH` list is the right shape of fix: the reach is now data the gate asserts, not prose. |
| **IN-05** | Closed | The inline `dependencies` const is gone from `marketplace/update.ts`; `outcomeDependencies` is file-private in `update-row.ts:142` and feeds both row forms. One spelling. |

## Iteration-1 findings still OPEN (not addressed, no regression)

`IN-01` (the non-deduplicating `Set` in `collectDegradedKinds`), `IN-02` (the
`wrote &&` gate narrowing the clone GC sweep), `IN-04` (three hand-rolled
`(updated)` render maps, only two cross-pinned). `IN-03` is escalated below as
WR-08 because the WR-02 fix added a second consumer that depends on the
property IN-03 says is unproven.

---

## Warnings

### WR-06: WR-03's module-graph fix has no gate — the repository has no cycle rule at all

**File:** `eslint.config.js:181-240`, `extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts:13`
**Bears on:** D-11, D-05, D-06

**Issue:** `update-row.ts`'s header states the fix's durability claim:

> A leaf with no back-edges cannot close that cycle whatever either ledger grows into next.

That is true of `update-row.ts` and false of the thing WR-03 actually flagged.
Nothing prevents a future author from adding
`import { x } from "../plugin/update.ts";` back into `marketplace/update.ts`
next week and re-creating the exact edge this commit removed.

`ARCHITECTURE.md` asserts the guard exists — "enforced by
`eslint-plugin-import-x`'s no-cycle rule". I checked: `eslint.config.js`
configures exactly two `import-x` rules, `import-x/order` (`:55`) and
`import-x/no-restricted-paths` (`:181`). There is **no** `no-cycle` rule
anywhere in the flat config, and the `no-restricted-paths` zone list has no zone
for the intra-`orchestrators/` direction (its zones only separate
`edge`/`orchestrators`/`bridges`/`domain`/`transaction`/`persistence`). Nor does
`tests/architecture/import-boundaries.test.ts` cover it.

Concrete failure: re-add the removed import; `npm run lint` exits 0, `npm run
typecheck` exits 0, and every test passes. The finding WR-03 closed is
re-openable with no signal.

This is the repo's own house pattern being skipped — `no-orchestrator-network`,
`import-boundaries`, `catalog-uat`, `manifest-lookup-drift` are all
source-grep architectural tests guarding exactly this class of invariant.

**Fix:** add a grep gate beside the existing ones, e.g. in
`tests/architecture/import-boundaries.test.ts`:

```ts
// D-05 / D-11: marketplace/ reaches the plugin verbs only through the
// injected `pluginUpdate` seam and the leaf row composers. A static import of
// a plugin LEDGER module drags the ledger's whole graph in and re-opens the
// marketplace <-> plugin cycle `orchestrators/types.ts` exists to prevent.
const FORBIDDEN_LEDGER_EDGE = /from\s+"\.\.\/plugin\/(install|update|uninstall|reinstall|enable-disable)\.ts"/;

test("D-11: no orchestrators/marketplace file imports a plugin LEDGER module", async () => {
  for (const rel of await marketplaceSourceFiles()) {
    assert.doesNotMatch(
      stripComments(await readFile(path.join(REPO_ROOT, rel), "utf8")),
      FORBIDDEN_LEDGER_EDGE,
      `${rel}: import the leaf composer (plugin/update-row.ts) or the injected seam, not the ledger.`,
    );
  }
});
```

Non-global regex, per the project's own `lastIndex` rule.

### WR-07: `refreshDisabledRecord`'s "TOCTOU-safe authority" comment overstates what the in-lock compare knows

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1536-1538`, `:1496-1497`
**Bears on:** D-99-05a, NFR-3

**Issue:** The WR-02 fix leans its whole safety argument on one sentence:

> Re-derived against the LIVE record: `disabledRefreshWouldWrite` asked the same question of the pre-lock snapshot to decide whether to open this transaction at all, but only this comparison is TOCTOU-safe.

and, at the pre-lock site:

> The snapshot is read outside the lock, so this answer is advisory: the in-transaction guard re-derives it against the LIVE record and remains the TOCTOU-safe authority for whether the write happens.

Only the `current` half of that comparison is live. The `next` half is
`nextDisabledPin(preflight, sRecord.resolvedSha)` — and `preflight.installable`
and `preflight.toVersion` were resolved by `preflightUpdate` **outside the
lock** (`loadState` at `:1001`, `resolveUpdateCandidate` at `:1122`,
`deriveUpdateToVersion` at `:1147`). Only `shaFallback` differs between the two
callers, which the `nextDisabledPin` doc comment states correctly and the
"TOCTOU-safe" sentence then contradicts.

Concrete consequence: the in-lock guard cannot detect that the marketplace
manifest moved after the resolve. It will happily write a pin derived from a
manifest revision that is already superseded, under a lock that says nothing
about it. That is acceptable (see the WR-02 verdict), but a reader who trusts
this comment and builds a stronger guarantee on top of it — say, a caller that
skips its own re-resolve because "the transaction is authoritative" — inherits a
guarantee that does not exist.

**Fix:** scope the claim to what it covers.

```ts
// Re-derived against the LIVE record, which `disabledRefreshWouldWrite` could
// only see as a pre-lock snapshot. Note the asymmetry: only the CURRENT half
// is live. The NEXT half comes from `preflight`, resolved outside this lock,
// so this guard is authoritative about the RECORD and no fresher than the
// preflight about the RESOLUTION.
```

### WR-08: the WR-02 skip is silently contingent on `disabledPinProjection` being element-order-stable

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1406-1424` (projection), `:1497-1507` (the new pre-lock consumer)
**Bears on:** RECON-05, D-99-05a, NFR-3 — escalated from iteration-1 IN-03

**Issue:** `disabledPinProjection` stringifies `compatibility.notes`,
`.supported` and `.unsupported` in whatever order the resolver emitted them. The
in-transaction guard has always depended on that; the WR-02 fix now makes the
*performance and concurrency* behaviour depend on it too, and that second
dependence fails silently.

Concrete failure: if any of the three lists ever becomes set-derived, or gains a
`Promise.all`-ordered or filesystem-`readdir`-ordered contributor, then
`next.projection !== current` is true on **every** run of **every** disabled
plugin. `disabledRefreshWouldWrite` returns `true`, the `retries: 0` scope lock
is acquired on every pass, and the batch-abort regression the WR-02 commit
exists to prevent quietly returns — with the in-lock guard also failing, so
`updatedAt` and `state.json`'s mtime get bumped on every update as well
(the RECON-05 no-write property IN-03 named). No test fails: the new WR-02 test
seeds a single path-source plugin whose lists happen to be deterministic today,
so it proves the fix for that fixture and nothing about the property the fix
rests on.

The lists are deterministic *today* — `UNSUPPORTED_COMPONENT_PROBES` is an
object literal and `notes` / `supported` are pushed in code order — so this is a
latent contingency, not a live bug. But it is now load-bearing for two
behaviours instead of one, and it is documented nowhere.

**Fix:** make the projection order-insensitive. The three arrays are compared,
never rendered, so ordering carries no information here:

```ts
return JSON.stringify([
  version,
  resolvedSource,
  resolvedSha ?? null,
  compatibility.installable,
  // Sorted, not copied: these are COMPARED, never rendered, so a resolver
  // whose emit order changes must not read as a move. Without this both the
  // RECON-05 no-write guard and the WR-02 lock-free skip fail open, silently.
  [...compatibility.notes].sort(),
  [...compatibility.supported].sort(),
  [...compatibility.unsupported].sort(),
]);
```

Add a unit test that permutes the three arrays and asserts the projection is
unchanged.

---

## Info

### IN-06: the new `update-orphan-rewake` catalog section's multi-signal example cannot render on the row form it documents

**File:** `docs/output-catalog.md:987`
**Issue:** The section documents an `(updated)` row and closes with:

> When more than one signal is present they share ONE brace in the install row's emit order: `{orphan rewake, malformed skill, lsp}`.

`lsp` reaches an update row only through `narrowUnsupportedKinds(dropped.kinds)`
(`update-row.ts:114`), and a non-empty `dropped.kinds` selects the
`(partially-installed)` form at `:107`. So that exact brace is unrenderable on
an `(updated)` row; the three-token case always renders
`(partially-installed)`. The sentence is copied verbatim from the enable section
(`docs/output-catalog.md:2287`), where `enable-disable.ts:1013-1035` has the
same structure and the same inaccuracy — so this propagates a pre-existing
error into a new section. `catalog-uat` pins only the fenced block, so catalog
prose drift is entirely unguarded.
**Fix:** either use a two-token example the `(updated)` form can actually
produce (`{orphan rewake, malformed skill}`), or say the three-token case
renders on the `partially-installed` form and point at
`update-degraded-and-dropped`.

### IN-07: the autoupdate surface gained a renderable `{orphan rewake}` token with no catalog state and no test

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:751`, `docs/output-catalog.md:2152-2179`
**Issue:** Populating `orphanRewake` on the update outcome makes the token
renderable on the **autoupdate** cascade too, since `marketplace/update.ts` now
routes both row forms through the same composer. The catalog duplicates
per-surface states where the policy differs
(`autoupdate-partially-installed-already-degraded` / `-newly-degraded` sit
alongside the plugin-update partial states), but no autoupdate orphan-rewake
state or fixture was added, and `tests/orchestrators/marketplace/update.test.ts`
gained only the CR-01 case. Risk is low — the reasons-threading on that render
map is already byte-pinned by the WR-12 test at `:2377` — but the state is new,
unlisted, and untested.
**Fix:** either add the autoupdate fixture + catalog state, or note in the
`update-orphan-rewake` prose that the autoupdate surface renders the identical
row (same token, same info severity) and is covered by the shared composer.

### IN-08: the widened ENBL-05 offender message is emitted for all five patterns, but only applies to one

**File:** `tests/orchestrators/reconcile/plan.test.ts:1013-1019`
**Issue:** The message now appends "…OR, if this is the config-declaration axis,
keep its non-destructured `entry.enabled !== false` spelling (WR-05: the
destructured pattern fails closed onto that axis)" inside the loop over **all**
of `INLINE_REDERIVATIONS`. A hit on `/!\s*[\w.]+\.enabled\b/` or
`BRACKET_ENABLED_ACCESS` — patterns that, per the same comment, *do* carry an
axis anchor and cannot reach the config axis — now gets advice that does not
apply to it.
**Fix:** append the config-axis clause only when the matching pattern is
`DESTRUCTURED_ENABLED_BINDING` (`re === DESTRUCTURED_ENABLED_BINDING`).

### IN-09: `RAW_LOOKUP_BLOCK_BODY` got the fail-closed prose but not the data pin

**File:** `tests/architecture/manifest-lookup-drift.test.ts:100-107`
**Issue:** The new comment makes the same argument the destructured pattern
makes — "a false positive an author reads and dismisses costs less than a copy
that slips through" — and explicitly cross-references it as the "same
fail-closed trade". But the destructured pattern got a `DELIBERATE_OVER_REACH`
list plus a test asserting the reach, on the stated grounds that "a claim about
a gate's reach that only a comment carries is a claim the next edit can silently
falsify". `RAW_LOOKUP_BLOCK_BODY`'s 160-character bridge is still asserted in
prose only. Inconsistent application of the pass's own reasoning.
**Fix:** add the mirrored pin — one literal that the bridge reaches across the
end of a `.find(` call — beside the existing controls in that file.

### IN-10: the seventh RLD-04 site was `PL-4 (RLD-04 / D-08)`, and the parenthetical was load-bearing

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:3766`
**Issue:** The fixer's rationale — the sentence is about the description field
and is already anchored by a live `PL-4` — is defensible, and the original
really was a parenthetical (`c4da8cca` shows `// PL-4 (RLD-04 / D-08):`). But
`installed` appears in that description predicate **because of** RLD-04: the
milestone record says "both PL-4 description predicates were widened to
`installed` so the list row's description second line stays byte-identical (the
former `present` row carried it)"
(`.planning/milestones/notification-refactor-STATE.md:56`). A reader asking
"why is `installed` in this list when cascade `installed` rows never set
`description`?" is asking an RLD-04 question.
**Fix:** restore as `// PL-4 (RLD-04):` — one token, and the `D-08` half stays
dropped as agreed.

### IN-11: comment reflow artifact left mid-sentence

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:1204-1207`
**Issue:** The RLD-04 insertion pushed the tail of the sentence onto a
three-word line: `// transition. The body` followed by `// \`return p.scope ??
marketplaceScope\` preserves…`. Prettier does not reflow comment prose, so this
stays. Cosmetic only.
**Fix:** re-wrap the block to the surrounding width.

---

_Reviewed: 2026-08-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard — iteration 2, fix review_
