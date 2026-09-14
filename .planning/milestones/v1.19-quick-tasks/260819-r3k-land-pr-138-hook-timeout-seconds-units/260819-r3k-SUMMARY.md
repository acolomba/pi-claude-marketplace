---
id: 260819-r3k
slug: land-pr-138-hook-timeout-seconds-units
description: Land PR #138 -- hook timeout read as seconds
date: 2026-08-19
status: complete
branch: fix/hook-timeout-seconds-units
contributor_commit: 2fbaaca3 fix: interpret hook timeout as seconds (Claude Code parity)
commits:
  - e9645f2f Merge origin/main into fix/hook-timeout-seconds-units
  - 9ae808e6 test(hooks): pin the timeout unit at both exec call sites
  - fb332294 docs: state the hook timeout unit and record the fix
---

# Quick Task 260819-r3k Summary

## What shipped

**The contributor's fix, unrewritten.** Commit `2fbaaca3` by @rakesh-vs stands
as submitted. `origin/main` was merged into the branch rather than rebased onto
it, so the branch carries `v0.16.1` and the release-automation change without
touching the contributor's authorship or content.

**Call-site gates, one per exec lane.**
`tests/architecture/hooks-exec.test.ts` and
`tests/architecture/hooks-async-rewake.test.ts` each gain a test that dispatches
a handler declaring `timeout: 2`, ticks mock timers to 1999 ms and asserts no
kill, then ticks one more and asserts exactly `["SIGTERM"]`. Each file already
owned its lane's EXEC-02 invariants and already carried a spawn spy whose mock
child records kill signals, so the fixture cost was one optional `timeout`
field on each file's `makeEntry`.

**The unit is on the page.** `docs/hooks-compatibility.md`'s `timeout` row said
"per-handler override; 600 s default" and never named the input unit. It now
says seconds.

**Recorded.** `CHANGELOG.md` carries the fix under a new `[Unreleased]`
heading, crediting @rakesh-vs and #138. `.planning/BACKLOG.md` gains `HKTO-01`,
and `.planning/STATE.md` the quick-task row.

## Verified

- **The seconds reading is upstream's, from the primary source.**
  `code.claude.com/docs/en/hooks`, Common fields table: "`timeout` | no |
  Seconds before canceling. Defaults: 600 for `command`, `http`, and
  `mcp_tool`; 30 for `prompt`; 60 for `agent`."
- **The repository had already recorded it.**
  `docs/research/claude-hook-config-syntax.md` line 60 lists `timeout` as
  `number (seconds)` and maps it to EXEC-02. The v1.13 implementation drifted
  from research that was correct at the time it was written.
- **Both read sites are covered, and there is no third.** Grep over the
  extension tree finds exactly two consumers of `entry.handlerDecl.timeout`:
  `bridges/hooks/dispatch-exec.ts` and
  `bridges/hooks/async-rewake/registry.ts`.
- **The new gates were proved by planting the violation, not by passing.**
  Re-inlining `typeof raw === "number" ? raw : DEFAULT_TIMEOUT_MS` at both call
  sites turns both new tests red (`# fail 2`) while all six cases in
  `tests/bridges/hooks/timeout.test.ts` stay green -- which is precisely the blind
  spot they were added to cover. Source restored and re-run green afterward.
- `npm run check` green on the finished branch, and `pre-commit` run at
  `--all-files` scope, which is the scope CI uses.

## Review round

`/pr-review-toolkit:review-pr` ran over the branch diff after the first push.
It found two defects that the whole CI gate is blind to -- `npm run check` was
green across all of it -- and both were reproduced by hand before being acted
on.

**The schema line made a mis-typed `timeout` disqualify the entire plugin.**
The contribution declared `timeout: { type: "number" }` in
`HOOK_HANDLER_SCHEMA`. The field was previously covered by
`additionalProperties: true`, so constraining it turned a quoted number into a
STRUCTURAL parse failure -- the arm D-57-04 reserves for invalid JSON, shape
mismatch, and a missing REQUIRED `command`. Measured: `"30"`, `null`, `true`,
and `{}` all went from ACCEPTED to REJECTED, while the accept-any sibling
`asyncRewake` stayed lenient. Consequences were `(unavailable)
{unsupported hooks}` at install, not force-rescuable, and -- worse -- a silent
drop of every hook in an already-installed plugin at load time, since
`event-router.ts` logs the parse failure through `hookDebugLog` and returns,
and that seam only writes when `PI_CLAUDE_MARKETPLACE_DEBUG === "1"`. Same
failure class as the bug being fixed, one layer up and wider. Fixed by
`timeout: {}` plus `timeout?: unknown` on the interface, matching the three
siblings three lines below it. This also makes the contribution's five
non-number test cases load-bearing: they previously pinned a fallback contract
that production could never execute.

**`raw * 1000` overflowed the timer.** `setTimeout` cannot represent a delay
above 2^31-1 ms; Node replaces a larger one with 1 ms and emits a
`TimeoutOverflowWarning` on stderr. Measured on the unfixed
branch: `timeout: 3600000` (an hour written in milliseconds -- the exact
population the CHANGELOG names) armed the ladder and produced
`["SIGTERM","SIGKILL"]` within 253 ms of real time. The original bug,
resurrected on a different input band.

The fix for that one was a design change rather than a clamp bolted onto the
parser, at the operator's direction: the bridge now speaks SECONDS throughout
and converts once, inside `installTimerLadder`, next to the `setTimeout` that
forces milliseconds. Clamping there covers the SIGTERM leg and the
`+ SIGKILL_GRACE_SECONDS` leg by construction -- clamping in the parser would
have left the band where SIGTERM fits and the SIGKILL leg does not. It also
collapsed the two duplicated `DEFAULT_TIMEOUT_MS = 600_000` constants into one
`COMMAND_DEFAULT_SECONDS`, so the lanes can no longer drift on the default
either, which the first round's CHANGELOG had claimed without it being true.

**The defaults did not match upstream either.** Raised by the operator after
the two Critical fixes landed. Claude Code lowers the 600 s `command` default
per event -- `UserPromptSubmit` to 30 s, `MessageDisplay` to 10 s -- and gives
`SessionEnd` hooks a shared 1.5 s budget. The bridge applied a flat 600 s from
a constant. One `resolveTimeoutSeconds` call now resolves the declared value,
its lane, and its per-event default together, so no call site can pair a value
with the wrong default. `MessageDisplay` needs no entry: Pi exposes no render-time hook
on assistant messages, so the event is not bridged.

That forced the module out of `shared/`, which the reviewers had already
flagged on placement grounds: the default table keys on `BucketAEvent`, and
`.fallowrc.json` does not let the `shared` zone import `domain`. It now lives
at `bridges/hooks/timeout.ts`, beside both of its consumers.

`SessionEnd`'s shared-budget accounting and its 60 s ceiling are deliberately
not implemented -- that is a dispatch-shape change to `reduceBucket` and the
`HookExecutor` seam, not a lookup table. HKTO-01 is rewritten to cover exactly
that remainder.

Three gaps were closed alongside were schema-leniency tests for `timeout` in the
sibling three-test shape, a clamp gate in `exec-timer.test.ts`, and
and a declared `timeout` on the existing real-spawn integration fixture. That
last one was inert as first written and had to be fixed in the second round --
see below.

## Second review round

The loop's re-review is the step that earns it: the tree it examined had taken
a module move, a signature change, a schema change, and a new default table
since the first round, and none of that had been reviewed. It returned two
Important findings, both raised independently by two reviewers.

**The per-event defaults were applied to the async lane, where their rationale
does not hold.** Upstream lowers `UserPromptSubmit` to 30 s and `SessionEnd` to
1.5 s because the handler holds up the turn. An `asyncRewake` handler is
registered and left to run while dispatch returns immediately, so an async
reindex hook that ran 90 s under the old 600 s default would have been
SIGTERM'd at 30 s, taken the `code !== 2` arm, and never delivered its rewake
injection -- a regression introduced by the fix, landing on config that
declared no timeout at all. Upstream is silent on whether background hooks take
the reductions, so there was no parity answer either way; the deciding argument
was that the stated rationale is turn-blocking and `asyncRewake` has no
upstream analog. `resolveTimeoutSeconds` now takes an explicit
`lane: "blocking" | "background"`, and `background` keeps 600 s on every event.

**A ladder kill was undiagnosable, and the new defaults made it fire on
previously-working config.** A timed-out hook reached the wire protocol as a
bare signal kill -- no plugin, no event, no budget, indistinguishable from an
OOM kill. Before, that required an author to declare a short timeout, and the
units bug meant those hooks were already dead; now the default kills, so a
`SessionEnd` hook that flushed logs in 3 s and completed under 600 s dies at
1.5 s. The ladder now logs both legs with the plugin, event, and elapsed
budget, and the ceiling clamp and the non-finite guard log too.

Also taken from that round: `BLOCKING_EVENT_DEFAULT_SECONDS` became a total
`Record<BucketAEvent, number | undefined>`, so a new bucket-A event is a
compile error at the table rather than a silent inheritance of 600 s -- proved
by deleting an entry and watching `tsc` fail with TS2741. `installTimerLadder`
guards its own floor rather than trusting its caller. Both lane defaults gained
call-site gates, and the async one was proved by planting the regression: with
the lane swapped back the gate fails while the unit test stays green, which is
exactly why the unit test could not have caught the defect.

The comment reviewer found four Critical and seven Important accuracy defects,
all in prose -- including "silently reduced to 1 ms" written three times when
the probe output on screen showed Node printing a `TimeoutOverflowWarning`, a
"Not done" section describing a tree two rounds out of date, and an EXEC-02
citation attached to a per-event table that EXEC-02's own text contradicts
("bridge-wide default"). The unit and the table are now cited to upstream, and
EXEC-02 keeps the ladder semantics it actually specifies.

`docs/research/claude-hook-config-syntax.md` -- the repo's primary-source
capture -- was itself missing the `SessionEnd` budget, so a maintainer checking
the shipped 1.5 s against it would have found it contradicted by omission. That
row is updated and dated.

## Third review round

The re-review earned itself again. Three of four reviewers independently found
the same Critical, in code this PR did not write.

**The SIGKILL escalation had never worked.** `installTimerLadder`'s second leg
guarded on `child.killed`, which Node sets when a signal is successfully SENT
and never clears. The SIGTERM leg five lines above sets it, so the guard was
always false and the escalation never escalated. Measured against a real child
running `trap '' TERM`: `killed` true, `exitCode` null, still alive. EXEC-02
specifies "SIGTERM -> 5 s grace -> SIGKILL"; the bridge has only ever done
SIGTERM.

The defect predates this change, but the change is what makes it reachable. At
a flat 600 s the ladder essentially never engaged; at 1.5 s on `SessionEnd` it
engages routinely, and a shutdown hook that traps SIGTERM -- an ordinary shape
-- then survives, never gets SIGKILL, and `spawnAndCollect` waits on `close`
forever. The lowered default converted a kill into a hang. Both legs now guard
on exit state (`exitCode`/`signalCode`), which is what "has it exited" actually
means. Proven end to end for a direct child: one that traps SIGTERM is escalated to
SIGKILL and `close` fires with `signal=SIGKILL`. That is not a general
guarantee. If a grandchild inherited the stdout pipe and outlives the shell,
`close` still does not fire even after a successful SIGKILL -- measured at
`exit` in 517 ms with no `close` at 9 s. The escalation is sufficient for the
child the bridge spawns, not for everything beneath it; HKDR-01 carries the
remainder.

**Its test spy was the reason nobody noticed.** `makeSpyChild.kill()` recorded
the signal without setting `killed`, while the two sibling spies in the same
test surface do set it -- so every SIGKILL assertion, including one added
earlier in this task, was green against a branch production could not reach.
The spy is now faithful. That is the third instance in this task of a gate that
verified its own mock rather than the code.

Also from this round: the degenerate-input gate now pins WHERE it degrades to
rather than only that the kill is not immediate (mutating the target to a short
budget previously passed, and short is the dangerous direction); `UNLOWERED` in
the resolver's test is derived from `BUCKET_A_EVENTS` instead of hand-listed,
since `satisfies` accepts a proper subset; and a call-site gate now pins that
the lanes pass their own `pluginId` and event into the attribution line -- the
full unit suite had stayed green with a hardcoded plugin id planted there.

`HKDR-01` records what the SIGKILL fix does not close: the blocking lane
settles on `close`, so a grandchild inheriting the stdout pipe can still pin a
turn after its parent shell dies. The async lane listens on `exit` and does not
share the defect.

## Fourth review round, and where the loop stopped

No reviewer found a Critical. The count across rounds ran 2, 2, 1, 0, which is
the convergence signal; every round-4 finding was completeness of a gate rather
than a defect in behavior.

The theme was that a fix had landed on one lane or one argument instead of on
the class. The attribution gate added in round 3 covered the blocking lane, and
mutating the async lane's `pluginId` to a literal still passed the entire suite;
neither lane's ladder label was observable at all; `hasExited`'s `signalCode`
arm had no coverage, so an exitCode-only predicate would have read a signalled
child as still running and logged "the child ignored SIGTERM" about one that
obeyed; and `UNLOWERED`, freshly derived to avoid hand-maintenance, could be
made vacuous by widening `LOWERED` and would then have iterated nothing while
passing. All five are now gated, each verified by planting the mutation.

Three comments still asserted the `!child.killed` guard that round 3 disproved,
one of them seven lines from the docstring saying the opposite -- a standing
invitation to undo the fix. The compatibility table claimed full parity for
`timeout` while HKTO-01 recorded two deviations; it now reads a partial-parity
marker. The CHANGELOG said the field is read as seconds "again", which never
happened -- it shipped as milliseconds and stayed that way until this change.

The loop stopped at its four-round cap rather than on a clean round. Criticals
are at zero and the round-4 findings are fixed, but the fixes themselves have
not been re-reviewed, so a fifth round would be needed to close it formally.

## Deviations from plan

- The task opened as artifacts-only. Two review findings were folded in on the
  operator's call: the call-site gates and the compatibility-doc unit. The
  contributor's own five files are unmodified.
- No version bump. `0.16.1` is published; the fix sits under `[Unreleased]`,
  matching how #127 was handled.

## Not done

- **`SessionEnd`'s shared budget and its 60 s ceiling.** Upstream shares that
  1.5 s across every `SessionEnd` hook, and raises the budget to match a longer
  declared `timeout` up to 60 s. The bridge applies the default per hook and
  honors a declared value unbounded. Both are dispatch-shape changes -- a
  deadline threaded through `reduceBucket` and the `HookExecutor` seam, which
  every event and every executor-injecting test depends on -- not a lookup
  table. Filed as HKTO-01 with a fix shape.
- **`MessageDisplay`'s 10 s reduction.** Nothing to do: Pi exposes no
  render-time hook on assistant messages, so the event is not bridged.
- **Defaults for the non-`command` handler types.** `prompt` (30 s) and `agent`
  (60 s) are unsupported handler types -- `partitionGroupHandlers` drops every
  non-`command` handler at parse time -- so neither default has anything to
  attach to.
- **Two review suggestions left deliberately.** A minimum floor on a declared
  `timeout` (a hook can still ask for 0.5 ms and be killed at spawn) was
  skipped because any floor value would be invented rather than upstream's, and
  the realistic input is nobody's. Hoisting the unusable-value debug line from
  dispatch time to parse time was skipped because dispatch is the site that
  holds the plugin, event, and lane needed to attribute it; the cost is one
  repeated line per dispatch, and only under `PI_CLAUDE_MARKETPLACE_DEBUG=1`.
- **Two adjacent staleness items, pre-existing and out of scope.**
  `bridges/hooks/if-field/index.ts` says unknown prefixes "fall open silently"
  where the code logs, and `platform/README.md` still calls
  `git-credential.ts` the only file permitted to import `node:child_process`
  when the architecture test names three.
