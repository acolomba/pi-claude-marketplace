---
phase: 05-production-export-ownership
plan: "23"
subsystem: testing
tags: [dead-code, fallow, notifications, closed-sets, glyphs, type-proofs]

requires:
  - phase: 05-production-export-ownership
    provides: "05-10 / 05-11 / 05-12 closed-vocabulary and validator ownership work"
provides:
  - "Reason, StatusToken, PluginStatus and MarketplaceStatus are bare literal unions with no runtime tuple"
  - "ICON_REMOTE and ICON_PARTIALLY_AVAILABLE are module-private behind renderRemoteRow and renderPartiallyAvailableRow"
  - "emitWithSummary is module-private; composeWithSummary owns the payload and the public entry points own the delivery"
  - "The reason coverage proof is private and folded into the per-kind malformed-reason map's annotation"
  - "The no-expansion gate reads the vocabulary declaration as data, so the catalog-stable order stays asserted"
affects: [05-16, 05-17, 05-18, 05-20, 05-25, 05-28]

actuals:
  tokens: 18775
  tasks: 3
  commits: 4
  plan_head_before: 63b060a2b9945b39d1524a4078977050d15e17e0

tech-stack:
  added: []
  patterns:
    - "A vocabulary nothing iterates is declared as a union; its order is asserted by reading the declaration, its membership by a bidirectional union proof"
    - "A compile-time proof is consumed by the contract it guards rather than exported to silence an unused-type diagnostic"

key-files:
  created:
    - .planning/tdd-evidence/05-23-01.json
    - .planning/tdd-evidence/05-23-02.json
    - .planning/tdd-evidence/05-23-03.json
  modified:
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - tests/shared/notification-types.test.ts
    - tests/shared/notification-grammar.test.ts
    - tests/shared/notification-dispatch.test.ts
    - tests/shared/notification-summary.test.ts
    - tests/shared/notify-reasons.test.ts
    - tests/architecture/closed-set-enrollment.test.ts
    - tests/architecture/notify-closed-set-locks.test.ts
    - tests/architecture/compat-01-no-expansion.test.ts

key-decisions:
  - "The four vocabularies became bare literal unions rather than private `as const` tuples. Privatizing the tuples left four values used only by `(typeof X)[number]`, which the repository's own lint policy rejects and which `notify-reasons.ts` already documents as the wrong shape."
  - "The catalog-stable ORDER is kept by reading the declaration as data in the no-expansion gate. A union carries membership and not order, so the order clause would otherwise have been retired rather than relocated."
  - "The length tripwire counts an exhaustive `Record<Vocabulary, true>` instead of a tuple. The map is bidirectional by construction, so it keeps the count and adds the membership discrimination the count never had."
  - "`composeWithSummary` is the payload half of the privatized emitter and is already public, so the eleven summary cases keep their expected arrays verbatim in their own owner file; only the delivery claim moved to the dispatch owner."
  - "`Proven<T>` folds the reason-partition proof into `MALFORMED_REASON_BY_KIND`'s annotation rather than into a public signature, because a private type in an exported signature is a `private-type-leak` finding."

patterns-established:
  - "Order and membership are separate obligations for a closed vocabulary: read the declaration for one, prove the union for the other, and pair them so neither can green alone."
  - "A privatized constant is pinned through the single public result that carries it, both as the exact byte and as the whole line."

requirements-completed: [EXPORT-01]

coverage:
  - id: D1
    description: "The four notification vocabularies keep their exact members, in their inherited order, with no runtime tuple and no export"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "tests/architecture/compat-01-no-expansion.test.ts#COMPAT-01: the reason vocabulary holds exactly its inherited members, in order"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-types.test.ts#the reason vocabulary names every member once"
        status: pass
      - kind: unit
        ref: "tests/architecture/notify-closed-set-locks.test.ts#OUT-08: Reason is the closed 44-entry reason set"
        status: pass
      - kind: other
        ref: "npm run typecheck (bidirectional IsExact proofs and their five false-asserting controls)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The remote and partially-available glyphs keep their code points and spacing while their constants are module-private"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "tests/architecture/compat-01-no-expansion.test.ts#COMPAT-01: the two module-private glyphs reach the output on their own rows"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-grammar.test.ts#the remote and partially-available glyphs preserve exact values on their rows"
        status: pass
      - kind: unit
        ref: "tests/architecture/compat-01-no-expansion.test.ts#COMPAT-01: the notification grammar owner declares no eighth glyph"
        status: pass
    human_judgment: false
  - id: D3
    description: "The summary payload and its delivery keep their exact messages, severity arguments and one-call-per-invocation ordering while the emitter is module-private"
    requirement: EXPORT-01
    verification:
      - kind: unit
        ref: "tests/shared/notification-summary.test.ts#mixed warning rows emit a plural summary"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-dispatch.test.ts#an unstamped cascade plugin defaults to info severity and a success tally"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/notification-summary.ts (branches 124/124, functions 19/19, lines 631/631)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The reason-partition completeness proof stays compiler-enforced without an export, and fails at the mapping it guards"
    requirement: EXPORT-01
    verification:
      - kind: other
        ref: "npm run typecheck with a reason stripped of its topic home (TS2344 at the proof, TS2322 at the map) and with a stray literal added (same pair)"
        status: pass
      - kind: unit
        ref: "tests/shared/notify-reasons.test.ts#maps a degraded skill to its failure reason"
        status: pass
    human_judgment: false
  - id: D5
    description: "Eight production census identities leave the report with zero additions"
    requirement: EXPORT-01
    verification:
      - kind: other
        ref: "node node_modules/fallow/bin/fallow dead-code --production --no-cache --format json (total_issues 24 -> 16)"
        status: pass
    human_judgment: false

duration: 3h 5m
completed: 2026-09-14
status: complete
---

# Phase 5 Plan 23: Own notification vocabularies, rendering, and delivery Summary

**The four closed notification vocabularies became bare literal unions, two glyph constants and the summary emitter became module-private, and the reason-coverage proof now lives inside the mapping it guards — eight census identities out, none in.**

## Performance

- **Duration:** 3h 5m
- **Started:** 2026-09-14T20:52:00Z
- **Completed:** 2026-09-14T23:57:00Z
- **Tasks:** 3
- **Files modified:** 12 source/test files, 3 evidence records created

## Accomplishments

- `REASONS`, `STATUS_TOKENS`, `PLUGIN_STATUSES` and `MARKETPLACE_STATUSES` no longer exist as values. `Reason`, `StatusToken`, `PluginStatus` and `MarketplaceStatus` are declared directly as literal unions, so four runtime arrays that nothing iterated left the emitted module.
- The no-expansion gate keeps its full claim — no member added, removed or renamed, in order — by reading the declaration as data, paired with a bidirectional union proof that sees what a source scan cannot.
- `ICON_REMOTE` and `ICON_PARTIALLY_AVAILABLE` are module-private and pinned through `renderRemoteRow` / `renderPartiallyAvailableRow`, as the leading byte and as the whole line. The eighth-glyph clause now counts declarations rather than exports, so a private eighth glyph is caught exactly like an exported one.
- `emitWithSummary` is module-private. Its eleven cases stayed in their own owner file against `composeWithSummary` — which returns the exact argument tuple the emitter spreads — and six delivery cases joined the dispatch owner, each driving the public entry point production uses.
- `_ReasonsCoverageProof` is retired as an export and folded into `MALFORMED_REASON_BY_KIND`'s annotation through `Proven<T>`. A reason without a topic home now fails the build at the map, not at a proof nothing reads.

## Task Commits

1. **Task 1: Keep closed vocabularies private while preserving exact type contracts** — `b191b2bc` (refactor)
2. **Task 2: Observe private icons and summary delivery through public outputs** — `5e7d0ef3` (refactor)
3. **Task 3: Consume the reason proof and preserve summary ownership** — `95cf4929` (refactor)
4. **Owner-file doc refresh** — `3997bbda` (docs)

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notification-types.ts` — four `as const` tuples plus four derived aliases become four directly-declared literal unions.
- `extensions/pi-claude-marketplace/shared/notification-grammar.ts` — `ICON_REMOTE` and `ICON_PARTIALLY_AVAILABLE` lose their `export`.
- `extensions/pi-claude-marketplace/shared/notification-dispatch.ts` — `emitWithSummary` loses its `export`; the header names the four unions.
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` — the coverage proof becomes private and reaches the per-kind reason map through `Proven<T>`.
- `tests/shared/notification-types.test.ts` — the runtime tuple comparison becomes four bidirectional `IsExact` proofs, five false-asserting controls, and four duplicate-free clauses.
- `tests/architecture/notify-closed-set-locks.test.ts` — four length pins now count exhaustive enrollment maps, with `IsExact` proofs and two direction controls.
- `tests/architecture/compat-01-no-expansion.test.ts` — four order clauses read the declaration through `declaredVocabulary`, paired with four union proofs; the glyph clauses split into five exported constants and two row-carried glyphs; a reader control and two extra pattern spellings are added.
- `tests/architecture/closed-set-enrollment.test.ts` — the soft-dep catalog clause asserts the complete emittable marker set against independent `Reason`-annotated literals.
- `tests/shared/notification-grammar.test.ts` — the glyph-constant case covers five constants; a new case pins the two private glyphs through their rows.
- `tests/shared/notification-dispatch.test.ts` — six delivery cases added.
- `tests/shared/notification-summary.test.ts` — eleven cases repointed from `emitWithSummary` to `composeWithSummary`, expected arrays unchanged.
- `tests/shared/notify-reasons.test.ts` — the proof assertion moves to the mapping's public result type and gains a three-case gate control.
- `.planning/tdd-evidence/05-23-0{1,2,3}.json` — the three validated RED records.

## Census Identity Delta (for the parent's Wave 6 reconciliation)

This is this plan's contribution only. 05-15 contributes one removal and 05-19 seven; 05-25 contributes its own.

**Removed (8):**

| Census | Exact identity string |
| --- | --- |
| `PRODUCTION_FINDING_CENSUS.unused_exports` | `unused_exports\|extensions/pi-claude-marketplace/shared/notification-types.ts\|REASONS` |
| `PRODUCTION_FINDING_CENSUS.unused_exports` | `unused_exports\|extensions/pi-claude-marketplace/shared/notification-types.ts\|STATUS_TOKENS` |
| `PRODUCTION_FINDING_CENSUS.unused_exports` | `unused_exports\|extensions/pi-claude-marketplace/shared/notification-types.ts\|PLUGIN_STATUSES` |
| `PRODUCTION_FINDING_CENSUS.unused_exports` | `unused_exports\|extensions/pi-claude-marketplace/shared/notification-types.ts\|MARKETPLACE_STATUSES` |
| `PRODUCTION_FINDING_CENSUS.unused_exports` | `unused_exports\|extensions/pi-claude-marketplace/shared/notification-grammar.ts\|ICON_REMOTE` |
| `PRODUCTION_FINDING_CENSUS.unused_exports` | `unused_exports\|extensions/pi-claude-marketplace/shared/notification-grammar.ts\|ICON_PARTIALLY_AVAILABLE` |
| `PRODUCTION_FINDING_CENSUS.unused_exports` | `unused_exports\|extensions/pi-claude-marketplace/shared/notification-dispatch.ts\|emitWithSummary` |
| `PRODUCTION_FINDING_CENSUS.unused_types` | `unused_types\|extensions/pi-claude-marketplace/shared/notify-reasons.ts\|_ReasonsCoverageProof` |

**Added (0):** none.

The matching `UNOWNED_EXPORT_CENSUS` keys go with the seven `unused_exports` rows. All three keys — `shared/notification-types.ts`, `shared/notification-grammar.ts` and `shared/notification-dispatch.ts` — had exactly those members and no others, so all three keys go. `unused_types` has no `UNOWNED_EXPORT_CENSUS` counterpart.

**No transitive finding.** Retiring the four tuples removed values, not types, so nothing was orphaned behind them. Privatizing the two glyphs and `emitWithSummary` orphaned nothing either: every type in those signatures is already used by a public one. The re-measured report reads `now unowned but not pinned (0): none`.

**Evidence of each disposition.** `grep -rn` over `extensions`, `tests` and `scripts` shows each name has no remaining runtime reference outside its owner: the four vocabularies have no callers at all (they are gone), `ICON_REMOTE` ← `renderRemoteRow`, `ICON_PARTIALLY_AVAILABLE` ← `renderPartiallyAvailableRow`, `emitWithSummary` ← `dispatchInfoMessage`, `notify`, `emitCascadeWith` and `emitUpdateNoOpCascade`, all four in the same module. `_ReasonsCoverageProof` ← `Proven<T>` ← `MALFORMED_REASON_BY_KIND`.

The measured gate output reads, verbatim:

```
now unowned but not pinned (0): none
pinned but no longer unowned (15): extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts#createInstallPlugin, extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts#narrowResolverReasons, extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts#finalizeReinstalledPlugin, extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts#replaceReinstalledPlugin, extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts#rollbackReinstalledPlugin, extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts#runPostSuccessMaintenance, extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts#outcomeToPluginMessage, extensions/pi-claude-marketplace/orchestrators/plugin-path.ts#collectBinDirs, extensions/pi-claude-marketplace/shared/notification-dispatch.ts#emitWithSummary, extensions/pi-claude-marketplace/shared/notification-grammar.ts#ICON_PARTIALLY_AVAILABLE, extensions/pi-claude-marketplace/shared/notification-grammar.ts#ICON_REMOTE, extensions/pi-claude-marketplace/shared/notification-types.ts#MARKETPLACE_STATUSES, extensions/pi-claude-marketplace/shared/notification-types.ts#PLUGIN_STATUSES, extensions/pi-claude-marketplace/shared/notification-types.ts#REASONS, extensions/pi-claude-marketplace/shared/notification-types.ts#STATUS_TOKENS
```

The first eight entries are 05-15's and 05-19's, not this plan's. Live census `total_issues` moves 24 -> 16 in three measured steps: 24 -> 20 at Task 1, 20 -> 17 at Task 2, 17 -> 16 at Task 3. The wave is serialized, so no sibling writer was active during any reading, but the parent still re-measures on the stable snapshot before editing the pin.

## Assertion Ledger

### `tests/shared/notification-types.test.ts` — 1 case becomes 4, plus 9 compiler assertions

| Original assertion | Replacement | Proof |
| --- | --- | --- |
| `assert.deepStrictEqual(REASONS, EXPECTED_REASONS)` and its three siblings, in one case | `void (true satisfies IsExact<Reason, (typeof EXPECTED_REASONS)[number]>)` and its three siblings | Bidirectional: a member added to the union and a member dropped from the list both collapse the proof to `false`. Measured: a planted 45th reason yields `tests/shared/notification-types.test.ts(245,12): error TS1360: Type 'true' does not satisfy the expected type 'false'.` |

The four hand-written lists are unchanged, character for character.

**Added (9):** five `false`-asserting controls — one extra member and one dropped member on the reason set, one extra member on each of the other three — and four runtime clauses asserting each list names every member once. The duplicate clauses are not decoration: a union deduplicates, so without them "exactly these 44 members" would be a claim the proofs could not make.

**Removed: none.** The order component of the old `deepStrictEqual` did not stay here; it moved to the no-expansion gate, which reads the declaration (see below) and still fails on a pure transposition.

### `tests/architecture/notify-closed-set-locks.test.ts` — 4 cases, same counts

| Original assertion | Replacement | Proof |
| --- | --- | --- |
| `assert.equal(REASONS.length, 44)` | `assert.equal(Object.keys(REASON_ENROLLMENT).length, 44)` where `REASON_ENROLLMENT: Record<Reason, true>` | The annotation is exhaustive both ways, so the count is a fact about the union. A planted 45th reason yields `error TS2741: Property '"planted extra"' is missing in type ... but required in type 'Record<Reason, true>'` — the deliberate bump this file exists to force, arriving before the count even runs. |
| The three sibling length pins (24 / 19 / 7) | The same, over their own enrollment maps | Identical mechanism. |

**Added (6):** four `IsExact<keyof typeof MAP, Vocabulary>` proofs and two `false`-asserting direction controls. **Removed: none.** Every bump comment is preserved verbatim.

### `tests/architecture/compat-01-no-expansion.test.ts` — 11 cases become 13

| Original assertion | Replacement | Proof |
| --- | --- | --- |
| `assert.deepEqual([...REASONS], expected)` — enumeration AND order | `assert.deepEqual(await readVocabulary("Reason"), expected)` — the same hand-written list against the members the declaration names, in declaration order — PLUS `void (true satisfies IsExact<Reason, (typeof EXPECTED_REASONS)[number]>)` | Measured control: transposing `"not found"` and `"already installed"` in the owner leaves `npm run typecheck` at zero errors and fails exactly this case, which is the order half surviving intact. Renaming `"workflows"` to `"workflow"` fails both this case and 120 typecheck lines. |
| The three sibling tuple comparisons | The same pairing | Identical mechanism. |
| `assert.deepEqual({ICON_AVAILABLE, ..., ICON_REMOTE, ICON_PARTIALLY_AVAILABLE}, {seven escapes})` | Five exported constants keep the exact clause; the two private glyphs move to a new case asserting the complete rendered rows `◌ alpha v1.0.0 (remote)` and `⊖ alpha v1.0.0 (partially-available) {lsp}` against escape literals | Measured control: swapping `ICON_REMOTE` to `◎` fails the new case. The row form states more than the constant did — the glyph, its position, and the single space after it. |
| The catalog naming pairs used `ICON_PARTIALLY_AVAILABLE` / `ICON_REMOTE` as operands | They use the module-level `REMOTE_GLYPH` / `PARTIALLY_AVAILABLE_GLYPH` escape literals | The chain is unbroken: production glyph → row bytes (the case above) → escape literal → catalog name. |
| `GLYPH_DECLARATIONS = /\bexport const ICON_[A-Z_]+\b/g`, expected count 7 | `/\bconst ICON_[A-Z_]+\b/g`, expected count 7 | Measured control: adding a MODULE-PRIVATE eighth glyph to the owner fails this clause. Under the old pattern it would not have. |

**Added (2 cases, 2 spellings):** a reader control that plants a same-prefixed neighbour and a trailing mention of the real name and asserts the reader returns only the named declaration's members; and two private spellings added to the glyph-pattern control, which now pins five spellings instead of three.

**Removed: none.**

### `tests/architecture/closed-set-enrollment.test.ts` — 1 case, strengthened

| Original assertion | Replacement | Proof |
| --- | --- | --- |
| `softDepMarkers(true, true, probe).filter((m) => !new Set(REASONS).has(m))` deep-equals `[]` — the emitted markers are a SUBSET of the catalog, sampled at one input | `assert.deepStrictEqual(softDepMarkers(true, true, probe), EMITTABLE_SOFT_DEP_MARKERS)` where `EMITTABLE_SOFT_DEP_MARKERS: readonly Reason[] = ["requires pi-subagents", "requires pi-mcp"]` | Enrollment is now total rather than sampled: `softDepMarkers` returns `readonly Reason[]`, so every possible emission is a catalog member by construction, and the annotation on the literal list says the same about the two values written here. The exact set and its order are now asserted where the old filter only asserted absence. |

**Removed: none.** The sampled subset claim is subsumed by a total compile-time one plus an exact runtime enumeration.

### `tests/shared/notification-grammar.test.ts` — 1 case becomes 2

| Original assertion | Replacement | Proof |
| --- | --- | --- |
| `assert.deepStrictEqual([ICON_INSTALLED, ICON_AVAILABLE, ICON_UNINSTALLABLE, ICON_DISABLED, ICON_REMOTE, ICON_PARTIALLY_INSTALLED, ICON_PARTIALLY_AVAILABLE], ["●","○","⊘","◍","◌","◉","⊖"])` | The five exported constants keep the case verbatim; a new case asserts `[renderRemoteRow(...).slice(0,1), renderPartiallyAvailableRow(...).slice(0,1)]` deep-equals `["◌","⊖"]` | The expected glyphs are the same literals in the same order. The row's first character is the glyph, and the file's existing row cases already pin the complete lines `◌ alpha v1.0.0 (remote) {installs disabled}` and `⊖ alpha v1.0.0 (partially-available) {lsp}`, which were not touched. |

**Removed: none.**

### `tests/shared/notification-summary.test.ts` — 11 cases repointed, expectations verbatim

Each case kept its `message`, its `body`, and its expected array character for character. Only the subject changed, from `emitWithSummary(ctx, message, body)` + `assert.deepStrictEqual(ctx.ui.notify.mock.calls[0].arguments, expected)` to `composeWithSummary(message, body)` + `assert.deepStrictEqual(composed, expected)`.

The substitution is exact rather than approximate: `emitWithSummary`'s whole body is `composeWithSummary(message, body)` followed by spreading the returned tuple into `ctx.ui.notify`, so the mock's `arguments` array and the returned tuple are the same value. `emitWithSummary` reads no discriminator of its own, so the four hostile-getter cases keep their counts unchanged at 6, 6, 5 and 11.

| # | Case | Disposition |
| --- | --- | --- |
| 1-3 | marketplace absence / failed plugin info / available plugin info | Repointed, expected arrays verbatim |
| 4 | mixed warning rows emit a plural summary | Repointed |
| 5 | a marketplace-only failure emits a marketplace summary | Repointed |
| 6 | read-only marketplace info emits unchanged info bytes | Repointed |
| 7 | an unstamped cascade plugin defaults to info severity and success tally | Repointed, still composed with `composeTally(message)` |
| 8-9 | the two reconcile summary cases | Repointed |
| 10-11 | the two empty-fallback-after-narrowing cases | Repointed, kind sequences unchanged |
| 12-13 | the two discriminator-changed-after-narrowing throws | Repointed, error class and message unchanged |

**Removed: none. Added: none.** Direct coverage of `notification-summary.ts` stays at branches 124/124, functions 19/19, lines 631/631.

### `tests/shared/notification-dispatch.test.ts` — 6 delivery cases added

The delivery claim the old cases carried implicitly — that the composed tuple really reaches `ctx.ui.notify`, once, with exactly those arguments — is asserted here against the public entry points.

| New case | Public path | What it states |
| --- | --- | --- |
| a mixed actionable-skip cascade emits the plural attention summary | `emitContextCascade` | `"Some operations need attention.\n\n● official [user] (skipped) {not found}\n  alpha (skipped)"`, `"warning"` |
| a marketplace-only failure cascade emits the marketplace failure summary | `emitContextCascade` | `"A marketplace operation has failed.\n\n⊘ official [user] (failed)"`, `"error"` |
| an unstamped cascade plugin defaults to info severity and a success tally | `emitContextCascade` | one argument: `"● official [user]\n  alpha (available)\n\nPlugin list: 1 success"` |
| an applied reconcile with a failed plugin emits the plural failure summary | `notify` | `"Some operations have failed.\n\n⊘ official [user] (failed)\n  ⊘ alpha (failed) {not found}"`, `"error"` |
| an applied reconcile with only a skipped marketplace emits the marketplace attention summary | `notify` | `"A marketplace operation needs attention.\n\n● official [user] (skipped)"`, `"warning"` |
| summary computation preserves its available-plugin empty fallback after narrowing | `notify` | the non-failed `plugin-info` summary arm contributes no sentence |

Two further delivery cases were considered and recorded as **subsumed** rather than duplicated: the info-severity single-argument claim for a `plugin-info` and for a `marketplace-info` is already asserted by this file's `INFO-05: renderPluginInfo (componentsResolved:false ...)` and `INFO-01: renderMarketplaceInfo (path source, ...)`, both of which end in `assert.equal(args.length, 1)`.

The last case was proved to exercise the arm it names: flipping its plugin row to `failed` changes the emitted string to `"A plugin operation has failed.\n\n⊘ official [user] (failed) {marketplace not added}"`, measured and then reverted.

### `tests/shared/notify-reasons.test.ts` — 1 compiler assertion becomes 4

| Original assertion | Replacement | Proof |
| --- | --- | --- |
| `void (true satisfies ReasonsCoverageProofIsExact)` over the imported `_ReasonsCoverageProof` | `void (true satisfies IsExact<ReturnType<typeof malformedReasonsForKinds>[number], FailureReason>)` | The proof now gates `MALFORMED_REASON_BY_KIND`'s value type, and that map is what the public mapping returns. If the partition breaks, the value type collapses to `never` and the owner stops compiling. Measured: stripping `"workflows"` of its topic home yields `notify-reasons.ts(202,43): error TS2344` at the proof AND `notify-reasons.ts(217,3): error TS2322: Type '"malformed skill"' is not assignable to type 'never'` at the map; adding a stray `"not a reason"` to a topic group yields the same pair. |

**Added (3):** a benign-plus-two-offender gate control, `GateProven<Partition, T>`, restating the gate over a planted partition that drops a reason and one that adds a stray. Each direction must collapse to `never`; the benign case must pass `FailureReason` through unchanged.

**Removed: none.** The 21 `satisfies FailureReason` assertions and the three `@ts-expect-error` negatives are untouched.

## Verification Results

| Command | Result |
| --- | --- |
| `npm run typecheck` | exit 0, zero diagnostics |
| `node --test tests/shared/notification-types.test.ts tests/architecture/closed-set-enrollment.test.ts tests/architecture/notify-closed-set-locks.test.ts tests/architecture/compat-01-no-expansion.test.ts` (Task 1 verify) | 35 tests, 35 pass, 0 fail |
| `node --test tests/shared/notification-grammar.test.ts tests/shared/notification-dispatch.test.ts tests/architecture/compat-01-no-expansion.test.ts` (Task 2 verify) | 311 tests, 311 pass, 0 fail |
| `node --test tests/shared/notify-reasons.test.ts tests/shared/notification-summary.test.ts tests/shared/notification-dispatch.test.ts` (Task 3 verify) | 285 tests, 285 pass, 0 fail |
| `npm test` | 6256 tests, 6254 pass, 2 fail — both the parent-owned census equality gates |
| `npm run test:integration` | 32 tests, 32 pass, 0 fail, exit 0 |
| `npm run test:coverage:direct -- shared/notification-types.ts` | passed, branches 2/2, functions 1/1, lines 586/586 |
| `npm run test:coverage:direct -- shared/notification-grammar.ts` | passed, branches 209/209, functions 46/46, lines 1624/1624 |
| `npm run test:coverage:direct -- shared/notification-dispatch.ts` | passed, branches 47/47, functions 16/16, lines 429/429 |
| `npm run test:coverage:direct -- shared/notification-summary.ts` | passed, branches 124/124, functions 19/19, lines 631/631 |
| `npm run test:coverage:direct -- shared/notify-reasons.ts` | passed, branches 18/18, functions 6/6, lines 280/280 |
| `SKIP=trufflehog pre-commit run --files ...` before each of the four commits | every hook Passed, including `npm lint`, `npm format check`, `npm typecheck`, `npm fallow` and `npm direct coverage (changed pairs)` |

Baseline comparison: the wave opened at 6244 unit tests with the same 2 census failures and 32/32 integration. This plan adds 12 unit tests and changes neither failure.

Aggregate production unit coverage was deliberately **not** measured. 05-VALIDATION assigns it to the parent once per stable wave.

### Planted-offender controls

| Control | Planted | Result |
| --- | --- | --- |
| A | a 45th reason appended to the vocabulary | 5 typecheck errors across `notify-reasons.ts`, `compat-01`, `notify-closed-set-locks`, `notification-types.test.ts` and `notify-reasons.test.ts`; the order clause fails |
| B | two reasons transposed, membership unchanged | typecheck clean, exactly the order clause fails — the order assertion survived privatization |
| C | a reason renamed | 120 typecheck lines across production consumers; the order clause fails |
| D | `ICON_REMOTE` swapped to `◎` | the private-glyph row clause fails |
| E | a MODULE-PRIVATE eighth glyph added | the eighth-glyph clause fails |
| F | a reason stripped of its topic home | TS2344 at the proof and TS2322 at the per-kind map |
| G | a stray literal added to a topic group | the same pair |
| H | `emitWithSummary` forced to always pass a severity argument | the unstamped-cascade delivery case fails |
| I | `MALFORMED_REASON_BY_KIND.skill` swapped to `"malformed command"` | the degraded-skill mapping case fails |
| J | the non-failed `plugin-info` fallback row flipped to `failed` | the emitted string gains `"A plugin operation has failed."` |

Every offender existed only inside this session and was reverted before the commit that followed it; no commit contains one.

## Decisions Made

- **Privatizing the four tuples was not enough; they had to go.** A private `const REASONS = [...] as const` used only by `(typeof REASONS)[number]` trips `@typescript-eslint/no-unused-vars` ("assigned a value but only used as a type"). D-07 anticipates this, and `notify-reasons.ts` already carries the repository's own precedent for the fix: "a tuple that only ever feeds `(typeof X)[number]` is an unreferenced runtime value". The unions are the D-07 "encode the identical closed type contracts without runtime-only artifacts" branch.
- **The order clause moved rather than retiring.** A union carries membership and nothing else, so the COMPAT-01 promise "no token added, removed, or renamed, in order" could not survive on the type alone. Reading the declaration as data keeps it, and control B is the measurement that says so.
- **The length tripwire changed shape, not strength.** An enrollment map is the only way to count a union's members without restating the vocabulary in a third ordered list, and the `Record` annotation makes the count bidirectional, which the old `.length` never was.
- **The two duplicated info-severity delivery cases were recorded as subsumed, not re-added.** `INFO-01` and `INFO-05` already assert a one-argument notify on exactly those two message kinds, with better literals; adding a second, weaker pair would have made two places to bump for one claim.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The four tuples were retired rather than made private**

- **Found during:** Task 1
- **Issue:** The task's action says "remove export visibility from REASONS, STATUS_TOKENS, PLUGIN_STATUSES and MARKETPLACE_STATUSES". Doing exactly that left four module-private values read only by a `typeof`, and `npx eslint` reported four errors: `'REASONS' is assigned a value but only used as a type. Allowed unused vars must match /^_/u`. The commit chain runs `npm lint`, so the change could not land.
- **Fix:** Took the same action's second branch — "Where the tuples serve only type derivation ... encode the identical closed type contracts without runtime-only artifacts" — and declared the four vocabularies directly as literal unions. The member lists and their order are character-for-character what the tuples held.
- **Files modified:** `extensions/pi-claude-marketplace/shared/notification-types.ts`
- **Verification:** `npm run typecheck` exit 0; `npx eslint` clean; the census removes exactly the four identities with zero additions; controls A, B and C discriminate.
- **Committed in:** `b191b2bc`

**2. [Rule 3 - Blocking] `emitWithSummary`'s privatization landed with Task 2, not split across Tasks 2 and 3**

- **Issue:** Task 2 makes `emitWithSummary` private; Task 3 removes `notification-summary.test.ts`'s import of it. Those cannot be separate commits — the intermediate state does not compile, and CLAUDE.md forbids committing through a red gate or recovering with `--amend`.
- **Fix:** Both halves landed in the Task 2 commit. Task 3 kept its own subject, the reason coverage proof. `tests/shared/notification-summary.test.ts` is named by Task 3's `<files>` and was edited in Task 2's commit; no other file moved between tasks.
- **Files modified:** `tests/shared/notification-summary.test.ts` (in `5e7d0ef3` rather than `95cf4929`)
- **Verification:** every commit in the chain is green on `npm run typecheck`, `npm lint` and its own focused suites.
- **Committed in:** `5e7d0ef3`

**3. [Rule 3 - Blocking] The eleven summary cases stayed in their own owner instead of moving to the dispatch owner**

- **Found during:** Task 2
- **Issue:** Task 2's action says to relocate `emitWithSummary`'s cases to the public delivery paths. Moving all eleven out of `notification-summary.test.ts` dropped that owner's direct coverage to `branches 76/106, functions 17/19, lines 605/631`, and the negative-control gate refused the unpinned shortfall. D-01 forbids reducing coverage and this plan may not add a pin.
- **Fix:** Split the claim along the seam the plan itself names. `composeWithSummary` is public and returns exactly the tuple the private emitter spreads, so the eleven cases stayed in their own owner with their expected arrays verbatim; six DELIVERY cases — that the tuple reaches the host call, once, with those arguments — were added to the dispatch owner. This is Task 3's own wording, "keep its own summary API cases there and move delivery assertions into the dispatch owner", applied one task earlier because the compile order required it.
- **Files modified:** `tests/shared/notification-summary.test.ts`, `tests/shared/notification-dispatch.test.ts`
- **Verification:** `notification-summary.ts` direct coverage returns to branches 124/124, functions 19/19, lines 631/631; 43/43 cases pass in the summary owner and 204/204 in the dispatch owner.
- **Committed in:** `5e7d0ef3`

**4. [Rule 3 - Blocking] RED recorded as validated evidence rather than a separate commit**

- **Found during:** all three tasks
- **Issue:** The TDD reference asks for a `test(...)` commit holding the failing test. This repository's `.pre-commit-config.yaml` runs a `npm direct coverage (changed pairs)` hook that executes the focused test for every changed source/test pair, so a commit whose test is red cannot pass the chain, and CLAUDE.md forbids `--no-verify` and forbids recovering from a failed hook after the fact.
- **Fix:** RED ran as a real gate at each task. For a visibility refactor the meaningful RED is discrimination — the rewritten public case must fail when the privatized behaviour breaks — so a defect was planted for each task, the target case failed on its behavioural assertion, and all three runs were machine-validated with `gsd-tools check tdd-red-evidence` (`RED_EVIDENCE_OK` / `target_test_failed`). Records are committed at `.planning/tdd-evidence/05-23-01.json`, `-02.json` and `-03.json`.
- **Files modified:** the three evidence records.
- **Verification:** all three verdicts are reproducible from the committed records.
- **Committed in:** `b191b2bc`, `5e7d0ef3`, `95cf4929`

---

**Total deviations:** 4 auto-fixed (all Rule 3 - blocking).
**Impact on plan:** No scope creep and no weakening. Deviation 1 takes the branch the task's own action offers for exactly this case. Deviations 2 and 3 are consequences of this repository's gate chain and coverage pin, not of a different design; the work described by each task was done in full, and only which commit carries one file moved. Deviation 4 is commit granularity. Every file listed in the plan's `files_modified` was touched, and every `<verify>` command was run as written.

## Issues Encountered

- The two census equality gates are red at this plan's HEAD. That is the designed state for a cleanup plan mid-wave and matches the 05-15 and 05-19 precedent; the parent applies one reviewed pin edit at the Wave 6 reconciliation.
- Two hand-written expected strings were wrong on first run — both were attempts to restate an info-surface render from the grammar rather than from an independent pin. Neither was corrected by copying the implementation's output: both cases were withdrawn as subsumed by this file's existing `INFO-01` / `INFO-05` pins, which already state the same claim with better literals. Every other literal in this plan, including all six cascade delivery strings and the two private-glyph rows, was correct on first run.

## Known Stubs

None. No placeholder, no skipped test and no unrun `<verify>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Blocking for the parent:** the Wave 6 census reconciliation must remove exactly the eight identities listed above on behalf of this plan, and must re-measure on the stable wave snapshot rather than trusting the live reading here. The three `UNOWNED_EXPORT_CENSUS` keys are emptied entirely.
- **Advisory for 05-25 and 05-28:** `shared/notification-types.ts` now declares no runtime value at all beyond `SCOPE_BEARING_LIST_STATUS`. A later plan that touches it should not reintroduce an `as const` tuple for a vocabulary nothing iterates.
- **Advisory for any later plan touching a closed set:** the order of a vocabulary is asserted by `tests/architecture/compat-01-no-expansion.test.ts` reading the declaration through `declaredVocabulary`, which anchors on `export type <NAME> =`. Renaming or reshaping that declaration fails the clause loudly rather than silently uncovering it.
- Two deferred items were recorded in `deferred-items.md`: comments in nineteen non-owned files that still name the retired tuple identifiers, and two that name `ICON_PARTIALLY_AVAILABLE` from outside its module. Both are identifier drift only; every behavioural claim those comments make is still true.
- `.planning/ROADMAP.md`'s phase-5 row was hand-edited to `19/28` and diff-checked; `roadmap.update-plan-progress` was not run, per the phase constraint recording its corruption during 05-24.

## Self-Check: PASSED

- `.planning/tdd-evidence/05-23-01.json` — FOUND
- `.planning/tdd-evidence/05-23-02.json` — FOUND
- `.planning/tdd-evidence/05-23-03.json` — FOUND
- all twelve modified source/test files — FOUND
- commit `b191b2bc` — FOUND
- commit `5e7d0ef3` — FOUND
- commit `95cf4929` — FOUND
- commit `3997bbda` — FOUND
- `git rev-list --count 63b060a2..HEAD` — 4, matching the four commits recorded above

---
*Phase: 05-production-export-ownership*
*Completed: 2026-09-14*
