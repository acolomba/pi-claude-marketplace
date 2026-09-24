---
phase: "116"
fixed_at: "2026-09-09"
review_path: .planning/workstreams/workflows/phases/116-load-time-workflow-convergence/116-REVIEW.md
iteration: 1
findings_in_scope: 11
fixed: 10
skipped: 1
status: partial
---

# Phase 116: Code Review Fix Report

**Fixed at:** 2026-09-09
**Source review:** `116-REVIEW.md`
**Iteration:** 1
**Scope:** critical + warning (2 critical, 9 warnings). Info findings out of scope; one (IN-02) was closed because a warning fix landed on the same claim.

**Summary:**

- Findings in scope: 11
- Fixed: 10
- Skipped: 1 (WR-03 — reverses an operator-locked decision)

**Gate:** `npm run check` exit **0**. Unit **5654 / 5654** (baseline 5650 + 4 new cases), integration **35 / 35** (unchanged). Every stage of the chain ran: typecheck, lint, fallow (dead-code / health / dupes, `✓ No issues found`), `format:check` (`All matched files use Prettier code style!`), the three corresponding-test scripts, unit, integration. `git status` clean after every commit apart from the operator-owned files that were dirty before the run.

## Commits

| Commit | Finding | Message |
|---|---|---|
| `c93a0dcd` | CR-01 | `fix(116): converge when a clean record's manifest cannot be read` |
| `f7564f7e` | CR-02 | `fix(116): refuse an unconsented degrade in the backfill promotion` |
| `ec715645` | WR-01, WR-02, WR-04, WR-06, IN-02 | `docs(116): restate the reconcile comments the widened scan falsified` |
| `7f603249` | WR-07 | `test(116): correct the already-touched dedupe's stated rationale` |
| `bffb32f4` | WR-08 | `test(116): assert the convergence marker's bytes end to end` |
| `04642d1d` | WR-09 | `docs(116): drop the ungated running count from the reason-set prose` |

WR-05 was closed inside `c93a0dcd` (the new entry-point case is the case WR-05 asks for, and it only has an answer to assert once CR-01 is resolved).

______________________________________________________________________

## CR-01 — permanent per-plugin `(failed)` cascade on an unreadable manifest

**Status:** fixed. **Departed from the proposed fix** — see below.

**Files:** `extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts`, `tests/orchestrators/reconcile/backfill.test.ts`, `tests/index.test.ts`, `116-SECURITY.md`.

### What was applied

`resolveRecordedPluginOffline` now classifies the resolve throw at the resolve boundary and takes the record with it:

- record recorded `installable: false` → rethrow. The throw reaches `backfillOnePluginIsolated`'s catch, surfaces the plugin-scoped `(failed)` row and holds the version gate open. **SF-02 is unchanged for this population.**
- record recorded `installable: true` → benign `undefined`, which folds into the existing "nothing to promote" branch. No row, and the gate may close.

### Why not the review's shape

The review proposed a typed `ManifestResolveError` swallowed for **every** record. That closes the cascade, but it also silences the population that already had the SF-02 surface before this phase, and it destroys the observable the phase's own ENBL-08 measurement depends on: with resolve throws silent for all records, `backfill.test.ts`'s poisoned-manifest pair could no longer distinguish "the disabled record was not scanned" from "it was scanned and said nothing".

Classifying by the record instead makes the split exactly the pre-widening boundary:

- Every record the widening ADDED to the population becomes as silent, and as convergent, as it was when it was not scanned at all. That is the criterion-4 claim, restored by construction rather than by a new policy.
- Every record that was already in the population keeps the retry contract Phase 68 designed for it. No existing SF-02 case moved (`SF-02: surfaces a plugin-scoped failure row when the cached manifest cannot be parsed` and `SF-02: promotes a healthy plugin under one marketplace while a corrupt manifest fails its own` both seed `installable: false` and both stayed green through the whole run without edits).

The residual is stated rather than glossed, in the code and in the register: a record recorded `installable: false` under a permanently dead marketplace source still holds the gate open and re-emits its row each load. That is pre-existing, it is the shape SF-02 was designed around, and changing it is a redesign of that contract, not a fix to this one.

### Assertions inverted, and why that is not a weakening

`backfill.test.ts:819` (`ENBL-08 / D-116-03: reads the same poisoned manifest when the record is enabled, and holds the gate open`) asserted the defective shape for an `installable: true` record. It was **not** inverted to assert silence — that would have collapsed the pair into two cases with identical expectations.

Instead **both halves of the pair were reseeded `installable: false`**, keeping the assertions byte-identical (the disabled half still asserts empty outcomes + landed stamp; the enabled half still asserts the `unparseable` row + withheld stamp). Disabled-ness is orthogonal to installability (ENBL-05), so the reseed narrows nothing about the filter the pair exists to measure, and it restores the pair's control property: the poison is only observable against the population whose resolve throw is still surfaced. The reason is written into the pair's preamble comment so the next reader does not "simplify" the seed back.

### New cases and their controls

Three cases were added. Each was run with the guard reverted (`if (record.compatibility.installable)` → `if (false)`).

`WCONV-01: converges over a clean record whose manifest cannot be read, emitting nothing` — two clean records under one poisoned manifest:

```text
✖ WCONV-01: converges over a clean record whose manifest cannot be read, emitting nothing (17.886461ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

  + [
  +   {
  +     kind: 'plugin-install-failed',
  +     marketplace: 'mp',
  +     plugin: 'hello',
  +     reason: 'unparseable',
  +     scope: 'project'
  +   },
  +   {
  +     kind: 'plugin-install-failed',
  +     marketplace: 'mp',
  +     plugin: 'world',
  +     reason: 'unparseable',
  +     scope: 'project'
  +   }
  + ]
  - []

      at TestContext.<anonymous> (tests/orchestrators/reconcile/backfill.test.ts:933:12)
```

`SF-02 / WCONV-01: still fails a degraded record under the same unreadable manifest` — the discriminator, proving the silence is scoped to the added population rather than blanket. One clean + one degraded record share the poisoned manifest; the fix must emit exactly one row:

```text
✖ SF-02 / WCONV-01: still fails a degraded record under the same unreadable manifest (18.828585ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

    [
      {
        kind: 'plugin-install-failed',
        marketplace: 'mp',
  +     plugin: 'hello',
  +     reason: 'unparseable',
  +     scope: 'project'
  +   },
  +   {
  +     kind: 'plugin-install-failed',
  +     marketplace: 'mp',
        plugin: 'world',
        reason: 'unparseable',
        scope: 'project'
      }
    ]

      at TestContext.<anonymous> (tests/orchestrators/reconcile/backfill.test.ts:989:12)
```

`tests/index.test.ts` — `converges silently over a recorded plugin whose marketplace source is absent (WCONV-01)` (this is WR-05's requested case, see below):

```text
✖ converges silently over a recorded plugin whose marketplace source is absent (WCONV-01) (20.485404ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

  + undefined
  - '0.19.0'

      at TestContext.<anonymous> (tests/index.test.ts:699:10)
```

Note on that last control, recorded because it is a limit of the case rather than a strength: the `notifications` array stayed `[]` even with the fix reverted. `resources_discover` swallows every throw for NFR-2, including the zero-emission boundary's own refusal of an unexpected notify, so the empty array bounds what reached the user without bounding what the scan produced. The **landed stamp** is the load-bearing observable, and it is the one that goes red. The case's comment says so rather than implying the empty array carried the claim.

### Register update

`116-SECURITY.md` T-116-13 moved `accept` → `mitigate` with a re-measured cost sentence (a held gate re-emits a user-visible row per record per load; it is not "a repeated offline scan, no data loss"). R-116-05 is amended in place, naming both halves of the original rationale that were wrong — the cost was understated, and a held gate is by definition *not* bounded by the version stamp — and narrowing what stays accepted to the pre-existing degraded-record case. The falsified rationale is not left standing.

______________________________________________________________________

## CR-02 — a load-time backfill could degrade a clean record without consent

**Status:** fixed, essentially as proposed.

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts`, `tests/orchestrators/reconcile/backfill.test.ts`.

The guard sits after the growth test:

```ts
if (record.compatibility.installable && resolved.state !== "installable") {
  return false;
}
```

Verified before applying: `requirePartialInstallable` (`reinstall.ts:1224`) does admit a `partially-available` resolve; `updateStateRecord` (`reinstall.ts:1554`) does persist `installable: installable.state === "installable"`; and the update path's stance is stated verbatim at `docs/output-catalog.md:1343` ("flipping a clean record to degraded is a consent the user has not given"). All three claims in the review hold.

The review called this latent. It is latent *in production* — no current constant produces the growth-plus-degrade combination — but it is directly reachable from a seed, so the guard gets a real control rather than a comment. New case `WCONV-01: declines to degrade a clean record whose re-resolve is partially-available` seeds a clean record (`installable: true`, empty unsupported) against a tree that adds a supported `commands` kind and an unsupported `lspServers` one. With the guard removed:

```text
✖ WCONV-01: declines to degrade a clean record whose re-resolve is partially-available (47.167769ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

  + [
  +   {
  +     dependencies: [],
  +     installable: false,
  +     kind: 'plugin-backfilled',
  +     marketplace: 'mp',
  +     plugin: 'hello',
  +     scope: 'project',
  +     unsupported: [
  +       'lspServers'
  +     ],
  +     version: '1.0.0'
  +   }
  + ]
  - []

      at TestContext.<anonymous> (tests/orchestrators/reconcile/backfill.test.ts:2041:12)
```

That is the finding reproduced exactly: a clean record flipped to `installable: false` with a dropped-kind list, on a reload nobody initiated.

______________________________________________________________________

## WR-01 — `backfill.ts` asserted a brace-less `(installed)` row

**Status:** fixed. Verified against `reconcile/notify.ts` first: the `installable` arm returns `reasons` unconditionally and the prelude always places `"components now supported"`, so the arm has no brace-less shape. Restated as the review proposed, naming WCONV-03 as what fills the brace.

## WR-02 — four cross-file comments describing the deleted filter or shape

**Status:** fixed. Each claim was checked against current code before rewriting, and no new claim was introduced that was not checked.

- `apply.ts:180` — "scan its partially-installed plugins" → "scan every plugin it records (WCONV-01)".
- `types.ts:282` — same sentence on `ScopeReadResult.state`, same correction.
- `apply-outcomes.ts:116` — "a partially-installed plugin is re-resolved offline" → "a recorded plugin — any recorded plugin, not only a partially-installed one (WCONV-01)".
- `apply-outcomes.ts:146-147` — "brace-less" dropped; the empty-unsupported case now says the brace carries the convergence marker alone.

## WR-03 — rename `scanForceInstalledBackfills` / `hasForceInstalledPlugin`

**Status:** SKIPPED. Reason: it reverses an operator-locked decision.

`116-CONTEXT.md` closes its decisions block with "**Names are left alone.** `scanForceInstalledBackfills` and `hasForceInstalledPlugin` keep their spellings: the rename is churn beyond what the requirements ask for, and new prose spelling the hyphenated `force-install` form would redden `partial-vocabulary-guard.test.ts`."

For the record, half of that rationale does not survive contact with the proposal: the review's names (`scanRecordedBackfills`, `hasPartiallyInstalledPlugin`) contain no "force" at all, so the vocabulary guard cannot fire on them — the guard's concern was new *prose*, and the rename removes the need for it. The other half — that the rename is scope beyond the requirements — stands on its own and is a scope judgment the operator made deliberately.

The review's argument is good (names outlive comments; `scanForceInstalledBackfills` is exported and its own doc comment opens by contradicting it). Reversing a recorded decision is not something an automated fix run should do silently, so **this needs an operator call.** The mitigations that do not require the rename are in place: the exported function's doc opens with the true population, and WR-04's comment no longer misdescribes the predicate.

## WR-04 — `hasForceInstalledPlugin`'s comment justifies the wrong property

**Status:** fixed. The claim was verified end to end first: `apply.ts:108` takes a `pathExists` probe on `stateJsonPath` before the lock; when it is false, `with-state-guard.ts:89` hands back `loadState`, which answers `{ schemaVersion: 2, marketplaces: {} }` on ENOENT (`state-io.ts:394`). So the loop body never runs on the production path and the predicate is constant `false` there.

The "deliberately narrower than the population" framing is gone. The comment now says the predicate is vacuous outside one window — the TOCTOU gap in which another process creates `state.json` between the probe and the guard's `loadState` — names that window, and states that widening it would decide nothing extra that can exist.

## WR-05 — the `index.test.ts` repair suppressed the behaviour instead of asserting it

**Status:** fixed, exactly as the review scoped it. The stamped seed stays for the four PATH cases (they are steady-state cases and the fixture restores their prior effective coverage). `seedEnabledPlugin` gained a `{ stamped: false }` option, and one new case uses it to leave the gate open over the same seed, asserting the answer CR-01 now gives: no emission, and the stamp lands. The failing transcript is under CR-01 above.

## WR-06 — backfilled `(installed)` row reports an absent companion at `info`

**Status:** fixed via the review's second option (record the divergence explicitly). **Departed from the first option**, and the reason changes the finding's shape.

Measured before deciding: `companionSeverity` needs a `SoftDepStatus` probe. `orchestrators/reconcile/notify.ts` imports no probe at all and `applyPluginOutcomeToBlock` is pure over outcomes, so **no arm in that file can compute it** — the sibling `enabledRowFromOutcome` (`notify.ts:568`) stamps the same `malformed.length > 0 ? "warning" : "info"`. The `companionSeverity` call the review cites on the enable path is in `enable-disable.ts:1273`, the *standalone* verb, which has `pi` in hand.

So the catalog's parity justification is accurate as written (the load-time enable arm really does render `info`), and the divergence is a projection-wide property, not a choice this arm made. Routing the backfilled arms through `companionSeverity` would thread a probe through the whole reconcile projection and change the enable arm's bytes too — a cross-cutting change outside both this phase and a review fix, and one that would create a *fresh* inconsistency if applied to one arm only.

`backfilledRowFromOutcome`'s doc block now states the divergence, its mechanical cause, that the sibling arm diverges identically, and that closing it means threading a probe rather than editing that line — so the next reader meets it as a bounded property with a named remedy instead of an oversight. No new `SEV-` ID was minted: that series is used in the PRD and catalog as a shared vocabulary, and inventing a member from a fix run would put an ID in code with no registry row behind it.

**Carried for the operator:** if the tri-state severity model should hold on reconcile rows, the work is "thread a `SoftDepStatus` into `applyPluginOutcomeToBlock`", it covers the backfill *and* enable arms, and it moves two published catalog states. That is a phase, not a fix.

## WR-07 — the RECON-04 test's rationale contradicts `reinstall.ts`

**Status:** fixed. Verified the review's claim first: `runLockedReinstall` re-reads fresh state under its own lock and refuses a disabled record with `notes: ["already disabled"]` (`reinstall.ts:927`), which is exactly the cross-process shape the fixture simulates, and `backfill.ts`'s own ENBL-08 comment already says so. The false claim ("without the dedupe the scan would reverse the user's own decision") is replaced with what the case measures — single-emit, no second row and no redundant re-materialize — and cross-references reinstall's independent refusal as the ENBL-08 layer.

No behaviour changed, so no control applies; this is prose, and the claim it replaces was checked against source rather than paraphrased.

## WR-08 — the integration case never asserted the marker

**Status:** fixed with the review's assertion.

Control run: the marker was removed from the shared prelude in `reconcile/notify.ts` and the case went red on the bytes, while the assertion it replaced (`notDeepStrictEqual(first.notifications, [])`) would have stayed green against the same output:

```text
✖ WCONV-01 / WCONV-02: one load converges a record whose kind was invisible, and the next load rewrites nothing (78.833563ms)
  AssertionError [ERR_ASSERTION]: The input did not match the regular expression
  /\(installed\) \{components now supported\}/. Input:

  '● mp [project]\n  ● hello v1.0.0 (installed)\n\nReconcile: 1 success'

      at tests/integration/workflow-kind-inversion.test.ts:454:14
```

## WR-09 — the ungated reason-count changelog

**Status:** fixed. **Departed from the review on one site.**

The running arithmetic (`37 → 38 → … → 46`) is gone from `notify-reasons.ts`'s header and from `notify-closed-set-locks.test.ts`'s body comment; the standalone count is gone from `notify.ts:83` and `docs/output-catalog.md:63`. Each is replaced with the invariant it was standing in for: the set is append-only, its declared order is catalog-stable, `COMPAT-01` pins membership by enumeration, the lock test pins length, and every member that needs an argument already carries its own decision ID beside its literal in `notify.ts` (verified — they do).

The project's own comment policy independently supports this: `.claude/rules/typescript-comments.md` forbids narrating code that no longer exists, and the `44 → 43` step in that changelog narrates a member that was retired.

**Departure:** the count stays in the test *title* (`OUT-08: REASONS is the closed 46-entry reason set`). Two reasons. It sits three lines above `assert.equal(REASONS.length, 46)`, so it is not a site that can silently fall behind — a member-add must edit the assertion, and the title is in the same hunk. And `116-01-SUMMARY.md:84` records that title verbatim as a verification `ref:`; changing it would dangle a historical plan artifact, and rewriting the artifact to match would be rewriting a record of what was done.

`116-SECURITY.md` T-116-11's mitigation text was amended in the same commit, because "six sites read 46" stopped being true.

______________________________________________________________________

## Info findings

| ID | Disposition |
|---|---|
| IN-01 (`backfill.ts` header narrates a prior arrangement) | Skipped — out of scope, and the review itself flags it for the next sweep. Still true; the header's "It lived inside apply.ts…" paragraph is exactly what `.claude/rules/typescript-comments.md` excludes. |
| IN-02 (`reinstall.ts` claims no reconcile-driven caller) | **Fixed** in `ec715645`. It is the same falsified-claim class as WR-02, it is one comment, and the file's own header two hundred lines above already names `reconcile/backfill.ts` as a caller — so the file contradicted itself. The deep-equal short-circuit argument is kept and extended to the reconcile caller, which it covers (D-68-02 preserves the version, so the entry shape is stable). |
| IN-03 (`schemaVersion: 1` in the integration fixture) | Skipped — out of scope. One character, but it changes which loader path the fixture exercises, so it wants its own verification rather than a ride-along on an unrelated commit. |
| IN-04 (`supportedSetGrew`'s length fast-path is duplicate-sensitive) | Skipped — out of scope, latent. |
| IN-05 (`alreadyTouched` space delimiter vs the sibling NUL key) | Skipped — out of scope, latent and safe-direction (over-eager skip). |

______________________________________________________________________

## Verification

Ran in the **main checkout**, not an isolated worktree (`workflow.use_worktrees` is off for this run), so these numbers are reproducible from the tree as it stands.

```text
npm run check   → exit 0
  typecheck      tsc --noEmit                     clean
  lint           eslint extensions tests scripts  clean
  fallow         dead-code / health / dupes       ✓ No issues found
  format:check   prettier --check                 All matched files use Prettier code style!
  test:corresponding / :negative / coverage:direct:negative   clean
  test           5654 / 5654   (0 fail, 313 suites)
  test:integration  35 / 35    (0 fail)
```

Baseline was 5650 unit / 35 integration. The four added unit cases: two CR-01 cases and one CR-02 case in `backfill.test.ts`, one WR-05/CR-01 case in `index.test.ts`. Integration count is unchanged because WR-08 strengthened an existing assertion rather than adding a case.

`pre-commit run --files <paths>` was run before every commit and passed on every hook except `trufflehog`, which fails structurally in a linked worktree (`.git` is a file, so its git-mode scan cannot read an index). Each commit was preceded by a filesystem scan over exactly its paths at `--results=verified,unknown --fail`; every one reported `verified_secrets: 0, unverified_secrets: 0`. `SKIP=trufflehog` was used and extended to nothing else. `git show --stat` after each commit matched its message; no hook rewrote a file after a commit.

______________________________________________________________________

## Open items for the operator

1. **WR-03 (rename).** Needs a call, because it reverses `116-CONTEXT.md`'s "Names are left alone". The vocabulary-guard half of that rationale does not apply to the proposed names.
2. **WR-06 residual.** Reconcile rows cannot stamp the soft-dep severity raise at all. The remedy is a projection-wide probe thread covering the backfill and enable arms, and it moves published catalog bytes.
3. **CR-01 residual.** A record recorded `installable: false` under a permanently unreadable manifest still holds the version gate open and re-emits its row every load. Pre-existing, now named in `116-SECURITY.md` R-116-05 rather than hidden inside a rationale that said the cost was invisible.
4. **`docs/output-catalog.md` and `catalog-uat.test.ts` moved again** (one prose line). Phase 114's verification was already going to be stale after 116; this does not change that sequencing.

______________________________________________________________________

*Fixed: 2026-09-09*
*Fixer: Claude (gsd-code-fixer)*
*Iteration: 1*

---

## Closure, 2026-09-10

**WR-03 stays SKIPPED, and the skip is the right call.** Re-checked at the
milestone boundary rather than carried forward on its original note.

The finding asks for `scanForceInstalledBackfills` and `hasForceInstalledPlugin`
to be renamed. `116-CONTEXT.md` closes its decisions block with the opposite
instruction — "**Names are left alone.**" — on two grounds that both still hold:
the rename is churn beyond what the requirements ask for, and new prose spelling
the hyphenated `force-install` form would redden
`partial-vocabulary-guard.test.ts`.

A code-review finding does not outrank a locked decision recorded before the
review ran. Applying it would have reversed an operator decision silently, which
is worse than leaving a name imperfect.

What the finding is right about survives separately: `hasForceInstalledPlugin`'s
doc comment has to open by contradicting its own name, because the filter it
describes was deleted. That half is tracked as Broken Windows entry #44 against
the comment rather than the identifier, so the true part is carried without the
part that reverses the decision.
