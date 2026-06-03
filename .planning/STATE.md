---
gsd_state_version: 1.0
milestone: v1.7
milestone_name: Transaction Resilience Hardening
status: "v1.7 shipped -- PR #30"
last_updated: "2026-06-03T00:49:12.622Z"
last_activity: "2026-06-02 -- v1.7 PR #30 created"
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 5
  completed_plans: 5
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-30)

**Core value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artefact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install. **Current focus:** Phase 41 -- Documentation and Test Closeout

## Current Position

Phase: Milestone v1.7 complete
Plan: --
Status: v1.7 shipped -- PR #30
Last activity: 2026-06-02 -- v1.7 PR #30 created

## Performance Metrics

**Velocity:**

- Total plans completed: 127
- Average duration: -
- Total execution time: -

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
| ----- | ----- | ----- | -------- |
| 01    | 7     | -     | -        |
| 02    | 6     | -     | -        |
| 04    | 10    | -     | -        |
| 05    | 10    | -     | -        |
| 07    | 6     | -     | -        |
| 08    | 4     | -     | -        |
| 12    | 4     | -     | -        |
| 13    | 10    | -     | -        |
| 14.1  | 2     | -     | -        |
| 14    | 6     | -     | -        |
| 14.2  | 5     | -     | -        |
| 15    | 3     | -     | -        |
| 16    | 6     | -     | -        |
| 17.2  | 4     | -     | -        |
| 18    | 7     | -     | -        |
| 19    | 6     | -     | -        |
| 20    | 6     | -     | -        |
| 21    | 4     | -     | -        |
| 22    | 1     | -     | -        |
| 23    | 2     | -     | -        |
| 24    | 1     | -     | -        |
| 25 | 3 | - | - |
| 26 | 1 | - | - |
| 27 | 5 | - | - |
| 28 | 2 | - | - |
| 29 | 3 | - | - |
| 30 | 1 | - | - |
| 31 | 2 | - | - |
| 32 | 1 | - | - |
| 33 | 1 | - | - |
| 34 | 1 | - | - |
| 35 | TBD | - | - |
| 36 | TBD | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

<!-- Updated after each plan completion -->

| Phase 07 P01 | 9 min | 3 tasks | 29 files |
| Phase 07 P02 | 4 min | 3 tasks | 9 files |
| Phase 07 P03 | 6 min | 2 tasks | 5 files |
| Phase 07 P04 | 11 min | 3 tasks | 10 files |
| Phase 07 P05 | 7 min | 3 tasks | 20 files |
| Phase 07 P06 | 2 min | 2 tasks | 4 files |
| Phase 08 P01 | 10 min | 2 tasks | 4 files |
| Phase 08 P02 | 12 min | 2 tasks | 8 files |
| Phase 08 P03 | 12 min | 2 tasks | 8 files |
| Phase 08 P04 | 23 min | 3 tasks | 5 files |
| Phase 09 P01 | 45 min | 3 tasks | 4 files |
| Phase 09 P02 | 35 min | 3 tasks | 6 files |
| Phase 09 P03 | 20 min | 3 tasks | 3 files |
| Phase 09 P04 | - | 4 tasks | 4 files |
| Phase 25 P01 | 14 min | 3 tasks | 4 files |
| Phase 25 P2 | 5min | 2 tasks | 2 files |
| Phase 27 P01 | 6 min | 2 tasks | 2 files |
| Phase 27 P02 | 9 min | 2 tasks | 5 files |
| Phase 27 P03 | 14 min | 3 tasks | 8 files |
| Phase 27 P04 | 18 min | 3 tasks | 6 files |
| Phase 28 P01 | 23 min | 3 tasks | 11 files |
| Phase 28 P02 | 12 min | 2 tasks | 5 files |

## Accumulated Context

### Roadmap Evolution

- Phase 14.1 inserted after Phase 14: Close gap: CMC-13 -- propagate declaresAgents/Mcp through import cascade rows (URGENT)
- Phase 14.2 inserted after Phase 14: Address tech debt: CR-01 + retroactive Phase 12 / 14.1 gates (URGENT)
- v1.4 roadmap (2026-05-25): 7 phases (15-21) created by `gsd-roadmapper`. All 32 SNM-_ requirements mapped: SNM-01..11 + SNM-21 -> Phase 15; SNM-12..18 + SNM-30 -> Phase 16; SNM-19, SNM-20, SNM-31 -> Phase 17; Phases 18 and 19 are execution-only migration waves (marketplace/_ and plugin/\* families) with no requirement closure; SNM-23 -> Phase 20 (edge family wave + UsageError migration); SNM-22, SNM-24..29, SNM-32 -> Phase 21 (final teardown + GREEN gate). SNM-22 maps to Phase 21 because its "wrappers deleted" half is the closure gate.
- Phase 17.1 inserted after Phase 17: V2 Grammar Amendment: Autoupdate Surface (URGENT)
- Phase 17.2 inserted after Phase 17: renderScopeBracket orphan-fold contract fix (URGENT)
- v1.4.1 roadmap (2026-05-28): 5 phases (22-26) created by `gsd-roadmapper`. All 8 SNM-\* requirements (SNM-33..SNM-40) mapped: SNM-33 -> Phase 22 (Reload-hint Discipline Family -- 3-gap chokepoint fix at shouldEmitReloadHint); SNM-34 + SNM-35 -> Phase 23 (Version Display Bundle -- tier-2 plugin.json fallback + v#<7hex> renderer transform; serialized within phase per shared/notify.ts convergence constraint); SNM-36 -> Phase 24 (Grammar Consistency -- lspServers REASONS rename + 13 call-site propagation); SNM-37 + SNM-38 + SNM-39 -> Phase 25 (Runtime Publish & Verification -- SNM-37 gates SNM-38/SNM-39; G-MIL-03 indent + G-MIL-07 completion reproduction-or-refutation against v1.4 runtime); SNM-40 -> Phase 26 (GREEN Gate Close). v1.4 phase dirs (15-21) intentionally left under .planning/phases/; v1.4.1 continues phase numbering at 22+ rather than archiving.

### Decisions

Decisions are logged in PROJECT.md Key Decisions table. Recent decisions affecting current work:

- Initialization: Adopt PRD verbatim as V1 spec (1068 lines, ~100 requirements)
- Initialization: Skip `/gsd-map-codebase` (PRD §9 already documents V1 architecture)
- Initialization: Two scopes only (`user`, `project`); no Claude `local`
- Initialization: 12-char SHA-256 truncation locked as user contract (PI-7)
- Roadmap: Adopt synthesizer's 7-phase split (dependency-graph inside-out: foundations -> primitives -> bridges -> marketplace orchestrators -> plugin orchestrators -> edge -> integration)
- Roadmap: Phase ledger primitive lands in Phase 2 (transaction primitive, not Phase 5 use-case)
- Roadmap: `MARKERS.ts` and symlink-aware `assertPathInside` land in Phase 1 so they propagate to every later phase
- Roadmap: Gap 3 (component-path supplement vs. replace) resolved in Phase 5 as supplement-fix; documented as "behavior corrected vs. V1"
- [Phase 07]: Pi API imports now flow through platform/pi-api.ts; @mariozechner/pi-coding-agent peer floor is pinned to >=0.73.1. -- Plan 07-01 established the NFR-11 wrapper and peer-dependency floor.
- [Phase 07]: NFR-8 manifest mtime caching remains deferred; Plan 07-02 shipped only the domain read seam and architecture gate.
- [Phase 07]: Completion resolver manifest reads route through the same domain seam as marketplace and plugin orchestrators.
- [Phase 07]: [Phase 07]: resources_discover now reads staged skills/prompts directly from disk across user and project scopes; index.ts wires the real Pi command/tool/event surface. -- Plan 07-03 replaced the Phase 1 stub with real Pi wiring and made /reload discovery reflect disk state.
- [Phase 07]: withStateGuard now owns cross-process same-scope mutation safety via a fail-fast proper-lockfile `.state-lock` around load-mutate-save. -- Plan 07-04 satisfies NFR-3 retry safety for concurrent installs.
- [Phase 07]: Concurrent install race verification uses forked IPC children invoking the real `installPlugin` path and asserts state/disk alignment after one lock-held loser. -- Plan 07-04 established the multi-process test pattern.
- [Phase 07]: [Phase 07]: PR e2e now uses pinned upstream SHA 6196a61bdeece7b9889ecda1e45bd7085788ae75 while nightly e2e uses floating main for upstream drift classification. -- Plan 07-05 established deterministic PR e2e and separate nightly drift classification.
- [Phase 07]: [Phase 07]: Real Pi runtime smoke is automated through the installed pi package bin with isolated HOME/cwd, avoiding the blocked agent-core API path. -- Research found agent-core lacks extension-loading API, so the package-bin smoke is the automatable runtime gate.
- [Phase 07]: D-25 supersedes PI-15 old concurrent-install marker; lock losers fail at per-scope acquisition with `STATE_LOCK_HELD_PREFIX` and retry guidance. -- Plan 07-06 recorded the REQUIREMENTS/PROJECT/CHANGELOG traceability trail.
- [Phase 07]: Validation sign-off is approved; NFR-2, NFR-3, NFR-8, and NFR-11 map to green automated gates including real Pi-runtime smoke. -- Plan 07-06 closed the phase gate evidence.
- [Phase 08]: withLockedStateTransaction now exposes a lock-held manual-save state transaction using the same per-scope `.state-lock` semantics as withStateGuard. -- Plan 08-01 established the PRL-10 rollback foundation.
- [Phase 08]: reinstall.ts is architecture-gated before implementation against Git/network imports and refreshGitHubClone references. -- Plan 08-01 established the PRL-07 no-network guard.
- [Phase 08]: skills and commands bridges now expose rollback-safe replace/rollback/finalize helpers with opaque WeakMap-backed handles. -- Plan 08-02 established the PRL-09/PRL-10 backup replacement pattern for file and directory resources.
- [Phase 08]: agents and MCP bridges now expose rollback-safe replace/rollback/finalize helpers, including default foreign-agent blocking and force-mode restoration. -- Plan 08-03 completed the PRL-09/PRL-10 bridge replacement foundation.
- [Phase 08]: reinstallPlugin is a dedicated cached-manifest, version-preserving single-plugin core that returns structured outcomes for Phase 9 batch partitioning. -- Plan 08-04 completed PRL-02/06/07/08 and avoided uninstall+install/update wrappers.
- [Phase 08]: reinstallPlugin holds withLockedStateTransaction across prepare, bridge replacement, explicit state save, and rollback; data/cache cleanup failures are warning-only after commit. -- Plan 08-04 completed PRL-09/10/11/12.
- [Phase 09]: reinstallPlugins provides update-analogous bulk target forms, deterministic partitions, reload-hint aggregation, soft-dependency aggregation, and quiet single-plugin rendering for batch UX. -- Plan 09-01 completed PRL-03/04/05/13/14/15.
- [Phase 09]: /claude:plugin reinstall is routed, registered, documented, and completed with installed-only tab completion plus reinstall-specific --force. -- Plans 09-02/09-03/09-04 completed PRL-01/16 and final validation.
- [Roadmap v1.3]: D-30 locks `docs/messaging-style-guide.md` v1.0 + `docs/output-catalog.md` as the v1.3 user-contract, superseding PRD §6.12 ES-5 marker strings.
- [Roadmap v1.3]: v1.3 phases = 12 (Foundations) + 13 (Conformance Refactor & ES-5) + 14 (Drift Guard). 38/38 CMC requirements mapped (CMC-08/11/14/19/36/37 -> Phase 12; CMC-01..07/09/10/12/13/15..18/20/21/22..34/35 -> Phase 13; CMC-38 -> Phase 14).
- [Roadmap v1.3]: ES-5 atomic three-file edit (`shared/markers.ts` + `tests/architecture/markers-snapshot.test.ts` + PRD §6.12) lives in Phase 13 (CMC-35) per style guide §15 supersession contract -- snapshot test's prefix-extraction shape is structurally incompatible with new tokenised forms, so the deferral is mandatory.
- [Roadmap v1.3]: Drift guard reads style-guide YAML frontmatter as binding contract (no duplicated lists in test code); placed last because it asserts conformance for every callsite.
- [Roadmap v1.4]: 7-phase split (15-21): types -> renderer -> spec -> 3 migration waves (marketplace, plugin, edge+UsageError) -> final teardown. SNM-22 closure deferred to Phase 21 because the "V1 wrappers deleted" half cannot land until all migration waves complete. Phases 18 and 19 are execution phases without REQ closure -- their success criteria (zero V1 callers in family, narrowed lint glob, catalog UAT GREEN for family) prove incremental progress toward SNM-22 closure in Phase 21.
- [Phase 24]: SNM-36 closed via D-24-04 detection-vs-emission seam: REASONS member `lspServers` -> `lsp` (shared/notify.ts:79); detection substrings stay camelCase (resolver-note match), only the emitted Reason renders `lsp`. install.ts seam uses a typed `MANIFEST_FIELD_TO_REASON` map (D-24-05) gating on the retained camelCase `MANIFEST_FIELD_REASONS` set, removing the `as Reason` cast. Catalog/fixture/doc byte forms + spec wording (`lsp servers` -> `lsp`) amended in the same atomic commit (D-24-03/07); SC#4 manifest surface (`plugin.ts:31`, `resolver.ts:142,160`) byte-unchanged. -- Plan 24-01.
- [Roadmap v1.4.1]: 5-phase split (22-26): reload-hint discipline -> version display bundle -> grammar consistency -> runtime publish & verification -> GREEN gate close. Phase boundaries respect the shared/notify.ts convergence (SNM-33 / SNM-35 / SNM-36 all touch the same file) by serializing them across phases rather than parallel waves. Phase 25 is operational + investigation: SNM-37 (publish/npm-link) is an operator-action checkpoint that gates SNM-38 (G-MIL-03 indent reproduction) and SNM-39 (G-MIL-07 completion reproduction); SNM-38/39 can run in parallel after SNM-37 lands. State migration for already-installed hash-versioned plugins is out of scope (REQUIREMENTS Out of Scope) -- marketplace update will naturally surface those as upgradable once SNM-34 ships.
- [Phase 25]: SNM-37 gate satisfied via scripts/pi.sh source-load (no npm publish/link, D-25-01) + a tests/shared/snm37-behavioral-smoke.test.ts byte-form smoke proving v1.4 identity at the pre-tui notify boundary (D-25-04; stronger than pi --version, moot under -e source-load). Real-publish validation deferred (D-25-06). SNM-37 text + ROADMAP SC#1 amended in lockstep (D-25-03). Gates SNM-38 (25-02) + SNM-39 (25-03). -- Plan 25-01.
- [Phase ?]: [Phase 25]: SNM-38 (G-MIL-03 indent ladder) REFUTED by pre-tui byte evidence (D-25-09): notify() emits the catalog-conformant 0/2/4 ladder at ctx.ui.notify (captured indents [0,2,2,2,2,4,0,0,2]); the observed 1/3 visual is a markdown/tui display-layer artifact, not a renderer deviation. Recorded as a docs/output-catalog.md Indentation-discipline clarification + a tests/shared/snm38-indent-ladder.test.ts readability lock (on top of the catalog-uat byte-equality gate). Anchored on notify.ts constants, NOT the UAT 2/4 truth-line misquote. -- Plan 25-02.
- [Phase 25]: SNM-39 (G-MIL-07 tab completion) DEFER-WITH-FINDING (D-25-10): our provider is correct (TC-6 `update @` -> `["@mp-a","@mp-b"]` GREEN; cause (a) eliminated by v0.2.0 source-load, cause (c) ruled out). Root cause is cause (b) -- host-side `@`-precedence in the GLOBAL `@earendil-works/pi-tui` 0.76.0 that scripts/pi.sh execs (`@`-logic byte-identical to local 0.74.2): `CombinedAutocompleteProvider.getSuggestions:188` checks `extractAtPrefix:191`/`:331` against `PATH_DELIMITERS:6` (no `@`) and routes any `@`-leading token to file-mention completion BEFORE the slash branch `:205`, so our `getArgumentCompletions` is never reached for bare `update @`. LIVE scripts/pi.sh trigger (D-25-08) showed FILE PATHS (not `@<mp>` candidates) -> CONFIRMS the interception (D-25-05 real-home spot-check not triggered). pi-tui-external; defer, do NOT contort the provider (would degrade bare-`@<mp>` UX without fixing the host). Recorded in UAT + a finding comment above TC-6 (provider.test.ts:793). -- Plan 25-03.
- [Roadmap v1.6]: 7-phase split (30-36) from research build-order A-G: Phase 30 (A) duplicate GitCredentials type fix (AUTH-10); Phase 31 (B) platform/git-credential.ts + CredentialOps interface (AUTH-06/08/09); Phase 32 (C) domain/github-auth.ts Device Flow state machine with injectable HTTP seam (AUTH-01..05/07); Phase 33 (D) platform/git.ts buildAuthCallbacks + authAttempted guard (AUTH-01/02); Phase 34 (E) GitOps interface threading through shared.ts + DEFAULT_GIT_OPS + refreshGitHubClone (AUTH-01/02); Phase 35 (F) orchestrator call sites add.ts + update.ts + output catalog Device Flow prompt (AUTH-01/02/03); Phase 36 (G) integration gate -- npm run check GREEN, all failure paths tested (all AUTH). No npm runtime deps added. Two new files: platform/git-credential.ts, domain/github-auth.ts.
- [Phase 27]: UXG-06 closed doc-only -- catalog github-source prose corrected (marketplace add never auto-enables autoupdate for any source; add.ts:235-244/311-320), autoupdate heading renamed to the real autoupdate|noautoupdate <name> verbs (no disable subcommand), catalog-uat FIXTURES key synced byte-for-byte (loadCatalogExamples sectionRe coupling). catalog-uat + npm run check GREEN. -- Plan 27-01.
- [Phase 27]: UXG-01 closed -- marketplace list `renderMpHeader` SUB-BRANCH B drops the `<last-updated <iso>>` token (array element removed, not emptied, per Pitfall 2); `MarketplaceDetails.lastUpdatedAt?` (notify.ts:285) + state-io.ts:70 persistence retained so notify-types.test.ts (`_MarketplaceDetailsExpected`) stays untouched/GREEN; renderer + catalog + catalog-uat fixture + notify-v2 byte test + orchestrator list test landed in one atomic commit (lockstep, no intermediate RED). `<autoupdate>` marker byte-unchanged. npm run check GREEN 1143/1143. -- Plan 27-02.
- [Phase 27]: UXG-04 closed via Strategy B -- autoupdate FLIP surface now renders marker tokens (`<autoupdate>` / `<no autoupdate>`) instead of `(autoupdate enabled)`/`(autoupdate disabled)` status tokens; idempotent flips render the marker plus a `{already autoupdate}`/`{already no autoupdate}` brace (no `(skipped)` token). Renamed two REASONS members (already enabled->already autoupdate, already disabled->already no autoupdate); kept MARKETPLACE_STATUSES (7) and MARKERS (2) membership intact (`<no autoupdate>` already a MARKERS member, only emission is new). Inverted the autoupdate.ts marker-as-outcome header comment (reverses Phase 17.1 / D-18-05) and reconciled the three list-surface `<no autoupdate>`-not-emitted catalog prose statements surface-precisely (list surface unchanged). Renderer+orchestrator+catalog+byte gate+per-variant+orchestrator+2 bootstrap tests landed in one atomic commit (dbd149a); npm run check GREEN 1143/1143. -- Plan 27-03.
- [Phase 27]: UXG-05 closed via manifest CONTENT-compare (not git SHA, not lastUpdatedAt -- Pitfall 4). The autoupdate-OFF (manifest-only refresh) path now distinguishes a no-op from a change: `manifestContentKey` loads the post-validation parsed MarketplaceManifest via `loadMarketplaceManifest` and `JSON.stringify`s the validated parse (stable key order; no crypto, no field-by-field diff); pre/post-refresh keys are compared and threaded through `RefreshSnapshot.changed`. No change -> `(skipped) {up-to-date}` (warning, no `/reload` trailer; mirrors the plugin-level up-to-date no-op); changed -> `(updated)`. Source-kind-uniform (path + github). The renderer needed NO change -- the shared mp-level `skipped` arm + `up-to-date` REASONS member already compose the byte form. Severity stays `warning` (UXG-02 info-softening is Phase 28, NOT pre-empted). Catalog `autoupdate-off-manifest-refresh` state split into `update-no-op-skipped` + `manifest-refresh-changed` (net +1, keeps examples.length >= 30). Orchestrator+catalog+catalog-uat+notify-v2+update orchestrator tests in one atomic commit (52f53b9); the pre-existing github MU-4 test naturally became the github no-op fixture. Phase 27 GREEN gate: npm run check 1146/1146 + integration 4/4 + pinned e2e 14/14; nyquist_compliant flipped true (ded3633). -- Plan 27-04. PHASE 27 COMPLETE.
- [Phase 28]: UXG-02 closed -- computeSeverity rewritten as the D-28-06 5-arm first-match ladder with a BENIGN_REASONS closed set (up-to-date, already installed, already autoupdate, already no autoupdate) + a shared allBenign() predicate (empty/undefined -> false, so a no-reason mp-skip routes to warning per D-28-08). A cascade whose only non-success rows are benign idempotent no-op skips computes info (omits the 2nd ctx.ui.notify arg); actionable skips, mixed cascades, and manual-recovery compute warning (first-match poisoning, D-28-09); failed computes error. Pure severity-arg change -- every rendered byte string byte-identical (catalog-uat byte gate GREEN). Both named gates (notify-v2 + catalog-uat, warning fixtures 6->1) plus 11 downstream orchestrator severity assertions moved in lockstep (Rule 1). ADR v2-001 / messaging-style-guide / output-catalog severity prose synced; the UXG-05 "info-softening is Phase 28" deferral sentences removed (realized), closing the Plan 27-04 hand-off. npm run check GREEN 1152/1152. -- Plan 28-01.
- [Phase 28]: UXG-03 resolved DEFER-WITH-FINDING -- feasibility spike RUN against the installed host `@earendil-works/pi-coding-agent@0.75.5` REFUTED the colorless-cascade approach: the host couples the `Error:`/`Warning:` label AND the severity color to the single `notify(message, type?)` arg (`dist/core/extensions/types.d.ts:75` has no color-only param; label+color co-derive from `type` in `dist/main.js:64-69` `reportDiagnostics` and `dist/modes/interactive/interactive-mode.js:1771-1781`/`:2944-2954` `showExtensionNotify`->`showError`/`showWarning`, both binding color+label in one `theme.fg` call; the only label-free path `showStatus:2438` also drops the color). The only in-extension lever (forcing `info`) ALSO drops the color and nullifies UXG-02's routing -- REJECTED (D-28-11). No colorless workaround shipped (D-28-10); notify.ts untouched. Resolved as an upstream-tracked finding mirroring SNM-39 / G-MIL-07 (D-28-12): a read-only evidence-lock test (`tests/shared/snm-uxg03-label-color-spike.test.ts`, 4 tests GREEN, runs inside npm run check) + `UXG-03-FINDING.md` + UAT note + REQUIREMENTS note + STATE.md deferral row. Filing the upstream issue is the operator's call. Contingent D-28-13 entrypoint policy recorded for intent (`notify()` suppresses, `notifyUsageError()` keeps; NOT line-count). npm run check GREEN 1156/1156. -- Plan 28-02. PHASE 28 COMPLETE.

### Pending Todos

None yet.

### Blockers/Concerns

- RESOLVED (Phase 25, plans 25-01..25-03): the SNM-37 operator-gated hand-off blocker is closed. The gate was satisfied via `scripts/pi.sh` source-load (no npm publish/link, D-25-01) -- the runtime source-loads v0.2.0 -- so SNM-38 (25-02) and SNM-39 (25-03) reproduced/refuted against the v1.4 runtime without an operator publish. Original concern: SNM-37 publish step required an operator action (publish to npm or npm-link the source tree into the user's Pi runtime), gating SNM-38/SNM-39; the hand-off checkpoint was surfaced and satisfied. Real-publish validation remains deferred (D-25-06).
- Historical `write-file-atomic@^8` engine concern is resolved on main by v0.1.2: package engines now allow `>=20.19.0` and the dependency is `write-file-atomic@^7`.

### Quick Tasks Completed

| #          | Description                                                                                                                                                                               | Date       | Commit  | Status   | Directory                                                                                                           |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| 260515-bkt | lets update the specs and the implementation to listen to PI_CODING_AGENT_DIR if set instead of hardcoding ~/.pi                                                                          | 2026-05-14 | 0257577 | Verified | [260515-bkt-pi-coding-agent-dir](./quick/260515-bkt-pi-coding-agent-dir/)                                           |
| 260515-tqx | fix these gaps                                                                                                                                                                            | 2026-05-15 | 5d8fd1d | Verified | [260515-tqx-fix-these-gaps](./quick/260515-tqx-fix-these-gaps/)                                                     |
| 260522-c80 | patch PROJECT.md to close requirements-section gaps surfaced during Phase 12 discuss-phase                                                                                                | 2026-05-22 | 39f6611 |          | [260522-c80-patch-project-md-to-close-requirements-s](./quick/260522-c80-patch-project-md-to-close-requirements-s/) |
| 260525-aub | Replace free-text Error.message parsing in install/update/remove orchestrators with typed PluginShapeError dispatch (eliminates SonarCloud S5852 ReDoS hotspot; closes v1.3 pattern hole) | 2026-05-25 | da04709 |          | [260525-aub-replace-free-text-error-message-parsing-](./quick/260525-aub-replace-free-text-error-message-parsing-/) |
| 260525-cjr | Apply PR #22 review fixes: 5 comment fixes, 2 silent-failure catches, declaresAgents/Mcp required, 4 narrowReason migrations, drift architecture test, plus 10 polish items               | 2026-05-25 | c79b6bc |          | [260525-cjr-apply-pr-22-review-fixes-5-comment-fixes](./quick/260525-cjr-apply-pr-22-review-fixes-5-comment-fixes/) |
| 260530-7pk | Fix PR #22 review findings: 4 failing CI tests reconciled to V2 output, bootstrap/marketplace error diagnostics surfaced (IL-2/AS-7), comment-rot sweep, reasons-type tightening + resolver dedup, MAX_DEPTH cause-chain tests, NFR-4 Node floor to >=20.19.0, PRD PU-4/AS-6 leak policy | 2026-05-30 | 015e8f6 |          | [260530-7pk-fix-pr-22-review-findings-failing-tests-](./quick/260530-7pk-fix-pr-22-review-findings-failing-tests-/) |
| 260530-fast | Resolve 4 SonarCloud code smells on PR #22 (S3735 void operator, S1871 duplicate case, S3626 redundant jump, S7755 .at indexing); coverage deferred | 2026-05-30 | a36988d |          | (inline /gsd-fast, no task dir) |

## Deferred Items

Items acknowledged and deferred at v1.3 milestone close on 2026-05-25:

| Category   | Item                                                | Status                       | Deferred At |
| ---------- | --------------------------------------------------- | ---------------------------- | ----------- |
| quick_task | 260515-bkt-pi-coding-agent-dir                      | complete (frontmatter stale) | 2026-05-25  |
| quick_task | 260515-cmp-scope-rules-implementation               | complete (frontmatter stale) | 2026-05-25  |
| quick_task | 260515-tqx-fix-these-gaps                           | complete (frontmatter stale) | 2026-05-25  |
| quick_task | 260515-wpe-scope-rules                              | complete (frontmatter stale) | 2026-05-25  |
| quick_task | 260516-02r-implement-claude-plugin-bootstrap-comman | complete (frontmatter stale) | 2026-05-25  |
| quick_task | 260516-08j-modify-agent-mapping-logic-to-omit-model | complete (frontmatter stale) | 2026-05-25  |
| quick_task | 260522-c80-patch-project-md-to-close-requirements-s | complete (frontmatter stale) | 2026-05-25  |

All seven quick tasks have a SUMMARY.md and are completed; the `audit-open` query flags them as `missing` because their SUMMARY.md frontmatter lacks a `status:` field (pre-canonical-frontmatter format). No follow-up work; acknowledged as deferred at v1.3 close.

Additional v1.4.1-scope deferrals:

| Category           | Item                                                                                                                                                                                                                                                                                                                                                                                    | Status                                                                                                                                                                                                         | Deferred At |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| integration_test   | tests/integration/fold-adoption.test.ts phase 1 failure                                                                                                                                                                                                                                                                                                                                 | pre-existing on v1.4 baseline; tracked for separate /gsd-debug                                                                                                                                                 | 2026-05-28  |
| state_migration    | Migration tooling for already-installed `hash-<12hex>` plugins whose plugin.json declares a SemVer                                                                                                                                                                                                                                                                                      | out of scope v1.4.1; marketplace update will naturally surface as upgradable post-SNM-34                                                                                                                       | 2026-05-28  |
| milestone_archival | v1.4 phase dirs (15-21) archival                                                                                                                                                                                                                                                                                                                                                        | deferred; phase dirs remain under .planning/phases/ during v1.4.1; operator-initiated via /gsd-complete-milestone                                                                                              | 2026-05-28  |
| upstream_finding   | pi-tui `@`-precedence intercepts `/claude:plugin update @<TAB>` (G-MIL-07 / SNM-39): `@earendil-works/pi-tui` 0.76.0 `CombinedAutocompleteProvider.getSuggestions:188` checks `extractAtPrefix:191`/`:331` (`PATH_DELIMITERS:6`, no `@`) BEFORE the slash branch `:205`, so a bare `@<mp>` token is routed to file-mention completion and our `getArgumentCompletions` is never reached | defer-with-finding; recorded in-repo with exact line refs (UAT G-MIL-07 + provider.test.ts:793). Opening an upstream pi-tui issue is the user's call (RESEARCH Open Q2). Do NOT contort our provider (D-25-10) | 2026-05-29  |
| upstream_finding   | host couples notify label + color to the single `type` arg (UXG-03): `@earendil-works/pi-coding-agent@0.75.5` `dist/core/extensions/types.d.ts:75` `notify(message, type?)` has no color-only param; label + color co-derive from `type` in `dist/main.js:64-69` (`reportDiagnostics`) and `dist/modes/interactive/interactive-mode.js:1771-1781`/`:2944-2954` (`showExtensionNotify` -> `showError`/`showWarning` bind color + `Error:`/`Warning:` label in one `theme.fg` call; the only label-free path `showStatus:2438` also drops the color). Rendering a multi-line cascade's severity color WITHOUT the label is not host-supported | defer-with-finding; feasibility REFUTED by the Phase 28 / Plan 28-02 read-only spike. Recorded in-repo (UXG-03-FINDING.md + spike test `tests/shared/snm-uxg03-label-color-spike.test.ts` + UAT). No colorless in-extension workaround shipped (D-28-10); forcing `info` rejected (D-28-11). Opening an upstream `@earendil-works/pi-coding-agent` issue is the operator's call (D-28-12) | 2026-05-31  |

## Session Continuity

Last session: 2026-06-01T00:00:00.000Z
Stopped At: v1.6 roadmap created
Resume File: .planning/ROADMAP.md (Phase 30 next)

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
