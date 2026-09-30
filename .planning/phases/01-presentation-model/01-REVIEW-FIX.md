---
phase: 01-presentation-model
fixed_at: 2026-09-30T00:00:00Z
review_path: .planning/phases/01-presentation-model/01-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 5
skipped: 2
status: partial
---

# Phase 1: Code Review Fix Report

**Fixed at:** 2026-09-30T00:00:00Z
**Source review:** .planning/phases/01-presentation-model/01-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 7 (WR-01, WR-02, IN-01..IN-05)
- Fixed: 5 (WR-01 and WR-02 in an earlier pass; IN-01, IN-02, IN-04 in this pass)
- Skipped: 2 (IN-03, IN-05)

No fix changes user-visible output bytes. The IN-01 fix changes comments only.
The IN-02 and WR fixes change tests only. The IN-04 fix changes the
operator-run corpus scripts only.

## Fixed Issues

### WR-01: The context wrappers are only tested with markers on, so ignoring `context.markers` would pass every test

**Files modified:** `tests/shared/notify-context.test.ts`
**Commit:** 3093a652
**Applied fix:** The D-12 loop now registers two cases for each of the four
wrappers (`notifyWithContext`, `notifyUpdateWithContext`,
`notifyUpdateNoOpWithContext`, `notifyReconcileAppliedWithContext`). The
existing on case keeps `markers: { installed: true }` and expects
`alpha {requires pi-subagents}`. The new off case uses
`markers: { installed: false }` with the same `dependencies: ["agents"]` row and
the nothing-loaded run, and expects `alpha {}`. The strict `ui.notify` mock
rejects any other bytes. Two small seed functions (`installedMarkerContext`,
`installedAgentsRows`) build the context and rows for both cases.

**Red/green evidence (planted mutations, reverted with `git checkout --`):**
In `shared/notify-context.ts`, each wrapper's `context.markers` argument was
replaced in turn, once with `CENTRAL_MARKER_POLICY` and once with an all-true
policy (a `Proxy` returning `true`). That makes eight runs of
`node --test tests/shared/notify-context.test.ts`:

| Wrapper mutated | `CENTRAL_MARKER_POLICY` | all-true |
|---|---|---|
| `notifyWithContext` | exit 1, only its off case red | exit 1, only its off case red |
| `notifyUpdateWithContext` | exit 1, only its off case red | exit 1, only its off case red |
| `notifyUpdateNoOpWithContext` | exit 1, only its off case red | exit 1, only its off case red |
| `notifyReconcileAppliedWithContext` | exit 1, only its off case red | exit 1, only its off case red |

In every run, the pre-existing on case stayed green. That confirms the review:
the old test could not see these mutations. With the production file restored,
the suite runs 21 cases with exit 0.

### WR-02: The SC-5 marker-policy table does not check that it lists every context

**Files modified:** `tests/architecture/soft-dep-marker-policy.test.ts`, `tests/architecture/gate-targets.ts`
**Commit:** 25691b07
**Applied fix:** The fix covers both directions of the review.

- **Row totality:** The literal table is now the named `MARKER_POLICY_TABLE`.
  A new case, `SC-5: the table states every declared marker policy exactly once`,
  compares the sorted row names with the sorted `DECLARED_MARKERS` keys. A
  deleted row or a doubled row makes this case red.
- **Source-derived context totality:** A new case,
  `SC-5: DECLARED_MARKERS names every command context the extension declares`,
  uses the house `filesMatching` walk over `EXTENSION_ROOT_REL` with the
  pattern `/\bsatisfies\s+CommandContext</`. It strips comments with
  `stripComments`. It labels each pin with the last `export const` name before
  it and the path relative to `ORCHESTRATORS_REL`. This is the same label form
  `DECLARED_MARKERS` uses, for example `INSTALL_CONTEXT (plugin/install.messaging.ts)`.
  The case compares the result with the `DECLARED_MARKERS` keys minus
  `CENTRAL_MARKER_POLICY`, which is not a context. The check is per context, not
  per file. So a second context added to a file that is already listed also makes
  the case red. A pin with no `export const` before it gets the label
  `(unexported)`, which can never match the table.
- **Planted control:** A new case,
  `SC-5: the context scan reports a context planted in a copy of a real messaging module`,
  uses `withTempRoot` and `plantOffender`. It appends a `PLANTED_CONTEXT ... as const satisfies CommandContext<never, never>`
  declaration to a copy of `orchestrators/plugin/install.messaging.ts`. The case
  asserts that the scan finds exactly the `INSTALL_CONTEXT` and
  `PLANTED_CONTEXT` labels.
- **Registry (D-07-06):** The planted host is registered in a new
  `MARKER_POLICY_CONTROL_TARGETS` group in `gate-targets.ts`. The test's local
  constant is typed `(typeof MARKER_POLICY_CONTROL_TARGETS)[number]`. The gate
  file builds no path from `.ts` segments. `gate-targets.test.ts` stays green.

**Red/green evidence (planted, then restored):**

- (a) Deleting the `INSTALL_CONTEXT` row from the table: exit 1. Only the
  row-totality case is red.
- (b) Removing `NOAUTOUPDATE_CONTEXT` from both `DECLARED_MARKERS` and the table:
  exit 1. Only the source-derived case is red, and its diff shows
  `+ 'NOAUTOUPDATE_CONTEXT (marketplace/autoupdate.messaging.ts)'`.
- (c) Appending an unregistered `STRAY_CONTEXT` to the real
  `orchestrators/marketplace/add.messaging.ts`: exit 1. Only the source-derived
  case is red, and its diff shows `+ 'STRAY_CONTEXT (marketplace/add.messaging.ts)'`.
  The production file was restored with `git checkout --`.

With the files restored, the suite runs 22 cases with exit 0.

### IN-01: Comments still describe render-time probes

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts`, `extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts`
**Commit:** 8f6a4f69
**Applied fix:** Comments only.

- `update-swap.ts` (success block above `stagedAgentNames`): the comment now
  says that `resolveRows` composes `{requires pi-subagents}` /
  `{requires pi-mcp}` from the command run's snapshot under the context's
  marker policy (D-05, D-12), iff (declares AND unloaded).
- `update-row.ts` (`updatedRowFromOutcome` doc, the out-of-list site the review
  named): "renderer-time" and "the notify-time probe" are gone. The comment
  says that `resolveRows` composes the markers from `dependencies` membership
  and the command run's snapshot under the context's marker policy.
- `marketplace/list.ts` (`ListMarketplacesOptions.run`): the doc now says the
  run is threaded for the shared emitter signature, and that `LIST_CONTEXT`
  declares no marker policy, so its snapshot composes no markers here.

No type-member pin names these lines. The pins in `update-swap.ts` sit at line
219-222, above the edit, and the edit keeps the line count there.

### IN-02: `CommandProbes.probingEmissions` is a dead test member that describes surfaces that no longer exist

**Files modified:** `tests/edge/register.test.ts`
**Commit:** 6bc023d7
**Applied fix:** The `probingEmissions` member is deleted from `CommandProbes`,
and `toolReads` is now `probes.runs * 3`. All 15 sites that passed
`probingEmissions: 0` (the default parameter and 14 call sites) now pass
`{ runs: N }`. The doc comment now states one count: each handler invocation
opens one notification run whose snapshot reads the inventory three times
(D-05). The interface is kept, not replaced by a bare number, so each call site
still names what the count is. `node --test tests/edge/register.test.ts`: exit
0, 164 tests.

### IN-04: Corpus tooling fragilities

**Files modified:** `scripts/notify-corpus.mjs`, `scripts/notify-corpus.hook.mjs`, `scripts/notify-corpus.negative.mjs`
**Commit:** 736e69fc
**Applied fix:**

1. **Argument order.** A new `flagValues(args, flag)` helper in
   `notify-corpus.mjs` returns the values after a flag, up to the next `--`
   flag. `parseCaptureArgs` reads `--files` through it, so
   `capture --files a.test.ts --out x.jsonl` no longer reads `x.jsonl` as a
   test path.
2. **Hook receiver.** The hook regex is now the module constant
   `bareReceiverCall`, `/(?<![\w$.])([A-Za-z_$][\w$]*)\.ui\.notify\(/g`. After
   the rewrite, the load hook compares the literal `ui.notify(` count with the
   match count. If they differ, it throws
   `notify-corpus: <url> spells N ui.notify( calls, but only M have the bare X.ui.notify( receiver the hook can rewrite`.
   So a member-access receiver or a destructured `ui.notify(` now fails to load
   with an error. Before, the first became broken code that threw only when
   called, and the second went unrecorded. The hook doc states the rule. A scan
   of every `.ts` file under `extensions/pi-claude-marketplace/` found no module
   where the two counts differ, so the stricter hook refuses nothing today.
3. **Controls** (there is no `tests/scripts/` pair for these operator-run
   scripts; their test is `notify-corpus.negative.mjs`, so the controls go
   there):
   - Control 5 runs `capture --files <test> --out <existing capture file>` and
     asserts exit 0 and the same entries as Control 4.
   - Control 6 plants three `.ts` files under
     `<tmp>/extensions/pi-claude-marketplace/` and loads each with
     `node --import <hook>` and `NOTIFY_CORPUS_OUT` set. The bare
     `ctx.ui.notify(` loads with exit 0. `opts.ctx.ui.notify(` and a
     destructured `ui.notify(` exit non-zero, with the refusal on stderr.

**Red/green evidence:**

- `node scripts/notify-corpus.negative.mjs` with the fix: exit 0.
- With the previous hook restored (`git show HEAD:...`): exit 1,
  `AssertionError: member:`. The member-receiver file loaded cleanly.
- With the previous `parseCaptureArgs` restored: exit 1,
  `The test run exited 1, so its corpus is incomplete`.

An earlier draft of Control 5 wrote to a new `--out` path, and it passed
against the old parser too. On Node 26, `node --test` reads a path that does
not exist as a glob that matches nothing, so the stray token did no harm. The
control now points `--out` at an existing file, which the old parser ran as a
test file. Both production files were restored from scratch copies after each
red run, and the final green run was repeated.

## Skipped Issues

### IN-03: Row composers accept unresolved producer rows structurally, so markers can be dropped silently

**File:** `extensions/pi-claude-marketplace/shared/notification-grammar.ts:522-543,552-570,600-618`
**Reason:** skipped: the minimal guard works but trips the unused-type-member
gate, and clearing that gate needs an operator decision. The attempt was rolled
back with `git checkout --`.

What was tried and measured:

- Adding `readonly dependencies?: never;` to the `p` type of `pluginRow`,
  `partiallyInstalledRow`, and `installedLikeRow` type-checks cleanly. Every
  production caller already passes a `ResolvedRow`, which omits
  `dependencies`.
- A type-level control in `tests/shared/notification-grammar.test.ts` asserted
  `true`/`false` assignability of `ResolvedRow<X>` and raw `X` (for example
  `PluginInstalledMessage`) to each composer's `p`. With the guard removed,
  `tsc` failed on exactly the three `false` lines (TS1360). So the guard
  catches a raw producer row at compile time.
- `npm run lint:type-members` then reported three `unread` findings
  (`pluginRow.p.dependencies`, `partiallyInstalledRow.p.dependencies`,
  `installedLikeRow.p.dependencies`). An inline `?: never` refusal marker has no
  slot to refine, so no contract entry can reach it. The only precedent,
  `enableRowDependencies.signals.partition` (WR-01), is a recorded exception in
  `scripts/check-unused-type-members.exceptions.json`. Adding three new
  recorded decisions is an operator call, not a review fix.
- The review's other option, branding `ResolvedRowFacts.reasons`, needs an
  `as` cast or a new constructor in `notification-resolve.ts`, and `extensions/`
  forbids `as`.

To apply the fix: re-add the three `dependencies?: never` members and the
type-level control. Record three exceptions modeled on the WR-01 `partition`
entry. Shift the `notification-grammar.ts` pins in
`check-unused-type-members.contracts.json` by +7 lines (789→796, 787→794,
1401→1408, with the doc lines as drafted). No production caller changes.
Another option is a conditional-type parameter (`p: P & RefuseDependencies<P>`).
It adds no type member, but it is more complex and misses a union that
includes a variant without `dependencies`.

**Original issue:** `installedLikeRow`, `pluginRow`, and
`partiallyInstalledRow` take structural `p` subsets, so a raw producer row
compiles and renders without its `{requires ...}` markers. D-13 holds by
convention, not by type.

### IN-05: Resolve's read order is constrained by a test's getter-backed `kind`

**File:** `extensions/pi-claude-marketplace/shared/notification-resolve.ts:127-130`; `tests/shared/notification-dispatch.test.ts:45-58,5256,6200`
**Reason:** skipped: the two getter-backed tests own two entries in the
committed notify-corpus baseline. Deleting them needs a corpus re-baseline, and
threading `kind` through resolve is a disproportionate refactor. The attempt was
rolled back with `git checkout --`.

What was tried and measured:

- The empty-summary arms these tests reach are already covered directly,
  without a getter, by `tests/shared/notification-summary.test.ts`
  ("summary composes no line for a read-only kind" and "summary composes no
  line for an available plugin info" call `buildSummaryLine(message, "error")`).
- With `messageWithKindSequence` and both tests removed, direct coverage stayed
  at 100%: `notification-dispatch.ts` 44/44 branches and 473/473 lines,
  `notification-resolve.ts` 79/79 and 540/540, `notification-summary.ts`
  101/101 and 493/493.
- The committed baseline
  `.planning/phases/01-presentation-model/notify-corpus/baseline.jsonl` holds
  two `tests/shared/notification-dispatch.test.ts` entries with the message
  `"\n\n⊘ official [user] (failed) {marketplace not added}"` and severity
  `error`. These are the outputs of the two getter tests. Only an unstable
  `kind` can produce an error envelope with an empty summary. Removing the tests
  makes `notify-corpus.mjs check` report both entries missing and refuse the
  shrunken capture (D-02, D-04), until someone re-baselines (D-03).
- Reading `message.kind` once and threading it would change the signatures of
  `computeSeverity`, `buildSummaryLine`, and `isInfoKind`, which narrow on
  `message`. It would also make the fallback arms compiler-forced and
  unreachable, which fights the 100% coverage gate.

The production comment stays because it states a constraint that still holds
while those two tests exist. To apply the fix: delete the helper and the two
tests, delete the three-line comment in `resolveEnvelope` (and shift any
`notification-resolve.ts` pins by -3), then re-baseline the corpus with
`node scripts/notify-corpus.mjs baseline`.

**Original issue:** `resolveEnvelope`'s evaluation order is tied to an exact
property-read count (17 reads, then a different `kind`), which a harmless
refactor of resolve would break for reasons unrelated to output.

## Verification

All gates ran in the main working tree of the `features/json` worktree
(`/home/acolomba/src/pi-claude-marketplace-json`). No nested review-fix
worktree was created. The gates need this checkout's `node_modules`, and the
caller named this worktree as the working directory. The numbers below can be
reproduced from this tree. Exit codes were read directly, not through a pipe.

This pass (IN-01, IN-02, IN-04):

- `SKIP=trufflehog pre-commit run --files <changed files>`: exit 0 before each
  commit. For IN-01 and IN-02 this ran `npm lint`, `npm typecheck`,
  `npm fallow`, `npm direct coverage (changed pairs)`, and `npm type members`.
  For IN-04 the typecheck, coverage, and type-member hooks had no matching
  files. No hook rewrote a file.
- `node --test tests/architecture/*.test.ts` after the IN-01 edit: exit 0
  (411 tests), including the vocabulary guards that scan comments.
- `node --test tests/edge/register.test.ts`: exit 0 (164 tests).
- `node scripts/notify-corpus.negative.mjs`: exit 0 (red runs listed under
  IN-04).
- `npx fallow health`: exit 0.
- `fallow audit --base 371dcd5e --format json --quiet --explain --gate-marker agent`:
  verdict `pass`, 0 dead-code issues, 0 complexity findings.
- `npm run check` (once, after the last commit, run in this main working
  tree): exit 0. Unit coverage run: 7364 tests, 0 failed. Integration run: 36
  tests, 0 failed. The pi-subagents integration tests did not fail in this
  environment.

Earlier pass (WR-01, WR-02): see the evidence under each finding. `npm test`
was exit 0 (7364 tests) after both commits.

---

_Fixed: 2026-09-30T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
