---
phase: "04"
slug: "dependency-resolver-residue"
status: verified
threats_open: 0
threats_total: 17
threats_closed: 17
threats_open_nonblocking: 0
accepted_risks: 4
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
created: "2026-10-28"
audited_commit: "fa0ee994cbe20779421a2d6001696b89eaac4fb1"
---

# Phase 4 — Security

Verified: all 17 unique threats are closed. All 13 mitigation dispositions
have implementation evidence, and all four accepted-risk entries were
verified in this saved document against their original PLAN dispositions.
There are no blocking or non-blocking open threats.

The six PLAN registers contain 22 rows representing 17 unique threats.
T-04-SC appears identically in every plan and is counted once. All threats
have valid severities: four high, six medium, and seven low. No threat has
a transfer disposition.

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Catalog and plugin sources → agent discovery | Plugin agent names become targets in the scope's shared agents directory. | Untrusted names and plugin files |
| Agents index and user files → preview and commit | Ownership determines which existing agent files may be replaced. | Index rows, marker bytes, target paths |
| Git host → preview cache | A mutable source resolves to a commit and a per-commit copy. | Repository URL, ref, commit SHA |
| Dependency plan → install ledger | Each member carries its selected commit into materialization. | Member key, previewed SHA, release-tag pin |
| Judge and tag probe → failure rows | Refusal details and declared ranges become user-visible text. | Paths, ranges, classified failures |
| Ledger rollback → orchestrated outcome | An unfinished undo must remain observable to the caller. | Phase, message, error cause |
| Dependency declarations → resolver search | Ranges and conflicts determine tentative picks and repeated walks. | Catalog constraints and versions |
| Scenario setup → host filesystem and network | Fixtures must remain under the sandbox and use local stand-ins. | Fixture files, git requests, scratch worktrees |
| Plugin materialization → package runner | Later integrated package support is conditional and contained. | Package metadata, lockfiles, process arguments |

## Threat Register

Production paths below are relative to
`extensions/pi-claude-marketplace/`.

| Threat ID | Category | Component | Severity | Disposition | Mitigation and Evidence | Status |
|-----------|----------|-----------|----------|-------------|-------------------------|--------|
| T-04-01 | Tampering | Dependency move or update overwriting a user's agent | high | mitigate | `bridges/agents/target-check.ts:34` partitions previous rows by marketplace and plugin, checks their ownership markers, and refuses occupied targets. All declared callers are wired: `orchestrators/plugin/dependency-move.ts:173`, `install-flow-planning.ts:341`, and `install-outcome.ts:939`. `dependency-plan.ts:628` previews fresh members before scheduling; `install-flow-planning.ts:245` completes planning before running steps. `bridges/agents/stage.ts:429` repeats the target check before removals. | closed |
| T-04-02 | Tampering | Forced reinstall repair blocked by the preview check | medium | mitigate | `orchestrators/plugin/update-swap.ts:1464` uses the names-only check. Its commit check receives `policy.overwrite` at line 1496. `bridges/agents/stage.ts:310` permits forced replacement only for the appropriate previous rows; line 380 checks containment. `test/orchestrators/plugin/update-swap.test.ts:662` asserts successful overwrite and resulting file/index contents. | closed |
| T-04-03 | Information disclosure | Absolute target path in refusal messages | low | accept | Accepted in 04-01-PLAN.md; see AR-04-03. Integration subsequently strengthened this boundary: `shared/errors-bridges.ts:61` constructs `AgentTargetOccupiedError` with a redacted message, and both preview and commit throw it. The original full-path-message acceptance is historical. | closed |
| T-04-04 | Elevation of privilege | Preview check reading outside the agents directory | low | accept | Accepted in 04-01-PLAN.md; see AR-04-04. `domain/name.ts:545` validates generated agent names, and `bridges/agents/target-check.ts:45` joins those names under `agentsDir`. The check contains no mutation. Previous indexed paths are read for ownership checks; this acceptance does not claim they receive a new read-containment check. | closed |
| T-04-05 | Information disclosure | No-match failure text | low | accept | Accepted in 04-02-PLAN.md; see AR-04-05. `domain/release-tag.ts:53` and `orchestrators/plugin/dependency-tag-probe.ts:66` have range-free no-match arms. `install-cascade.ts:875` renders the caller's declared range; `domain/dependency-range.ts:346` bounds that rendering. | closed |
| T-04-06 | Repudiation | Missing-dependency install's unfinished undo | medium | mitigate | The failed outcome declares `rollbackPartials` in `orchestrators/plugin/install-flow-dependency-ledger.ts:175`. Its catch retains the projected failure at lines 362–382. `install-flow-results.ts:619` passes captured partials into failure classification. `test/orchestrators/plugin/install-flow-ledger.test.ts:6766` injects an undo failure and asserts the complete phase/message/cause array and absent install record. | closed |
| T-04-07 | Information disclosure | Absolute paths in a planned move refusal | medium | mitigate | `orchestrators/plugin/dependency-plan.ts:194` applies `redactAbsolutePaths(cause)`. `test/orchestrators/plugin/dependency-plan.test.ts:574` supplies an absolute path and asserts basename-only output. The newer typed occupied-target error also redacts at its producer. | closed |
| T-04-08 | Denial of service | Resolver search length | low | accept | Accepted in 04-03-PLAN.md; see AR-04-08. `orchestrators/plugin/dependency-plan.ts:320` retains greedy rule-outs, and line 433 refuses a repeated search state. `test/orchestrators/plugin/dependency-plan.test.ts:859` pins four walks, six judge calls, no previews, and the documented incomplete-search refusal. | closed |
| T-04-09 | Tampering | Host changes commit between preview and install | high | mitigate | `orchestrators/plugin/install-outcome.ts:944` returns the previewed SHA. `dependency-plan.ts:464` records it by member key and line 501 attaches it to the scheduled member; line 599 handles the root. `install-flow-cascade-context.ts:600` carries it into the ledger pin. `clone-cache.ts:229` uses `pluginCloneKey(URL, SHA)` and line 236 reuses the existing copy. | closed |
| T-04-10 | Spoofing | Previewed commit assigned to another member | medium | mitigate | `orchestrators/plugin/dependency-plan.ts:464` stores by `node.member.key`, and line 501 retrieves by the same key. `withPreviewedCommit` copies instead of mutating graph members. `test/orchestrators/plugin/dependency-plan.test.ts:459` assigns distinct commits to two members and compares the complete scheduled plan, including a member without a commit. | closed |
| T-04-11 | Tampering | Install lands a commit never previewed | high | mitigate | Both ledger builders call `memberLedgerPin`: `orchestrators/plugin/install-flow-cascade-context.ts:630` and `install-flow-ledger.ts:737`. `buildInstallLedgerOptions` maps the result to `sourcePinOverride` at line 159; `install-outcome.ts:788` applies it as the source SHA. `install-clone-probe.ts:78` takes the pinned path. Three cases in `test/orchestrators/plugin/install-flow-planning.test.ts:170` and line 197 assert one mirror resolve and the expected pin. | closed |
| T-04-12 | Tampering | Previewed SHA overrides a release tag or forges version metadata | medium | mitigate | `orchestrators/plugin/install-flow-cascade-context.ts:596` returns the release-tag pin before considering `previewedCommit`. The preview-only branch sets no `resolvedVersion`. `install-outcome.ts:510` keeps version derivation separate. `test/orchestrators/plugin/install-flow-cascade-context.test.ts:518` checks tag, preview-only, and unpinned option shapes. | closed |
| T-04-13 | Information disclosure | Extra network reads | low | mitigate | `orchestrators/plugin/clone-cache.ts:829` resolves an explicit SHA without remote access; line 236 returns the warm per-commit copy before authentication or cloning. The counting cases in `test/orchestrators/plugin/install-flow-planning.test.ts:170` and line 197 assert one mirror resolve. `features/plugin/install-dependencies.feature:939` asserts exactly one git request pair. Apply's separately deferred MISS-01 installs retain their documented independent resolve. | closed |
| T-04-14 | Tampering | Scenario files escape the sandbox | medium | mitigate | `features/step_definitions/plugin/installation.steps.ts:125` derives the agents directory from `world.scopeRoot`. `writeUserFile` validates a single entry name, writes with `wx`, and registers cleanup at lines 137–140. `features/support/world.ts:125` selects sandbox roots; line 558 runs releases. Agent publication also uses `ownedTarget` and an exclusive write in `features/lib/published-marketplace.ts:704`. | closed |
| T-04-15 | Information disclosure | Scenario reaches external network | low | mitigate | The three occupied-agent scenarios use directory marketplaces; the git scenario uses the test repository host. `features/lib/https-git-host/server.ts:141` binds `127.0.0.1`. `features/step_definitions/git-host.steps.ts:188` compares every request of the last command with the declared table. `features/plugin/install-dependencies.feature:912` identifies the fixture and its exact request pair. | closed |
| T-04-16 | Tampering | RED-check scratch worktree left behind | low | mitigate | Read-only `git worktree list --porcelain` showed no detached Phase 4 RED worktree at the recorded base `2829db68` and no Phase 4 scratch checkout. This corroborates the recorded cleanup in 04-06-SUMMARY.md and 04-VERIFICATION.md. This threat concerns execution cleanup, not a production code path. | closed |
| T-04-SC | Tampering | Package installation introduced by Phase 4 | high | mitigate | The 12 recorded implementation/test commits change no package manifests or dependency lockfiles. Phase 4 adds no package execution path. Later integrated package support remains separate: `orchestrators/plugin/package-install.ts:325` skips absent manifests, line 344 skips manifests without packages, line 353 enforces containment, and line 535 skips empty resolved package sets. Its commands retain `--ignore-scripts`; the platform runner uses `shell: false`. | closed |

## Verification Details

### Previewed commit and refusal ordering

The SHA handoff remains intact after the Phase 11 install-flow split:
preview → member-key map → scheduled member → either ledger builder →
`sourcePinOverride` → pinned clone probe → warm per-commit copy.

The root has a separate, explicit handoff through
`install-flow-planning.ts:308` and `DependencyPlanOptions.rootCommit`.
No clone sweep runs between planning and the planned installation:
`install-flow-planning.ts:270` runs it in the outer `finally`.

The move judge, direct update settlement, and install previews all reach the
agent-target check. A fresh dependency preview failure returns before the
plan schedules or executes its moves, including when apply defers that
dependency's eventual installation. The commit-time check remains before
agent removal and before the update intent mark.

Behavioral evidence also checks state and file preservation, not just an
error message:

- `features/plugin/install-dependencies.feature:1126`: occupied second move;
  neither installed dependency changes.
- `features/plugin/install-dependencies.feature:1160`: occupied fresh
  dependency; the installed dependency keeps its prior version.
- `features/plugin/update-dependencies.feature:37`: occupied update target;
  its new dependency remains absent.
- `test/bridges/agents/target-check.test.ts:134`: an occupied target behind
  a free target still refuses.

### Range failures and partial rollback

Tag-listing failures remain distinct from successful listings with no
matching tag (`dependency-tag-probe.ts:119` and `install-cascade.ts:857`).
No-match rows use the declared ranges, not an unread value supplied by the
probe. `renderDeclaredRanges` bounds the rendered text.

The rollback-partial declaration and failure propagation survived the
install-flow split. The REC-06 test still checks phase, message, original
cause, and absence of a recorded plugin.

### Package and network scope

T-04-SC is the shared Phase 4 supply-chain threat, not a claim that the
integrated application never installs plugin packages. Phase 9 introduced
that separately declared behavior.

Current package detection skips plugins without package.json, manifests
without listed packages, and empty sanitized package sets. Existing
node_modules skips ordinary installs. Roots outside the managed extension
directory are not written. Tests at
`test/orchestrators/plugin/package-install.test.ts:333` and line 1061 assert
no runner call for the relevant no-package cases.

The package commands are frozen/script-free, use a staged work directory,
and run through the bounded process runner. This audit checked these
integration points to distinguish authorized package traffic from the
extra git resolve addressed by T-04-13; it is not a replacement for the
Phase 9 threat audit.

## Accepted Risks Log

These entries transcribe dispositions already present in the PLAN threat
models. They do not introduce new acceptance decisions or claim additional
human sign-off. The audit date below is the transcription date.

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-04-03 | T-04-03 | 04-01-PLAN.md accepted the existing commit-time absolute-path refusal message; planned move refusals were redacted by D-PL4-07. Current integration strengthens this behavior: both preview and commit occupied-target messages now show only the file name through AgentTargetOccupiedError. Retain this entry as the original disposition record. | Existing 04-01-PLAN.md `accept` disposition | 2026-10-28 |
| AR-04-04 | T-04-04 | 04-01-PLAN.md accepts the read-only ownership probe. Generated agent names are validated and new target paths are joined beneath agentsDir. The check adds no mutation or new write authority. Prior indexed target paths are read for ownership; no stronger read-containment guarantee is asserted here. | Existing 04-01-PLAN.md `accept` disposition | 2026-10-28 |
| AR-04-05 | T-04-05 | 04-02-PLAN.md accepts the existing bounded rendering of the member's declared ranges. Removing the probe's unread range field creates no additional output or tag-name disclosure. | Existing 04-02-PLAN.md `accept` disposition | 2026-10-28 |
| AR-04-08 | T-04-08 | 04-03-PLAN.md accepts the existing greedy search limit under D-PL4-03. Picks come from finite candidate sets, rule-outs remain excluded, and repeated states refuse. The phase adds no complete combinatorial search; the documented solvable-but-untried combination remains a deliberate completeness limitation. | Existing 04-03-PLAN.md `accept` disposition | 2026-10-28 |

## Open Threats

### Blocking

None.

### Non-blocking — below high threshold

None. T-04-03, T-04-04, T-04-05, and T-04-08 closed after the auditor
verified the persisted Accepted Risks Log against the original PLAN
acceptances on 2026-10-28.

## Unregistered Flags

None.

04-01 through 04-05 summaries report no new security surface.
04-06 explicitly maps its fixture, network, cleanup, and supply-chain notes
to T-04-14, T-04-15, T-04-16, and T-04-SC. No unmapped threat flag was found.

## Validation Evidence

- Current audit reference: `fa0ee994cbe20779421a2d6001696b89eaac4fb1`,
  branch `agent-reverify-a`.
- The orchestrator supplied a same-session passing `npm run check` at
  `99747f39`, Node v26.12.1: 1124 scenarios, 11468 steps, and 309 LCOV records.
- The auditor independently confirmed Node v26.12.1 and an empty
  `git diff 99747f39 -- . ':(exclude,glob).planning/**/*.md'`.
  `git status --porcelain --untracked-files=all` showed only a planning
  STATE.md modification and no untracked build inputs.
- The supplied focused Phase 4 evidence covers 11 unit modules and four
  scenarios/57 steps. Its integrated-tree record is in 04-VALIDATION.md.
- No additional test run was necessary. Existing passing evidence applies
  to unchanged build inputs. Code, assertion bodies, and scenario
  expectations were inspected directly; documentation was not used as
  proof of implementation.
- The auditor modified no implementation, test, planning, or temporary file.
- Acceptance-log recheck on 2026-10-28 verified AR-04-03, AR-04-04,
  AR-04-05, and AR-04-08 against their original PLAN rows.
  The diff excluding planning Markdown remained empty against the audited
  commit. The only untracked file was the orchestrator-created
  04-SECURITY.md.

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Blocking Open | Run By |
|------------|---------------|--------|------|---------------|--------|
| 2026-10-28 | 17 | 13 | 4 | 0 | gsd-security-auditor; provisional read-only audit before accepted-risk log persistence |
| 2026-10-28 | 17 | 17 | 0 | 0 | gsd-security-auditor; saved accepted-risk log verified against original PLAN dispositions |

### Security Audit

- Register source: all six Phase 4 PLAN threat models.
- Severity threshold: high; ASVS level: 1, using workflow defaults because
  no project override was configured.
- Implementation mitigation dispositions verified: 13/13.
- Accepted dispositions verified in the saved log: 4/4.
- Transfers: 0.
- Unregistered flags: 0.
- Blocking mitigation gaps: 0.
- Final verdict: SECURED; 17/17 closed, zero blocking or non-blocking open threats.

## Sign-Off

- [x] All 17 unique threats classified by severity and disposition.
- [x] All 13 declared implementation mitigations verified.
- [x] All summary threat flags mapped.
- [x] `threats_open: 0` confirmed.
- [x] Saved Accepted Risks Log rechecked by the auditor.
- [x] `status: verified` set after that recheck.

**Approval:** verified 2026-10-28.
