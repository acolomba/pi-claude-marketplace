# Phase 3: `marketplace add` recovers from its own leftover clone - Context

**Gathered:** 2026-09-27
**Status:** Ready for planning

<domain>
## Phase Boundary

A Pi user retrying `marketplace add` after a crash or a state rebuild succeeds when the directory
left behind is a clone of the very source being added, still gets the MA-6 refusal when it is
anything else, and is never left with a half-removed tree recorded in state — with the milestone's
whole gate surface green at its final HEAD.

Requirements: MA-12, MA-13, MA-14, GATE-01.

This phase also carries three milestone-closing obligations that are not the leftover-clone feature
itself: the autoupdate cascade decision (SC5), Phase 1's deferred runtime UAT (SC6), and the
`PROJECT.md` D-79-03 rationale amendment (SC7).

</domain>

<decisions>
## Implementation Decisions

### Recognizing "the same source"

- **D-3-01: compare on the CANONICAL IDENTITY, not the wire form or the raw string.** Recognition
  runs `canonicalCloneUrl(source)` against the leftover's `origin` remote, normalized the same way.
  Identity is precisely the "is this the same repo" question: it is `.git`-insensitive and
  fragment-free by construction, and D-2-05 (Phase 2) just made it a fixed point, so the same source
  compares equal to itself no matter how the user typed it. The wire form was rejected because it is
  `.git`-sensitive — the same repo typed with and without `.git` would fail to match — and a
  match-either-form rule was rejected as a wider definition of "same source" than the refusal
  deserves.
- Recognition stays at the EXISTING refusal site, `orchestrators/marketplace/add.ts` step 4
  (currently lines 725-729). That position is forced, not chosen: `finalDir` derives from
  `parsed.name` in the staged manifest, so the destination is not knowable before the staging clone
  and manifest read. A retry therefore still pays one clone to discover it could reuse — accepted.

### What happens to a recognized leftover

- **D-3-02: remove the leftover and rename the fresh staging clone into place.** The existing step-5
  atomic-rename path runs unchanged. The result is a known-good tree at a known ref, and the
  leftover's condition — dirty, partial, wrong ref — cannot leak into installed state. Reuse-in-place
  was rejected precisely because the WR-07 crash window that creates these directories is exactly
  when one is most likely to be partial; a conditional reuse-if-clean rule was rejected as a second
  recognition axis for no user-visible gain.
- MA-13's refusal is unchanged for every other case: not a git clone, unreadable, or an `origin`
  naming a different URL still throws `StaleSourceCloneError` and renders the `{stale clone}` row on
  the marketplace subject. Recognition must never widen into overwriting a directory the extension
  did not create.
- **MA-14 (SC3):** when a RECOGNIZED leftover cannot be fully removed, the add fails as stale with
  the cleanup leak appended per the existing MA-9 discipline (`cleanupStaging` +
  `appendLeakToError`), and state records no destination for the partially-removed tree.

### The `listRemotes` seam

- **D-3-03: `GitOps.listRemotes` returns a DISCRIMINATED VALUE, not a throw and not `undefined`.**
  "No origin", "not a git repo" and "unreadable" must be separate, inspectable outcomes so the MA-6
  refusal reads as an explicit branch rather than a catch, and so each arm is directly testable. A
  throw-and-catch shape would collapse "definitely a foreign tree" into "I could not look"; a bare
  `undefined` would lose the reason entirely, making a permissions error read identically to a
  foreign directory. This follows the codebase's own precedent for exactly this distinction —
  `ManifestLookup` (D-96-02) and the resolver's three-way state.
- Note this makes `listRemotes` the only `GitOps` member that does not throw on failure; the other
  seven do. That divergence is deliberate and should be stated where the member is declared.

### The autoupdate cascade (SC5)

- **D-3-04: FIX it in this phase.** `orchestrators/plugin/update-preflight.ts::buildBundle`
  (lines 161-173) returns `undefined` when `auth.ctx === undefined`, and
  `update-flow.ts::updateSinglePluginWith` — the `PluginUpdateFn` the cascade invokes — never passes
  a `ctx`, so the cascade clones authless on every host.
- The fix is narrow because of what Phase 1 already landed: `orchestrators/auth-host.ts::buildAuthForHost`
  declares `ctx: NotificationContext` as REQUIRED, but its no-provider arm (lines 172-186) never
  reads it — only the Device Flow arm does. So the ctx requirement is real for github.com/gitlab.com
  and spurious everywhere else.
- This closes a genuine gap between the milestone's "any git host" prose and what the cascade
  delivers. It is PRE-EXISTING and host-agnostic (it withholds auth from `github.com` identically),
  so it is not a Phase 1 regression and Phase 1 correctly left it alone.

### Claude's Discretion

- The exact shape of the `listRemotes` discriminated value (field names, whether the failure arm
  carries an `errno`), and whether recognition lives inline in `addGitClonedInGuard` or in a named
  helper beside it.
- Whether the SC5 fix makes `ctx` optional on `buildAuthForHost` or threads a ctx through the
  cascade — whichever keeps the Device Flow arm's contract intact with fewer touched call sites.
- Plan/wave decomposition, subject to the one-edit-at-a-time constraint below.

</decisions>

<specifics>
## Specific Ideas

The defect is the one PR #153 (jstillwa) actually reported: today
`orchestrators/marketplace/add.ts::addGitClonedInGuard` throws `StaleSourceCloneError` whenever
`sources/<name>/` exists, with no way to tell a leftover clone of the SAME source from a foreign
tree — so a crash-window retry or a state rebuild demands a manual `rm -rf` before every attempt.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### This phase's own scope
- `.planning/workstreams/git-hosts/ROADMAP.md` § Phase 3 — the seven success criteria, including the
  three milestone-closing obligations (SC5 cascade, SC6 Phase 1 canary, SC7 D-79-03 amendment)
- `.planning/workstreams/git-hosts/REQUIREMENTS.md` — MA-12, MA-13, MA-14, GATE-01

### Phase 2's decisions, which this phase builds directly on
- `.planning/workstreams/git-hosts/phases/02-endpoints-that-answer-only-at-the-verbatim-url/02-CONTEXT.md`
  — D-2-01..D-2-05. D-2-03 (identity vs wire separation) and D-2-05 (identity is a fixed point) are
  what make D-3-01's comparison well-defined.
- `.planning/workstreams/git-hosts/phases/02-endpoints-that-answer-only-at-the-verbatim-url/02-REVIEW-FIX.md`
  — the three `domain/source.ts` compositions and why they are deliberately not collapsed

### Milestone-wide constraint
- `.planning/workstreams/git-hosts/ROADMAP.md` § Milestone-wide constraints — GATE-01, green at
  every phase boundary
- `.claude/rules/typescript-comments.md` — decision and requirement IDs are wanted traceability in
  comments; phase/plan/wave/milestone numbers and `Pitfall N` refs are forbidden

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- `cleanupStaging` + `appendLeakToError` (`orchestrators/marketplace/add.ts`) already implement the
  MA-9 leak-append discipline MA-14 requires — SC3 is a new CALLER of an existing mechanism, not a
  new mechanism.
- The step-5 atomic rename (`mkdir` parent, `rename(stagingDir, finalDir)`) is the path D-3-02
  reuses unchanged.
- `canonicalCloneUrl` (`domain/clone-key.ts`) is the comparison input for D-3-01. It is a pure
  function of the parsed source with no I/O.
- `StaleSourceCloneError` (`shared/errors.ts:245`) carries `finalDir` and the derived `mpName`, which
  the ATTR-07 entrypoint catch uses to render the row on the marketplace subject — unchanged by this
  phase.

### Established patterns
- **Discriminated results over throws for "could not tell" distinctions** — `ManifestLookup`
  (D-96-02) and the resolver's three-way state are the precedent D-3-03 follows.
- **`GitOps` is the only network seam**; `platform/git.ts` is the only file importing isomorphic-git
  (D-13, enforced statically by `tests/architecture/import-boundaries.test.ts`). `listRemotes` must
  land in both the interface (`orchestrators/marketplace/shared.ts:150`) and the platform
  implementation.
- **NFR-5**: only git-cloned kinds reach `gitOps.*`. Recognition runs on a directory that may not be
  a git repo at all, so the new seam must tolerate that without violating the boundary.

### Integration points
- `orchestrators/marketplace/shared.ts:150` — the `GitOps` interface gains its 8th member.
- `platform/git.ts` — the implementation.
- `orchestrators/marketplace/add.ts:725-729` — the MA-6 refusal becomes a three-way branch.
- `orchestrators/plugin/update-preflight.ts:161-173` and `orchestrators/plugin/update-flow.ts` — the
  SC5 cascade fix.
- `orchestrators/auth-host.ts:163-169` — `buildAuthForHost`'s `ctx` requirement, the SC5 lever.
- `PROJECT.md` D-79-03 row (line 666) — SC7. Its OUTCOME still holds; its stated RATIONALE ("no
  `onAuth` callback registered at all for no-provider hosts — structural fail-clean") is FALSE after
  Phase 1, which registers one for every host. Rewrite the rationale; do not revisit the outcome,
  which is a recorded user checkpoint from 2026-07-11.

### Gate exposure to re-verify, not assume
- `scripts/check-unused-type-members.contracts.json` pins are `line:col` and currently total 108
  entries with 4 recorded exceptions. Phase 2 remapped six of them across three passes. Phase 3 adds
  a type member (`listRemotes`) and edits files that hold pins, so it must re-verify CURRENT
  coordinates rather than trust any number recorded earlier, and run `npm run format` BEFORE
  `lint:type-members`.
- `.fallowrc.json` sets `production.deadCode: true` — a new seam member read only by tests is a gate
  failure.
- ROADMAP's Phase 3 `Depends on` mandates one edit at a time through this seam for the same
  line:col reason.

</code_context>

<deferred>
## Deferred Ideas

- **Phase 1 and Phase 2's live canaries (SC6).** Both are deferred to the operator and recorded in
  `STATE.md` § Deferred Verification with resume commands. They block MILESTONE CLOSE only. Phase 3
  should carry them forward explicitly rather than attempt them; neither is closable on this machine
  (Phase 1 needs an operator PAT, Phase 2 needs a real verbatim-only smart-HTTP server).
- **The six Info findings from Phase 2's code review** (IN-01..IN-06) remain open by scope decision,
  recorded in `02-REVIEW-DISPOSITION.md`. Not this phase's work unless a plan touches the same lines.
- **Sweeping the orphaned `plugin-clones/` directory** left by D-2-05's one-time re-clone. The new
  identity is a fixed point so nothing accumulates, and GC is derive-at-collection-time (D-77-03) —
  but nothing actively removes the single stale directory. Out of scope here.

</deferred>

---

*Phase: 03-marketplace-add-recovers-from-its-own-leftover-clone*
*Context gathered: 2026-09-27*
