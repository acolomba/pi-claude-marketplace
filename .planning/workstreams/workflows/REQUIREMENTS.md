# Requirements: pi-claude-marketplace - Workflows workstream

**Defined:** 2026-08-16
**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artifact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install.

**Milestone goal:** Close the three gaps the `workflows` bridge shipped with -- a script shape that installs and then refuses to run with no install-time signal, a population of existing installs that never gains its workflow commands, and a load-bearing runtime claim backed only by a source read.

**Evidence base:** Every claim below was established during the validation audit of phases 101-105 (2026-08-16) by reading the shipped sources and tests, running the suites, and driving the real admission logic against the seven workflow scripts shipped by the two Anthropic-authored plugins that carry a `workflows/` directory (`claude-security`, `code-modernization`). Engine claims were re-measured against `@quintinshaw/pi-dynamic-workflows` 3.10.1 in Spike 027.

## Milestone: workflows-replay (active)

**Goal:** Re-land the shipped `workflows` bridge on a main that has since
declared `workflows` an *unsupported* kind (#154) and replaced the test
architecture the bridge was written against (#167).

The requirements the replay re-lands are not restated here. They are the 36
already written, verified, and archived in
[`milestones/workflows-REQUIREMENTS.md`](milestones/workflows-REQUIREMENTS.md)
— WFLW, WBRG, WNAM, WPTH, WLIF, WDEP, WDOC. Phases 110-114 carry those
unchanged, with one correction: WFLW-03's premise ("`workflows` sits in neither
list, so a workflow-bearing plugin gets no signal") stopped being true when
#154 landed. The requirement is already satisfied on main by the opposite
mechanism, and the replay must keep a signal while changing which one.

Only the requirements below are new, and all of them exist because #154 landed.

### Kind Inversion

<!-- Seams: domain/resolver.ts (UNSUPPORTED_COMPONENT_KINDS, UNSUPPORTED_COMPONENT_CONVENTIONS, both supported tuples), shared/notify-reasons.ts (the REASONS closed set), shared/probe-classifiers.ts (narrowUnsupportedKinds), tests/architecture/notify-closed-set-locks.test.ts, tests/architecture/catalog-uat.test.ts, tests/architecture/compat-01-no-expansion.test.ts, docs/output-catalog.md. -->

- [x] **WINV-01**: `workflows` leaves `UNSUPPORTED_COMPONENT_KINDS` and its `UNSUPPORTED_COMPONENT_CONVENTIONS` entry, and joins `SUPPORTED_COMPONENT_KINDS` and `SUPPORTED_COMPONENT_PATH_KINDS`. The convention directory `<pluginRoot>/workflows/` keeps the same name and the same probe; only which tuple reads it changes.
- [x] **WINV-02**: A plugin that resolved `partially-available {workflows}` before the inversion resolves `installable` after it, and installs on a normal install rather than needing `--partial`. This is the user-visible inversion and the one that must not be silent. Envelope materialization is deliberately NOT part of this requirement: the clause that once read "installs its workflow envelopes" was struck as redundant with WLIF-01 ("Install materializes workflows as a 6th phase of the transactional ledger"), which owns that behavior in Phase 112. WINV-02 therefore closes in Phase 109; the absence of any workflow artifact during the 109-111 window is pinned as a test rather than treated as a gap (D-109-06, D-109-07).
- [x] **WINV-03**: The dedicated `workflows` member of the `REASONS` closed set is retired together with its `probe-classifiers` arm, or kept with a stated second meaning. It cannot stay as-is: it means "this plugin has workflows and we dropped them", which becomes false. Whichever way it goes, the closed-set counts named in the `notify-reasons.ts` header comment and the byte-pinned catalog states move with it.
- [x] **WINV-04**: Every test #154 wrote that locks the unsupported reading is turned rather than deleted. `compat-01-no-expansion`, `catalog-uat`, and `notify-closed-set-locks` each assert the old meaning; each must assert the new one, so the inversion is proved by a red-then-green test and not by an absence.
- [x] **WINV-05**: `docs/output-catalog.md` and any `docs/` prose stating that workflow-bearing plugins degrade is corrected in the same phase that changes the behavior, so the published contract never describes the losing side of the inversion.

## Milestone: workflow-hardening (planned)

### v1 Requirements

### Admission-Gate Signal

<!-- Seams: domain/workflow-script.ts (admitWorkflowScript's decision order, the parseScript result the gates read), bridges/workflows/stage.ts (the warnings[] accumulator), docs/workflows-compatibility.md (the admit-versus-run table). Backlog rationale: BACKLOG.md WGATE-01. -->

- [x] **WGATE-01**: A workflow script whose shape the host engine will refuse at invocation installs with a per-script warning naming the refusing gate, so a plugin author learns at install time instead of at first invocation. The install still succeeds and sibling scripts are unaffected.
- [x] **WGATE-02**: The six gate checks read off the acorn parse `admitWorkflowScript` already performs. No second parse, and no vendored engine internal beyond what is needed to name the gate.
- [x] **WGATE-03**: A gate warning never refuses a script and never fails a plugin. This is the requirement that keeps the self-correcting error direction: if a later engine relaxes a gate, the cost is one spurious warning rather than a blocked install that only an extension release can clear.
- [x] **WGATE-04**: The determinism blocklist keeps its existing refusal behavior. It stays the one replicated gate because it is the one whose failure the engine reports wrongly -- a raw-text screen cannot tell a call from a mention, so a script is refused for a rule its comment merely names.
- [x] **WGATE-05**: `docs/workflows-compatibility.md`'s admit-versus-run table restates its "Replicated by this bridge?" column as replicate / warn / neither, so the published contract matches shipped behavior rather than describing the six gates as unhandled.

### Convergence

<!-- Seams: orchestrators/reconcile/ (the supportedSetGrew scan and its early return on cleanly-installed records), tests/orchestrators/reconcile/backfill.test.ts (the three boundary cases that pin the current behavior). -->

- [x] **WCONV-01**: A user who installed a workflow-bearing plugin before the `workflows` kind was admitted gains its workflow commands on the next load, without running `update` or `reinstall`. The scan used to return early on any record at `installable: true`, so the population whose install already works was exactly the population that never converged: a plugin declaring a kind the extension did not yet support records `installable: true` with that kind simply absent, which is indistinguishable from a clean install. Bounded to path sources -- the load-time re-resolve passes no clone-cache resolver, so a git source resolves `unavailable` offline and only path-source records converge through this scan (49 of the 172 entries in the cached official marketplace are path sources; the other 123 are `url`, `git-subdir` or `github`). Measured 2026-09-09 against that cache: of the two Anthropic-authored plugins named under Evidence, only `code-modernization` is present at the cached revision and it is a path source, while `claude-security` is absent under that name, so its source kind is unmeasured. No entry in either cached marketplace declares or carries a `workflows/` directory, so the named population has no member reachable from this machine. Every success criterion of the convergence phase holds either way: the bound decides which records can converge, not whether the convergence works.
- [x] **WCONV-02**: The self-heal stays one-time. An equal supported set is not growth, and the extension-version stamp bounds the scan to a single pass -- the same two bounds the `installable: false` arm already relies on, rather than new machinery.
- [x] **WCONV-03**: A convergence that materializes artifacts says so on its reconcile row instead of healing silently, so a user can tell why new commands appeared after a reload they did not initiate.

### Evidence

<!-- Seams: tests/live-uat/workflow-storage-canary.mjs (the standing live driver), docs/workflows-compatibility.md (script-semantics section and its evidence-grade labels). -->

- [x] **WEVID-01**: The live-UAT canary drives the host engine's `agent()` failure path and asserts the observed behavior, with a negative control proving the assertion can fail. This is currently the weakest link in the compatibility chain and the one that matters most: it decides whether a script degrades or dies.
- [x] **WEVID-02**: `docs/workflows-compatibility.md` restates the `agent()` divergence at its measured grade, and names the concrete consequence for the upstream `pipeline(...)` + `.filter(Boolean)` pattern -- which six of the seven real Anthropic workflow scripts use, twelve times in total.

### Documentation Hygiene

<!-- Seams: .planning/BACKLOG.md (the trailing <!-- Pruned --> convention), .planning/workstreams/workflows/milestones/workflows-phases/105-*/105-VERIFICATION.md. -->

- [x] **WDOCS-01**: `WFLW-01` is pruned from `.planning/BACKLOG.md` under the file's existing pruned-footer convention, naming the milestone that closed it, so the backlog stops advertising shipped work as open.
- [ ] **WDOCS-02**: `105-VERIFICATION.md` no longer contradicts itself. Its evidence table currently records the live canary as `UNRUN` while its own frontmatter and status line record it closed on 2026-08-16; the current record wins and the stale wording goes.

## Future Requirements

Deferred. Tracked but not in this milestone's roadmap.

### Engine Coupling

- **WPIN-01**: A machine-checkable re-read of the vendored `DETERMINISM_BLOCKLIST` and the envelope/storage internals against a newer engine, so an upgrade fails loudly instead of silently disagreeing. Today the doc instructs a human to re-read on every bump.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Replicating checks 3-9 as install-time refusals | Only makes us stricter than the engine, and the strict direction does not self-correct across engine upgrades. WGATE-03 pins the warn-instead posture deliberately. |
| Adding `@quintinshaw/pi-dynamic-workflows` as a declared dependency | Would couple `npm run check` to a 0.x package with ~50 releases since May 2026 and no exported contract. The live-UAT route exists precisely to avoid this. |
| Backfilling records whose supported set did not grow | Equality is not growth. Re-materializing on every load is the failure WCONV-02 exists to prevent. |
| A first-party Pi workflow API to target instead of the engine | Pi ships none at the pinned version. Nothing to build against. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| WINV-01 | Phase 109 | Complete |
| WINV-02 | Phase 109 | Complete |
| WINV-03 | Phase 109 | Complete |
| WINV-04 | Phase 109 | Complete |
| WINV-05 | Phase 109 | Complete |
| WNAM-01, WNAM-02, WNAM-04, WNAM-05, WNAM-06 | Phase 110 | Complete (verified 20/20, 2026-09-05) |
| WNAM-03 | Phase 110 -> Phase 111 | Partial - classification half done in 110-03; the warning and not-installed halves are Phase 111's |
| WPTH-02 | Phase 110 -> Phase 111 | Complete - home-derivation half proved in 110-01; the never-written guarantee closed in Phase 111 |
| WBRG-01..04, WPTH-01, WPTH-03..05 | Phase 111 | Complete (verified 9/9, 2026-09-05) |
| WLIF-01, WLIF-03 | Phase 112 | Complete (verified 7/7, 2026-09-05) |
| WLIF-02 | Phase 112 (type) -> Phase 113 (behavior) | Split - the archived milestone defines WLIF-02 as *update*, which the ROADMAP assigns to Phase 113. Phase 112 ships the widened ledger `phase` union; Phase 113 ships the update re-stage. Corrected 2026-09-05 from a row that booked all of WLIF-01..03 to Phase 112. |
| WLIF-04 | Phase 113 -> Phase 112 | Complete - reinstall's replace semantics landed in `112-03` (`b6ed30e8`, `c97ca097`, `e785a865`), not in Phase 113. Corrected 2026-09-05 from a row that booked WLIF-04..06 together to Phase 113, and only after the evidence passed: `tests/orchestrators/plugin/reinstall.test.ts#WLIF-04: a reinstall REPLACES a workflow envelope at its recorded target` (old bytes gone, new bytes at the same target, record rewritten, adjacent plugin's envelope byte-unchanged) plus its sibling `#WLIF-04: a workflow the new version drops leaves neither an envelope nor a record entry`. |
| WLIF-05 | Phase 113 | Complete - `disable` removes and `enable` re-materializes workflow envelopes, with the staged names riding `InstallLedgerSummary.stagedWorkflowNames`. Evidence: `tests/orchestrators/plugin/enable-disable.test.ts` and `tests/orchestrators/plugin/install.test.ts`. |
| WLIF-06 | Phase 113 | Complete - the lingering retired command names the reload remedy via the `stale workflow command` reason token, stamped by six verbs (uninstall clean + failed, disable both arms, reinstall, update, enable). Kept off the exported enable/disable outcome union so the load-time reconcile projection cannot stamp it. Evidence: `tests/architecture/notify-closed-set-locks.test.ts`, `tests/architecture/compat-01-no-expansion.test.ts`, `tests/architecture/catalog-uat.test.ts` and the per-verb suites. |
| WFLW-04 | Phase 113 | Complete - `componentPaths.workflows` is consumed by the `info` read surface, which renders the `workflows:` line from the admitted arms. Evidence: `tests/orchestrators/plugin/info.test.ts` and the paired catalog states. |
| WDEP-01 | Phase 114 | Complete |
| WDEP-02 | Phase 114 | Complete |
| WDEP-03 | Phase 114 | Complete |
| WDEP-04 | Phase 114 | Complete |
| WDOC-01 | Phase 114 | Complete |
| WDOC-02 | Phase 114 | Complete |
| WDOC-03 | Phase 114 | Complete (verification-only — `acorn` was already declared) |
| WGATE-01 | Phase 115 | Complete |
| WGATE-02 | Phase 115 | Complete |
| WGATE-03 | Phase 115 | Complete |
| WGATE-04 | Phase 115 | Complete |
| WGATE-05 | Phase 115 | Complete |
| WCONV-01 | Phase 116 | Complete |
| WCONV-02 | Phase 116 | Complete |
| WCONV-03 | Phase 116 | Complete |
| WEVID-01 | Phase 117 | Complete |
| WEVID-02 | Phase 117 | Complete |
| WDOCS-01 | Phase 115 | Complete |
| WDOCS-02 | Phase 117 | Pending |

**Coverage:**

- New in this workstream's active plan: 5 (WINV-01..05), all mapped to Phase 109.
- Re-landed from the archived `workflows` milestone: 36, mapped across Phases
  110-114. Their text lives in
  [`milestones/workflows-REQUIREMENTS.md`](milestones/workflows-REQUIREMENTS.md);
  WFLW-03 and WNAM-06 carry replay amendments recorded there.
- Hardening: 12 (WGATE, WCONV, WEVID, WDOCS), mapped across Phases 115-117.
- Unmapped: 0.

**Completeness caveat.** The hardening milestone was defined in an interrupted
session — its ROADMAP, REQUIREMENTS and STATE were uncommitted working-tree
edits on `features/workflows-spike` when work stopped. They are internally
consistent and every requirement maps to a phase, but they were never reviewed
or verified as a finished set. Treat Phases 115-117 as a good draft rather than
a settled plan, and expect `/gsd-discuss-phase` to find gaps that a completed
session would already have closed. Spike 027 found one such gap already: the
gate count those documents state is wrong in both directions, and
`meta.description` is a refusal the milestone never named.

---
*Requirements defined: 2026-08-16*
*Traceability remapped: 2026-09-04 (replay Phases 109-114, hardening 115-117)*
