---
phase: 05-prune-on-uninstall
fixed_at: 2026-09-17T01:40:00Z
review_path: .planning/phases/05-prune-on-uninstall/05-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 05: Code Review Fix Report

**Fixed at:** 2026-09-17T01:40:00Z
**Source review:** .planning/phases/05-prune-on-uninstall/05-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (CR-01, WR-01, WR-02, WR-03, WR-04; `fix_scope: critical_warning`, so IN-01..04 were not attempted)
- Fixed: 5
- Skipped: 0

**Where verification ran:** all edits, gates and commits ran in the main checkout `/home/acolomba/src/pi-claude-marketplace-manifest` (branch `features/manifest`), not in a nested worktree. `workflow.use_worktrees` is `true`, but the orchestrator's project rules fix the working tree to this checkout and require `npm run typecheck` / `lint` / `fallow` / `test:coverage:direct:commit` on every touched production file, which a fresh worktree cannot run (no `node_modules`). Every number below is reproducible from this tree. Per fix: `tsc --noEmit`, ESLint on the touched files, `npm run fallow` (exit 0), `npm run test:corresponding`, `npm run test:coverage:direct:commit` (100% direct coverage on every changed production file; the three recorded shortfalls are the pre-existing pinned ones), the relevant `node --test` suites, and `SKIP=trufflehog pre-commit run --files <changed>` clean before each commit. After the last commit, `npm test` passed 6467/6467. The operator's unrelated uncommitted edits (`.claude/settings.json`, `.codex/config.toml`, `.planning/config.json`, `.planning/state.json`) and untracked files were left untouched.

## Fixed Issues

### CR-01: A failed pruned member does not stop the sweep from pruning the dependencies only it declares

**Files modified:** `extensions/pi-claude-marketplace/domain/dependency-orphans.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`, `tests/domain/dependency-orphans.test.ts`, `tests/orchestrators/plugin/uninstall.test.ts`, `docs/output-catalog.md`, `docs/dependency-resolution.md`
**Commit:** 50e43272
**Applied fix:** NOT the reviewer's loop as written. That loop recomputes `pruneOrphans` per member, but `pruneOrphans` iterates to a fixpoint on the assumption that every batch member goes, so after `d1` fails, `pruneOrphans(gone={x, o})` still returns `d2@mp2` (it assumes `d1` is pruned) and the suggested loop would remove it too -- the same defect in a different shape. The correct check is the one-pass "does any holder outside `gone` declare this key" predicate that already existed privately as `isHeldBy`. Exported it from `domain/dependency-orphans.ts` (with a doc comment on why it is one-pass), and in `sweepOrphans` kept the precomputed order (so the rendered order the byte-exact tests pin is unchanged) but seeded `gone` with only the keys that actually left the snapshot and re-checked `isHeldBy` just before each member's removal; every holder of a key precedes it in the order, so the check is exact when it runs. A key only a failed member holds is skipped and renders no row. Added the `d1`-fails-then-`d2`-kept regression test (verified failing on HEAD~, passing after), four direct `isHeldBy` cases, and qualified the D-05-13 prose in both docs.

### WR-01: Reconcile processes uninstalls in `state.json` insertion order, so dropping a plugin together with its dependent produces a refusal row and needs a second reload

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`, `tests/orchestrators/reconcile/apply.test.ts`, `docs/output-catalog.md`, `docs/dependency-resolution.md`
**Commit:** 7afaece9
**Applied fix:** The retry-loop remedy. Extracted the per-entry body into `applyOnePluginUninstall` (returns `PerEntryOutcome | undefined`, `undefined` being the WR-06 silent converge) and an `isRefusedUninstall` predicate (`plugin-uninstall-failed` with an `UninstallRefusedError` cause); `applyPluginUninstalls` now retries refused entries after each pass until a pass makes no progress and pushes only each entry's final outcome. Any `UninstallRefusedError` is retried (a D-05-07 declarer-unreadable refusal can also clear if the declarer is in the bucket). Reconcile still never prunes (D-05-08): every entry retried is one the config no longer declares. Added the dependency-recorded-first test (`orphan` before `keeper`, config emptied, one pass removes both -- verified failing on HEAD~), and noted in both docs that record order does not matter. The existing D-05-16 test (dependent kept in config -> refusal every pass) still passes and covers the no-progress arm. `apply.ts` fallow health stays under threshold.

### WR-02: The fail-closed guard reads an unreadable own manifest as "declares nothing" when the marketplace entry is silent

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts` (header comment only), `docs/dependency-resolution.md`
**Commit:** 8780a9b6
**Applied fix:** The reviewer's ALTERNATIVE remedy, not the primary one. The primary remedy (refuse on a present-but-unusable own manifest even when a marketplace entry exists) contradicts the literal text of two locked decisions: D-05-06 ("entry answers only where the manifest is unreadable") and D-05-07 (fail closed only when there is "no readable manifest AND no marketplace entry to fall back to"). The reviewer's own text offers the alternative "if the operator instead accepts the entry fallback as the deliberate answer, the module header and the docs paragraph must say so". Applied that: the index header now states the fallback as part of the read (absent, cold clone, or present-but-unusable own manifest -> entry answers; a silent entry -> declares nothing; fail closed only where the entry cannot answer either) and records that tightening it is the one-line predicate change D-05-07 leaves open; the docs paragraph now names the MARKETPLACE manifest as the one whose unreadability refuses and states the own-manifest fallback. No behavior change. **Operator decision left open:** whether to take the stricter guard (a `{ kind: "unusable" }` arm on `OwnManifestRead` consumed only by the index) -- it is a deliberate D-05-07 reversal-direction question, not something a fix pass should decide.

### WR-03: The declarer's read-failure token is stamped on the target's row, where it makes a false claim about the target

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts`, `tests/orchestrators/plugin/uninstall.test.ts`, `tests/orchestrators/plugin/dependency-index.test.ts`, `tests/architecture/catalog-uat/fixtures/plugin-uninstall.ts`, `tests/architecture/catalog-uat/catalog-contract.test.ts`, `docs/output-catalog.md`, `docs/dependency-resolution.md`
**Commit:** d3e3405f
**Applied fix:** Option (b) -- the existing D-47-B `unreadable` member, not a new token. 05-CONTEXT's "Claude's Discretion" says a new token "should be avoided if an existing one is truthful", and `unreadable` ("we could not read on-disk state") makes no positive claim about the target's manifest; the cause line already names the declarer and why. `assertNoDependents` now throws `UninstallRefusedError("unreadable", cause.message)`. The index result's `reason` field then had no production consumer, so it was removed along with the `narrowProbeError` / `ContentReason` imports it needed (the cause detail already carries the load error's message, redacted). Rendered bytes changed for one catalog state (`refused-declarer-unreadable`: `{not in manifest}` -> `{unreadable}`), so the fixture and `EXPECTED_UTF8_BYTES` (28_548 -> 28_543) were re-locked; `EXPECTED_STATE_COUNT` and the closed-set pins are unchanged because no member was added. The `dependency-index.test.ts` load-failure cases now assert the cause message instead of the dropped token. **Operator decision left open:** the reviewer preferred option (a), a new `dependents unknown` token with the full ten-surface amendment; that is a closed-set change and was not taken here.

### WR-04: The docs omit the simplest remedy for an unreadable declarer and point at one that may itself be refused

**Files modified:** `docs/dependency-resolution.md`, `docs/output-catalog.md`
**Commit:** 1fd73b5d
**Applied fix:** Both places now name `uninstall <unreadable-plugin>@<marketplace>` first (the target of an uninstall is never indexed, so the guard passes for it), with `marketplace update` / `marketplace remove` as the alternatives for a record that should stay or a stale marketplace. One correction to the review's text: the "two unlisted plugins refuse each other" paragraph is NOT solved by that command -- `uninstall A` excludes `A` but still indexes the unlisted `B` and is refused, and vice versa -- so that paragraph keeps `marketplace remove` as the exit and now says why neither uninstall passes.

## Skipped Issues

None.

## Operator decisions settled (2026-09-17)

The two decisions iteration 1 left open (carried as IN-05 and IN-06 in `05-REVIEW.md`) are settled by the operator: IN-05 = tighten, IN-06 = accept. Quick task `260917-cqc`.

### IN-05: fixed

**Commit:** 8a17e159 (`fix(uninstall): refuse when a declarer's own manifest cannot be read`)
**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts`, `tests/orchestrators/plugin/dependency-declaration-read.test.ts`, `tests/orchestrators/plugin/dependency-index.test.ts`, `tests/orchestrators/plugin/uninstall.test.ts`, `docs/dependency-resolution.md`, `docs/output-catalog.md`
**Applied change:** `OwnManifestRead` now has `readable | absent | unusable` arms, so the read no longer collapses an absent own manifest (no candidate file, a cold git clone, a refused root) into the same value as a present-but-unusable one (parse throw, non-object payload, a stat failure other than ENOENT/ENOTDIR). `readDependencyDeclaration` takes an index-only `refuseUnusableOwnManifest` option; under it a present-but-unusable own manifest is returned as the RESV-02 `unusable` arm with the fixed detail `its own manifest is present but cannot be read` (no path, no manifest text, no chained cause -- T-05-04). `dependency-index.ts` passes the option, so `assertNoDependents` and the `--prune` sweep fail closed on it instead of letting a silent marketplace entry answer "declares nothing". The install cascade omits the option and keeps the D-01-07 entry fallback unchanged; `install-flow.ts` is not edited, and every option-off case in the read suite and `tests/architecture/manifest-read-agreement.test.ts` is unchanged.

Test cases added: `D-05-07: with refuseUnusableOwnManifest, <an unparseable first candidate | an EACCES stat on the first candidate | a JSON-array payload> is the unusable arm, not the entry` plus the negative controls `D-05-06: with refuseUnusableOwnManifest, <no candidate present | a containment-refused root> still falls back to the entry` (read suite); `D-05-07: a corrupt own manifest beside a silent entry ends the walk naming the record` (index suite, asserts the exact message and `cause.cause === undefined`); `D-05-07: a record whose own manifest is present but unreadable refuses the uninstall` (owner suite, one `REFUSAL_CASES` row, `{unreadable}` at error severity, state bytes and mtime untouched, data dir kept). Docs amended: the "The check reads the declarations" paragraph in `docs/dependency-resolution.md` (four unreadable conditions, absent-vs-present distinction, repair-the-manifest remedy) and the `refused-declarer-unreadable` prose in `docs/output-catalog.md` (trigger list, cause-trailer list, remedy); the rendered example block and the catalog byte lock are unchanged.

**Accepted cost:** a corrupt or unreadable `plugin.json` in ONE installed plugin now holds every other plugin's uninstall in that scope until the file is repaired or that plugin is uninstalled (the uninstall target is never indexed, so `uninstall <declarer>` always passes). This is the same D-05-07 cost already accepted for an unreadable marketplace manifest, chosen over the silent-entry fallback because the alternative is a removal on incomplete information. The install cascade is not held. The remedy is documented in `docs/dependency-resolution.md` and in the catalog state `refused-declarer-unreadable`.

### IN-06: accepted, no code change

`unreadable` stays the refusal token on the target's row. Rationale:

1. `unreadable` is a truthful existing closed-set member: "we could not read on-disk state" makes no claim about the target's own manifest, and the target's manifest is fine.
2. The cause line always names the declarer and why it could not be read, on both the command surface and the reconcile surface (D-05-16), so the specific information the token omits is on the next line.
3. No consumer branches on the bare reason value. `grep -rn '"unreadable"' extensions/` finds: in `uninstall.ts`, the D-05-07 stamp (`throw new UninstallRefusedError("unreadable", ...)`, line 255), the `narrowCascadeFailure` pass-through of `cause.reason` (line 288) and the ATTR-09 fallback return (line 318); the closed-set catalog entries in `shared/notification-types.ts` and `shared/notify-reasons.ts`; and hits in other verbs (`enable-disable`, `reinstall`, `install-cascade`, `list-flow`, `info`, `marketplace/update.messaging`, `probe-classifiers`) that stamp their own rows or test a different discriminant (`selection.kind === "unreadable"` is a config-probe kind, not the notify reason). `reconcile/apply.ts::isRefusedUninstall` narrows on `instanceof UninstallRefusedError` and forwards `reason` to the renderer untouched. Nothing reads the uninstall row's reason to decide behavior.
4. `05-CONTEXT.md` prefers reusing an existing truthful member over a new token; a `dependents unknown` token is a ten-surface closed-set amendment (catalog, fixtures, byte lock, `REASONS`, `notify-reasons`, grammar, and their tests) for no behavioral gain.

**Re-open trigger:** a programmatic consumer of the bare reason value appears (code that branches on `reason === "unreadable"` to distinguish a dependents-guard refusal from a manifest read failure). At that point the token is no longer only presentation, and option (a) from iteration 1 should be reconsidered.

---

_Fixed: 2026-09-17T01:40:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
