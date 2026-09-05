# Phase 113: Update, enable/disable, reconcile - Context

**Gathered:** 2026-09-05
**Status:** Ready for planning

<domain>
## Phase Boundary

The remaining lifecycle verbs treat workflows as a first-class component kind,
and the read surfaces show them.

In scope: the `update` re-stage (prepare / abort / commit / record) as a sixth
bridge; `enable` and `disable` materializing and unstaging envelopes with the
staged names riding on the projection both verbs read; a load-time reconcile
that does not re-materialize on every load; the `info` `workflows:` line; the
`info` tense fix for the four discovery warning phrases (WR-09); making the
already-widened `workflows` failure-phase slots reachable (WR-03); and a read
surface that names a retained staging tree (WR-06).

Out of scope: the soft-dependency probe and the executable-code contract
document (Phase 114); install-time admission-gate warnings (Phase 115); the
supported-set-growth backfill (Phase 116, WCONV-01..03).

</domain>

<decisions>
## Implementation Decisions

### Criterion 5 — the discovery outcome-phrase tense (WR-09)

`discoverPluginWorkflows` serves both the staging pass and the read-only `info`
pass, and all four outcome phrases in `bridges/workflows/discover.ts` currently
assert an install outcome. Phase 111 declined the wording and named this phase
as its owner, because `info` is built here and the phrasing is shipped text.

- **Mechanism.** Add a `tense: "install" | "preview"` discriminant parameter to
  the discovery call. Both phrase tables stay module constants inside
  `discover.ts`. The ROADMAP's literal wording is "make the outcome phrase a
  parameter"; a tense discriminant is the minimal reading that satisfies the
  intent — each surface states its own tense — while keeping one owner for the
  wording, so the two tenses cannot drift and no caller can invent a phrase.
  Do NOT pass the four phrases in as an `outcomes` record, and do NOT add a
  second exported `previewPluginWorkflows` wrapper.

- **Preview wording.** Future tense, paired 1:1 with the install phrases so a
  reader who meets the same condition on both surfaces recognizes it:

  | verdict / site | `install` tense | `preview` tense |
  |---|---|---|
  | `skipped` | `was not installed` | `will not be installed` |
  | `refused` | `was refused` | `will be refused` |
  | `stem-fallback` | `was installed but will not run` | `would be installed but will not run` |
  | `readFile` failure | `could not be read and was skipped` | `could not be read` |
  | `lstat` failure | `could not be inspected and was skipped` | `could not be inspected` |

  Wording inside those cells is Claude's discretion within that meaning and the
  existing `softFailWarning` template — do not compose a second template, and
  keep the house subject-first row grammar (the file is the subject).

- **The `lstat` site.** Criterion 5 names `"could not be read and was skipped"`
  as inaccurate at the `lstat` call site, where nothing was read. Split the
  read-failure phrase by CALL SITE, in both tenses, per the table above.
  `isWorkflowScriptFile`'s failure arm gets the `inspected` phrase; only
  `readScriptSource`'s arm keeps `read`.

- **The install-tense phrases stay byte-identical** apart from the `lstat` split
  above. Phase 111 fixtures pin them; retuning the other three is churn outside
  this criterion.

### Criterion 7 — the retained staging tree read surface (WR-06)

The ROADMAP proposes `{ leaks, retained }` as a second channel off the sweep.
That shape does not survive contact with the call sites: the sweep is
destructive and its only two callers are `install.ts` and `uninstall.ts`, which
would still discard `retained` — the exact "member both call sites discard"
Phase 112 refused to add. `info` and `pending` are documented no-write surfaces,
so neither can call a sweeper. Settle it as:

- **A separate read-only scan.** Add a sibling
  `scanRetainedWorkflowsStaging(locations)` in
  `orchestrators/plugin/workflows-staging-gc.ts`, sharing
  `holdsDisplacedEnvelopes` and the `assertPathInside` containment assertion
  with the sweep. `garbageCollectWorkflowsStaging` keeps its
  `Promise<string[]>` signature, so neither existing call site changes and
  neither gains a discarded member.

- **Rendered from `pending`.** It is the only read surface that is not
  plugin-scoped, and a retained tree is a recovery action the user must take,
  which is what `pending` reports. A UUID staging root is attributable to no
  plugin, so a per-plugin `info` row would have no key to hang it on.

- **An advisory body line per retained tree, not a row.** The subject is a
  path; the house row grammar's `name` slot expects a plugin or marketplace
  name, and forcing a UUID into it would abuse the grammar rather than use it.
  Carry the staging path and the envelope count, per the ROADMAP.

- **Same set the sweeper keeps forever.** Report exactly the trees the sweep
  declines to remove for the WR-02 reason: the same `holdsDisplacedEnvelopes`
  predicate AND the same `WORKFLOWS_STAGING_MAX_AGE_MS` age bound, so a live
  transaction mid-commit is never reported. Sort by directory name for
  `pending`'s byte-identical-on-repeat contract. Render nothing when the set is
  empty.

### Update, enable/disable, and the `info` surface

- **`previousWorkflowNames` come from the recorded inventory**
  (`record.resources.workflows`) at both `update` and `enable`. This is WR-01's
  "wiring the recorded inventory at the ledger" and it is what makes the
  existing displace/restore commit path and the WR-06 ownership pre-check
  reachable. Do not re-discover the pre-update plugin tree to derive them.

- **The `info` `workflows:` line lists the two ADMITTED arms** (`named` and
  `stem-fallback`), rendered as their generated `<plugin>:<name>`. An envelope
  is written for both, so listing only `named` would make `info` disagree with
  what install puts on disk. The `stem-fallback` caveat is already carried by
  its own preview warning, so the line does not need to repeat it. Placement
  follows the existing alphabetical per-kind order in
  `appendResolvedComponentLines`, which puts `workflows` last.

- **"`list` counts the kind" is a regression guard, not new rendering.** `list`
  carries no per-kind count for any of the five existing kinds, and Phase 109
  already made `workflows` count on the resolve/classification axis. Cover the
  `list` half with a paired fixture that pins a workflow-bearing plugin's row;
  put the new user-visible rendering on `info` only. Adding a workflows count
  to the `list` row would introduce a per-kind surface no other kind has.

- **Criterion 6 wants one case per widened slot, driven through the `update`
  verb** — both `update.ts` failure-phase arrays, `orchestrators/types.ts`, and
  `shared/errors.ts`. The criterion's claim is that each widened slot is
  REACHABLE; a single end-to-end case proves only the arm it happens to hit and
  leaves the rest inferred, which is the state criterion 6 exists to end.

### Claude's Discretion

Everything else. In particular: the plan decomposition, the update Phase 3a
wiring details, how the staged workflow names ride the enable/disable
projection, what shape criterion 3's no-re-materialize guard takes, and all
test structure. Use the ROADMAP's eight success criteria, the Phase 111 and 112
artifacts, and the codebase conventions.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `bridges/workflows/` is complete as a discover / stage / unstage triplet.
  `prepareStageWorkflows` (`stage.ts:127`) already accepts
  `previousWorkflowNames` and defaults it to `[]`; the displace/restore commit
  path and the WR-06 ownership pre-check (`stage.ts:278`) are already built and
  are waiting for a caller that supplies the list.
- `orchestrators/plugin/workflows-staging-gc.ts` holds
  `garbageCollectWorkflowsStaging`, `WORKFLOWS_STAGING_MAX_AGE_MS`, and the
  private `holdsDisplacedEnvelopes` predicate — the WR-02 retention rule the new
  scan must reuse rather than restate.
- `cascadeUnstagePlugin` (`orchestrators/marketplace/shared.ts`) already calls
  the sixth unstage, so `disable`, `uninstall` and `marketplace remove` inherit
  workflow removal (Phase 112 / CR-02).
- `runInstallLedger` (`orchestrators/plugin/install.ts`) already carries the
  sixth workflows ledger phase, and `enable-disable.ts:251` reaches
  materialization through it rather than through `runPhases`.

### Established Patterns

- `update.ts` Phase 3a is "physical replace, aggregate failures, continue
  across bridges" — a bridge failure does NOT abort the update; failures
  accumulate as `Phase3Failure` and the record finalize is gated on
  `phase3aFailures.length === 0`. The workflows arm follows that policy, not an
  abort.
- `PHASE3_FAILURE_PHASES` (`update.ts:1448`) already carries `"workflows"`, as
  do `orchestrators/types.ts` and `shared/errors.ts`. Nothing produces it yet;
  that is criterion 6.
- `appendResolvedComponentLines` (`shared/notify.ts:3538`) renders
  `    <kind>: <name>, <name>` per kind from the deliberately exact-length
  `COMPONENT_KINDS` tuple (`notify.ts:3522`, 5 entries) keyed off
  `PluginInfoComponentsResolved["components"]` (`notify.ts:1511`). Both the
  interface and the tuple need a sixth member. Treat the tuple's
  "adding a 6th key breaks the typecheck" comment as a claim to VERIFY, not a
  guarantee to lean on — a widened closed set compiling clean at its derivation
  sites is a repeat failure mode in this codebase.
- All user-visible output goes through `shared/notify.ts` (IL-2), and `info` /
  `pending` output is under the project's byte-equality fixture contract.

### Integration Points

- `orchestrators/plugin/update.ts` — prepare (alongside the five
  `prepareStage*` calls near line 1317), abort, Phase 3a commit, and the record
  write.
- `orchestrators/plugin/enable-disable.ts` — the projection both verbs read
  must carry the staged workflow names.
- `orchestrators/reconcile/apply.ts` — criterion 3's no-re-materialize
  guarantee.
- `orchestrators/plugin/info.ts` + `info.messaging.ts` + `shared/notify.ts` —
  the `workflows:` line and the `preview` tense.
- `orchestrators/reconcile/pending.ts` — the retained-tree advisory line. Note
  its documented contracts: never writes a file, exactly ONE `notify()` call
  per invocation (IL-2), and byte-identical output on two consecutive
  invocations against unchanged state.

</code_context>

<specifics>
## Specific Ideas

- The preview/install phrase pairing table under criterion 5 is the shipped
  text for this phase; it will be quoted back.
- `garbageCollectWorkflowsStaging`'s signature must not change. Its two call
  sites wrap it in a bare `catch {}` under D-19-01, and widening its return
  would hand both of them a value they discard.

</specifics>

<deferred>
## Deferred Ideas

- Naming the retained tree from `info` as well as `pending`. Rejected here
  because the tree is attributable to no plugin; revisit only if a
  non-plugin-scoped `info` arm ever exists.
- Per-kind component counts on the `list` row. Out of scope: no existing kind
  has one, so adding it for `workflows` alone would be an inconsistency, not a
  feature.

</deferred>
