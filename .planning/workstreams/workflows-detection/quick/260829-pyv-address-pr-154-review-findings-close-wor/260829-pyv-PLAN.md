---
phase: quick-260829-pyv
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - tests/domain/resolver-strict.test.ts
  - tests/domain/resolver-loose.test.ts
  - tests/orchestrators/plugin/install.test.ts
  - tests/orchestrators/discover.test.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - tests/architecture/notify-closed-set-locks.test.ts
  - tests/architecture/compat-01-no-expansion.test.ts
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/domain/components/plugin.ts
  - extensions/pi-claude-marketplace/domain/resolver.ts
  - extensions/pi-claude-marketplace/shared/probe-classifiers.ts
  - tests/orchestrators/plugin/cross-surface-reason-parity.test.ts
  - CHANGELOG.md
autonomous: true
requirements: [WDET-01, WDET-02, WDET-03, WDET-04, WDET-05, WDET-06]
estimate:
  tokens: 60000
  raw_tokens: 60000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Strict and loose resolution ignore a regular file named `workflows`; only the literal directory is a convention signal (WDET-02, D-106-02, D-106-03)."
    - "Defined falsey `workflows` declarations, including `null` and `false`, produce one workflow kind through entry and plugin-manifest routes in both resolver modes (WDET-01, WDET-03, D-106-01)."
    - "Invalid and command-bearing workflow files are never inspected or executed; partial install and reload discovery still succeed, and no execution sentinel appears (WDET-05, WDET-06, D-106-02, D-106-05)."
    - "The 43 members inherited from `origin/main` retain their positions, and `workflows` is the 44th and final `REASONS` member (WDET-04, D-106-04)."
    - "Comments and documentation distinguish resolver-note classification from typed-kind classification and describe normal install versus `--partial` accurately."
  artifacts:
    - path: "tests/domain/resolver-strict.test.ts"
      provides: "Strict-mode falsey-declaration and file-not-directory regressions"
    - path: "tests/domain/resolver-loose.test.ts"
      provides: "Loose-mode falsey-declaration and file-not-directory regressions"
    - path: "tests/orchestrators/plugin/install.test.ts"
      provides: "Opaque-content and no-execution install regression"
    - path: "tests/orchestrators/discover.test.ts"
      provides: "Opaque-content reload-discovery regression"
    - path: "extensions/pi-claude-marketplace/shared/notify.ts"
      provides: "Append-only 44-member reason tuple"
    - path: "docs/output-catalog.md"
      provides: "Accurate reason catalog and workflow classification documentation"
  key_links:
    - from: "tests/domain/resolver-strict.test.ts and tests/domain/resolver-loose.test.ts"
      to: "domain/resolver.ts::declaresUnsupportedKind and hasUnsupportedConvention"
      via: "falsey declarations exercise presence checks; file fixtures exercise the directory-kind comparison"
    - from: "tests/orchestrators/plugin/install.test.ts"
      to: "resolveStrict -> requirePartialInstallable -> supported-component ledger"
      via: "real workflow bytes remain source-only while supported artifacts install"
    - from: "extensions/pi-claude-marketplace/shared/notify.ts"
      to: "tests/architecture/compat-01-no-expansion.test.ts"
      via: "exact enumeration proves every inherited member stayed in place and workflows alone appended"
    - from: "domain/resolver.ts partial.unsupported"
      to: "shared/probe-classifiers.ts::narrowUnsupportedKinds"
      via: "the typed `workflows` kind maps to `{workflows}` without entering `narrowResolverNotes`"
---

<objective>
Close the seven actionable review findings on PR #154 without widening workflow
support or changing production behavior beyond the required `REASONS` tuple move.

Purpose: restore append-only notification compatibility and prove that workflow
presence remains opaque, directory-specific, safe, and consistent in strict and
loose resolution.

Output: three focused Conventional Commits on `features/workflows-detection`, a
green focused suite and `npm run check`, and an updated PR head that is not
merged.
</objective>

<execution_context>
@/home/acolomba/pi-claude-marketplace/.codex/gsd-core/workflows/execute-plan.md
@/home/acolomba/pi-claude-marketplace/.codex/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/workstreams/workflows-detection/STATE.md
@.planning/workstreams/workflows-detection/milestones/workflows-detection-REQUIREMENTS.md
@.planning/workstreams/workflows-detection/milestones/workflows-detection-ROADMAP.md
@.planning/workstreams/workflows-detection/milestones/workflows-detection-phases/106-workflow-detection-and-partial-install/106-CONTEXT.md
@.planning/workstreams/workflows-detection/milestones/workflows-detection-phases/106-workflow-detection-and-partial-install/106-RESEARCH.md
@.claude/commands/babysit-pr.md
@.claude/rules/typescript-comments.md

Locked execution boundaries:

1. Work only in `/home/acolomba/pi-claude-marketplace/.worktrees/workflows-detection`
   on `features/workflows-detection`. Never switch to or commit on `main`.
2. Read each target file before editing it. Trace the production caller named in
   each task before changing a test or comment.
3. Do not alter resolver, install, discovery, or classifier runtime behavior.
   The sole runtime edit is moving `"workflows"` to the append-only tail of
   `REASONS`.
4. Do not touch, remove, stage, or commit `.planning/milestone.lock`.
5. Do not change versions, add dependencies, rebase, amend, force-push, or merge
   PR #154.
6. Apply the project `simple-english` rules to changed documentation and
   comments. Keep code, identifiers, commands, paths, and quoted output exact.

Before each task commit, use this protocol in this order:

1. Run the task's focused test command.
2. Find the cached TruffleHog executable and run `filesystem` on exactly the
   task's changed paths with `--results=verified,unknown --fail`. Require
   `verified_secrets: 0` and `unverified_secrets: 0`.
3. Run `SKIP=trufflehog pre-commit run --files` with exactly the same paths.
   If a hook rewrites a file, restage and run both checks again.
4. Stage only the listed paths. Commit with the task's exact Conventional
   Commit title, prefixed by `SKIP=trufflehog`. Never use `--no-verify`.
5. Run `git status --short`. The only unrelated path permitted is the untracked
   `.planning/milestone.lock`.
</context>

<source_coverage_audit>
| Source | ID | Review requirement | Task | Status |
|--------|----|--------------------|------|--------|
| GOAL | PR-154 | Close all supplied review findings without expanding workflow support | 1-3 | COVERED |
| REQ | WDET-01, WDET-03 | Falsey declarations remain defined presence signals | 1 | COVERED |
| REQ | WDET-02 | Only a literal `workflows/` directory triggers convention detection | 1 | COVERED |
| REQ | WDET-05, WDET-06 | Invalid or command-bearing workflow contents do not block supported installation, enter discovery, or execute | 1 | COVERED |
| REQ | WDET-04 | `{workflows}` stays canonical while the reason literal becomes the true append-only tail member | 2 | COVERED |
| CONTEXT | D-106-01 | Values are opaque; defined `null` and `false` count | 1 | COVERED |
| CONTEXT | D-106-02, D-106-03 | Directory-only convention and strict/loose parity | 1 | COVERED |
| CONTEXT | D-106-04 | Typed-kind mapping, stable inherited reason order, and exact token | 2, 3 | COVERED |
| CONTEXT | D-106-05, D-106-06 | Partial consent stages supported artifacts only; structural rules do not change | 1, 3 | COVERED |
| RESEARCH | R-01 | Reuse shared declaration and convention collectors; add no reader | 1 | COVERED |
| RESEARCH | R-02 | Keep typed-kind reason mapping in `narrowUnsupportedKinds` | 2, 3 | COVERED |
| RESEARCH | R-03 | Prove no parsing, materialization, discovery, or execution with sentinels | 1 | COVERED |
| REVIEW | F-01 | Invalid and side-effecting content coverage | 1 | COVERED |
| REVIEW | F-02 | Regular-file negative coverage in both modes | 1 | COVERED |
| REVIEW | F-03 | Falsey entry and plugin-manifest coverage in both modes | 1 | COVERED |
| REVIEW | F-04 | True 44-member append-only order and history | 2 | COVERED |
| REVIEW | F-05 | Resolver-note versus typed-kind classifier comments | 3 | COVERED |
| REVIEW | F-06 | CHANGELOG classification and clone/materialization wording | 3 | COVERED |
| REVIEW | F-07 | Unsupported-topic and normal-versus-partial comment corrections | 2, 3 | COVERED |

The older research snapshot placed `workflows` after `installs disabled` before
the four scope reasons landed. PR #154's review supplies the newer repository
fact: `origin/main` already had 43 members. Therefore, Task 2 keeps all 43
positions and appends `workflows` as member 44. The CONTEXT decision left the
exact tuple position to the agent, so this correction violates no locked choice.

Excluded by the locked phase boundary: workflow parsing, validation,
materialization, execution, custom manifest paths, and new declaration
namespaces.
</source_coverage_audit>

<tasks>

<task type="tracer">
  <name>Task 1: Prove opaque workflow handling across resolution, install, and reload discovery</name>
  <files>tests/domain/resolver-strict.test.ts, tests/domain/resolver-loose.test.ts, tests/orchestrators/plugin/install.test.ts, tests/orchestrators/discover.test.ts</files>
  <behavior>
    - A regular file at `<pluginRoot>/workflows` leaves strict and loose results installable with no workflow note or unsupported kind, per D-106-02 and D-106-03.
    - `workflows: null` and `workflows: false` each resolve to exactly one `workflows` kind through both the marketplace-entry and plugin-manifest routes in strict and loose mode, per D-106-01.
    - A partial install with malformed workflow bytes still installs its supported skill and records only compatibility metadata, per D-106-05.
    - A workflow command that would create a unique file if run never creates that sentinel during install or reload discovery, per D-106-02 and WDET-06.
  </behavior>
  <action>
Extend the existing WDET matrices rather than creating new helpers. In each
resolver test file, add an explicit conventional-path negative case whose mock
filesystem entry at `workflows` is a regular file (`{ contents: ... }`), not a
directory. Assert `state === "installable"`, no `contains workflows` note, and
no workflow unsupported kind. Expand the declaration matrix to cover `null`
and `false` from the entry and from `.claude-plugin/plugin.json`; each case must
produce `state === "partially-available"`, `unsupported === ["workflows"]`, and
`notes === ["contains workflows"]` in its mode (D-106-01 through D-106-03).

In `install.test.ts`, add a focused case beside the current WDET install cases.
Reuse `seedPathMarketplaceWithPlugin` and its workflow fixture support. Seed
one malformed workflow payload and one command-bearing payload whose command
uses the current Node executable to create a unique sentinel under the test
directory. Run a fresh `partial: true` install. Assert success, the supported
skill, `compatibility.unsupported === ["workflows"]`, the unchanged five
resource keys, unchanged source workflow bytes, no workflow file under Pi
targets, and an `ENOENT` result for the execution sentinel. Do not add a
workflow parser, subprocess spy, bridge, or production seam.

In `discover.test.ts`, let `stageWorkflowDecoy` accept caller-supplied bytes.
Seed malformed and command-bearing decoys under the ignored workflow resource
directory, run `aggregateDiscoveredResources`, retain the exact two-key result,
and assert that the execution sentinel does not exist. This pins reload
discovery without introducing a workflow result field (WDET-06, D-106-05).

After the focused test and task commit protocol pass, commit these four paths
as `test(workflows): close opaque detection coverage`.
  </action>
  <verify>
    <automated>node --test tests/domain/resolver-strict.test.ts tests/domain/resolver-loose.test.ts tests/orchestrators/plugin/install.test.ts tests/orchestrators/discover.test.ts</automated>
  </verify>
  <done>Both modes reject the regular-file false positive, all falsey declaration routes classify as present, opaque bytes cannot block supported installation or discovery, the sentinel stays absent, and the exact four paths are committed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Restore the append-only reason tail and its executable catalog</name>
  <files>extensions/pi-claude-marketplace/shared/notify.ts, extensions/pi-claude-marketplace/shared/notify-reasons.ts, tests/architecture/notify-closed-set-locks.test.ts, tests/architecture/compat-01-no-expansion.test.ts, docs/output-catalog.md</files>
  <behavior>
    - Every one of the 43 `origin/main` reason literals keeps its original index.
    - `workflows` is index 43, the 44th and final reason literal.
    - Closed-set length, exact enumeration, history comments, and catalog prose all state the same 43-to-44 history.
    - Workflow rows and their `{workflows}` bytes remain unchanged.
  </behavior>
  <action>
Update the exact-order assertion first so it expects the inherited 43-member
sequence followed by `workflows`, and run it to establish the red state. Then
move the existing WDET comment and literal in `notify.ts` from before the two
content scope reasons to after `marketplace in project scope`. Do not reorder
any inherited member. Keep the total at 44 and change no renderer or status
logic (D-106-04).

Correct the count history in `notify-reasons.ts` and
`notify-closed-set-locks.test.ts`: the two structural scope reasons move 39 to
41, the two content scope reasons move 41 to 43, and workflows moves 43 to 44.
Keep the unsupported topic union complete and update its topic comment to name
workflows. In the exact-order test, place the workflow comment and literal
after both content scope reasons so the test proves a tail append.

Correct `docs/output-catalog.md` to call `REASONS` a 44-member tuple and state
that workflows is its final append-only member. Update the
`partially-available` status row and the single-scope info explanation to
include the typed workflow kind and `{workflows}`. Distinguish the structural
`narrowResolverNotes` path from the partial typed-kind
`narrowUnsupportedKinds` path. State that a normal install rejects the partial
arm while `--partial` can materialize its supported subset. Also correct the
two `notify.ts` partially-available comments that omit workflows from the kind
examples. Preserve all fenced output bytes.

After the focused test and task commit protocol pass, commit these five paths
as `fix(notify): append workflows after scope reasons`.
  </action>
  <verify>
    <automated>node --test tests/architecture/notify-closed-set-locks.test.ts tests/architecture/compat-01-no-expansion.test.ts tests/architecture/catalog-uat.test.ts</automated>
  </verify>
  <done>The exact-order lock proves all inherited positions, workflows is member 44 at the tail, history and catalog text agree, catalog byte UAT passes, and the exact five paths are committed.</done>
</task>

<task type="auto">
  <name>Task 3: Correct classifier boundaries, install wording, and release documentation</name>
  <files>extensions/pi-claude-marketplace/domain/components/plugin.ts, extensions/pi-claude-marketplace/domain/resolver.ts, extensions/pi-claude-marketplace/shared/probe-classifiers.ts, tests/orchestrators/plugin/cross-surface-reason-parity.test.ts, CHANGELOG.md</files>
  <action>
Make comments accurate without changing executable statements. In
`domain/components/plugin.ts`, replace the claim that opaque unsupported fields
disqualify installation with the actual contract: they select the partial arm,
the normal gate rejects it, and `--partial` admits supported components. Apply
the same correction to the PR-3 tuple comment in `domain/resolver.ts`. Preserve
the current presence check, convention table, collection loop, decision order,
and both install gates (D-106-01 through D-106-06).

In `probe-classifiers.ts`, document separate input axes. Resolver notes can
produce the hooks, LSP, source, and malformed-MCP reasons. Typed unsupported
kinds can produce the hooks and LSP reasons, the generic component reason, and
the dedicated workflows reason. State explicitly that workflows is a
typed-kind carve-out handled by `kindToReason`, not a
`narrowResolverNotes` result. Update the `kindToReason` comment from two to
three carve-outs. Do not change the unions, functions, branches, or exports.

Correct the comments in `cross-surface-reason-parity.test.ts` that describe the
install path as note-derived. `narrowResolverReasons` consumes typed
`unsupportedKinds` first and only then folds notes with first-wins dedup. For
the workflow rows, identify the typed-kind input as the source of the exact
reason and the `contains workflows` note as a deduplicated secondary input.
Keep every assertion and expected array unchanged.

In `CHANGELOG.md`, qualify the first workflow bullet as structurally valid
workflow-bearing plugins. Replace the copy claim with the true boundary:
workflow contents are not inspected and are not materialized into Pi targets,
registered, or run. Do not imply that git clone operations omit workflow source
trees. Apply pragmatic Simple English and keep the release heading and version
unchanged.

After the focused test and task commit protocol pass, commit these five paths
as `docs(workflows): correct classification boundaries`. Then run the overall
plan verification below. Push the three commits to the existing PR head only
after the full gate passes; do not merge PR #154.
  </action>
  <verify>
    <automated>node --test tests/shared/probe-classifiers.test.ts tests/orchestrators/plugin/cross-surface-reason-parity.test.ts tests/architecture/catalog-uat.test.ts &amp;&amp; npm run typecheck</automated>
  </verify>
  <done>Source and test comments name the correct classifier and consent paths, CHANGELOG makes no clone-copy claim, focused tests and typecheck pass, and the exact five paths are committed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Plugin source to resolver | Untrusted declarations and filesystem entries cross into classification. |
| Workflow contents to install and reload | Command-bearing untrusted bytes must remain outside parsing, staging, and execution. |
| Typed unsupported kinds to terminal output | Internal classification crosses into the closed user-visible reason vocabulary. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-PYV-01 | Elevation of privilege | Workflow contents | high | mitigate | Task 1 uses a side-effect sentinel and proves that install and discovery never execute the command. |
| T-PYV-02 | Tampering | Resolver convention probe | medium | mitigate | Task 1 proves that only a directory, not a same-named file, triggers workflow presence in both modes. |
| T-PYV-03 | Tampering | Falsey declarations | medium | mitigate | Task 1 pins defined-value presence for `null` and `false` through both declaration routes. |
| T-PYV-04 | Repudiation | Closed reason vocabulary | medium | mitigate | Task 2 preserves all 43 inherited indexes and appends workflows as member 44 under exact-order and catalog gates. |
| T-PYV-05 | Information disclosure | Test workflow payloads | low | accept | Tests use only temporary paths and synthetic commands, and cleanup removes their test roots. |
</threat_model>

<verification>
1. Run the complete focused suite:
   `node --test tests/domain/resolver-strict.test.ts tests/domain/resolver-loose.test.ts tests/orchestrators/plugin/install.test.ts tests/orchestrators/discover.test.ts tests/shared/probe-classifiers.test.ts tests/orchestrators/plugin/cross-surface-reason-parity.test.ts tests/architecture/notify-closed-set-locks.test.ts tests/architecture/compat-01-no-expansion.test.ts tests/architecture/catalog-uat.test.ts`.
2. Run `npm run check` without piping it. Require exit code 0.
3. Run `git diff --check HEAD~3..HEAD` and inspect `git status --short`.
   `.planning/milestone.lock` must remain untracked and untouched.
4. Confirm the three new commit titles with `git log --oneline -3` and confirm
   each title is at most 72 characters.
5. Push `features/workflows-detection` to its existing remote branch. Confirm
   `gh pr view 154 --json state,headRefName,headRefOid` reports the open PR and
   the pushed `HEAD`. Do not run a merge command.
</verification>

<success_criteria>
- All seven supplied PR #154 findings map to a completed task and passing check.
- Production behavior changes only by moving the workflow reason literal to
  the true append-only tail.
- Invalid and side-effecting workflow contents remain opaque and inert.
- Strict and loose resolver coverage includes regular-file negatives and
  falsey entry and plugin-manifest declarations.
- `REASONS` has exactly 44 members, with every inherited member in its original
  position and `workflows` last.
- Focused tests, pre-commit checks, TruffleHog scans, and `npm run check` pass.
- Three atomic Conventional Commits update PR #154; the PR remains open and
  unmerged.
</success_criteria>

<output>
Create `.planning/workstreams/workflows-detection/quick/260829-pyv-address-pr-154-review-findings-close-wor/260829-pyv-SUMMARY.md` when done.
</output>
