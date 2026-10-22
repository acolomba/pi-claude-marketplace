# Phase 5: Marketplace Info - Research

**Researched:** 2026-10-18
**Domain:** Real-Pi Cucumber coverage of marketplace information
**Confidence:** LOW (conservative provider-classifier result; direct source evidence is identified below)

<user_constraints>

## User Constraints (from CONTEXT.md)

The following decisions and discretion are copied verbatim from the phase context. [VERIFIED: .planning/phases/05-marketplace-info/05-CONTEXT.md:21-53]

<!-- DATA_e8c402fa_START -->

### Invalid manifests and scope fan-out

- **D-01 (user):** Preserve the shipped invalid-manifest representation: a
  known marketplace whose manifest can no longer be loaded renders through the
  existing `plugin-info` failed-row shape with `{invalid manifest}`. Phase 5
  does not introduce a new marketplace-failure message type.
- **D-02 (user):** When an unscoped info lookup finds the name in both scopes,
  evaluate and report the scopes independently in project-first order. A
  healthy scope still renders when the other scope's manifest is invalid; the
  invalid scope renders its failed row instead of failing or suppressing the
  entire command.

### Scoped misses

- **D-03 (user):** When `--scope` names a scope that does not hold the
  marketplace but the other scope does, report
  `<name> [<requested-scope>] (failed) {marketplace not added}` and preserve the
  existing cross-scope indication that a copy exists elsewhere. Do not fall
  back to or render the other scope's marketplace.

### Allowed dependency marketplaces

- **D-04 (user):** Display `allowCrossMarketplaceDependenciesOn` names in
  manifest declaration order. Do not alphabetize them. The scenario must use a
  deliberately non-alphabetical list so it proves the ordering contract.

### Agent's Discretion

- Exact Gherkin wording, fixture names, helper boundaries, and plan split,
  within the repository's Cucumber rules.
- Whether a behavior already pinned by focused unit tests needs production
  changes or only behavioral coverage.
- The exact non-alphabetical marketplace names used to prove D-04.

<!-- DATA_e8c402fa_END -->

### Deferred Ideas (OUT OF SCOPE)

<!-- DATA_71cdb890_START -->

- INFO-07 and all remote no-request proofs remain in Phase 9.
- Activating `@url` and `@github` examples remains in Phases 9 and 10.
- Marketplace update behavior, including a file source outside
  `.claude-plugin/`, remains in Phase 6.

<!-- DATA_71cdb890_END -->

[VERIFIED: .planning/phases/05-marketplace-info/05-CONTEXT.md:164-167]

</user_constraints>

## Summary

Extend the existing info feature and fixture dispatch. The four starting scenarios already exercise a directory source, an absent marketplace, healthy two-scope fan-out, and a schema-invalid manifest. Their complete result tables provide the starting vocabulary. [VERIFIED: features/marketplace/info.feature:7-70]

Two implementation seams need planning attention. First, the current fixture writer has no description field, while a single source Outline must compare different source-object shapes. Second, the orchestrator collects scopes in project-first order but partitions successes and failures before emission. This means a failed project scope is emitted after a healthy user scope, contrary to D-02. Preserve the existing success cascade and failure message shapes while correcting this order. [VERIFIED: features/lib/path-marketplace.ts:83-104] [VERIFIED: features/lib/field-rows.ts:73-95] [VERIFIED: extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts:178-209]

**Primary recommendation:** Plan three cohesive slices: complete source details and allowance ordering; scope misses and healthy fan-out; mixed-scope failure order with a focused owner-test regression and real-Pi proof. This is a proposed task split, not a new product decision.

## Architectural Responsibility Map

| Capability | Primary tier | Secondary tier | Rationale / evidence |
| --- | --- | --- | --- |
| Declare expected behavior | Behavioral specification | Step assertions | Full tables compare visible payloads. [VERIFIED: features/step_definitions/command.steps.ts:116-161] |
| Publish description and allowance inputs | Test fixture filesystem | Source-kind dispatcher | Keep kind dispatch below steps; allowance writing already appends in declaration order. [VERIFIED: features/lib/published-marketplace.ts:158-170] [VERIFIED: features/lib/path-marketplace.ts:110-118] |
| Select scopes and read effective settings | Orchestrator | Local persistence | Scope collection uses `opts.scope === undefined ? ["project", "user"] : [opts.scope]`. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/scope-fanout.ts:56-91] |
| Preserve success/failure emission order | Marketplace info orchestrator | Notification dispatch | Successes and failures are currently collected separately. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts:178-209] |
| Validate and compare outputs | Existing Pi driver and command steps | Published notification schema | Multi-result comparison keeps payload count, kinds, fields and order. [VERIFIED: features/step_definitions/command.steps.ts:152-161] |

## Project Constraints (from AGENTS.md)

Apply these directives throughout planning and execution. [VERIFIED: AGENTS.md]

- Read before editing, trace callers before modifying functions, research first. Make surgical changes; keep unrelated work intact.
- Stay in GSD. Use CodeGraph first for code discovery in this indexed repository. Use the Fallow task map for impact tracing, architecture checks, audits and reviews.
- Never commit on main, rebase, rewrite history or skip hooks. Use approved branch naming and Conventional Commit messages without milestone, phase, plan or wave identifiers. Run staged-file fixers and the commit hook as the committing skill specifies.
- Use the local-verification skill. Every wave and phase gate runs the combined-tree full check; incremental hook success does not substitute for it. Reuse only unchanged-input evidence from this session.
- Include Threat Flags in every execution SUMMARY. Prefix broken-window descriptions with the milestone; use the GSD append command rather than editing the ledger.
- Preserve upstream parity unless a recorded decision or Pi capability gap permits divergence. Reuse the compatibility evidence in CONTEXT.
- Keep strict TypeScript, the resolver's discriminated installability contract, the declared Node and Pi API floors, atomic production disk writes, reload-only recovery, and retry-safe operations.
- Keep info read-only and offline. Preserve scope containment and the two-scope model; the local layer is not a third scope.
- Preserve mode-selected notification transport, with no command stdout/stderr writes, telemetry, or localization surface.
- Before a PR, offer the prescribed version bump and update the changelog. PR descriptions use simple-english Plain mode and humanizer. Milestone PRs require audit and closeout before squash merge. These are later delivery obligations, not research-file tasks.
- Follow Cucumber vertical ownership, complete-result comparison, per-scenario state and resource release, lower-case steps, and excluded remote Examples. Plans name scenario titles and their purpose. [VERIFIED: .agents/skills/cucumber/rules/layout.md] [VERIFIED: .agents/skills/cucumber/rules/features.md] [VERIFIED: .agents/skills/cucumber/rules/world-and-stand-ins.md]

<phase_requirements>

## Phase Requirements

Descriptions below are copied from the requirement ledger. [VERIFIED: .planning/REQUIREMENTS.md:103-111]

| ID | Description | Research support |
| --- | --- | --- |
| INFO-01 | Info on a dir or file marketplace shows its absolute path, autoupdate state, and description | Add explicit description setup; both local rows in the source Outline. |
| INFO-02 | Info on a url marketplace shows the identity URL and ref | Excluded URL row must carry a nonempty ref and assert URL separately. |
| INFO-03 | Info on a GitHub marketplace shows owner, repo, and ref | Excluded GitHub row asserts all three identity fields. |
| INFO-04 | A name both scopes hold, without `--scope`, shows one block per scope, project first | Retain full cascade comparison and add mixed-validity ordering proof. |
| INFO-05 | A name neither scope holds fails as `marketplace not added` with no scope | Existing complete miss scenario. |
| INFO-06 | `--scope` naming the scope that misses, while the other holds the name, says which scope missed | Add one scenario for each direction; compare qualified reason and requested scope. |
| INFO-08 | Info on a marketplace whose manifest became invalid reports a failed `invalid manifest` row | Retain existing failed-row shape and add mixed-scope survival. |
| INFO-09 | Info shows the marketplaces a manifest allows cross-marketplace dependencies on | Reuse repeated allowance setup with reverse lexical order. |

</phase_requirements>

## Standard Stack

Retain installed dependencies; this phase needs no package installation or upgrade. The table records repository declarations, not claims about latest registry releases. [VERIFIED: package.json:17-38]

| Component | Repository declaration | Use |
| --- | --- | --- |
| Cucumber | `"@cucumber/cucumber": "^13.3.0"` | Existing behavioral runner. |
| Pi | `"@earendil-works/pi-coding-agent": "^1.0.0"` | Real extension process. |
| TypeScript | `"typescript": "^6.0.3"` | Existing strict source and step code. |
| Node | `"node": "^22.22.2 || ^24.15.0 || >=26.0.0"` | Native TypeScript and test runner. |

Use existing Node assertions and unit-test infrastructure. A new framework, JSON comparator, process harness, or network fake is unnecessary. [VERIFIED: .agents/skills/typescript-unit-tests/SKILL.md] [VERIFIED: features/step_definitions/command.steps.ts:18-27]

## Package Legitimacy Audit

Not applicable: the recommendation installs no packages. Registry currency and publish dates are intentionally not upgrade inputs for this phase.

## Architecture Patterns

```text
Gherkin source and manifest declarations
  -> source-kind fixture dispatcher -> sandbox manifest
  -> real Pi command -> scope collector
  -> per-scope manifest read
       -> success block
       -> failed row
  -> notification strategy -> schema-validated payload sequence
  -> complete field / row / sequence assertion
```

This diagram describes the inspected flow; preserve the ordering between per-scope outcomes and notification emission. [VERIFIED: features/step_definitions/marketplace/publishing.steps.ts:46-95] [VERIFIED: extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts:161-209] [VERIFIED: features/step_definitions/command.steps.ts:106-161]

### Source details in one Outline

The fixture source kinds are exactly `"dir" | "file" | "url" | "github"`; output source kinds differ: `"github"`, `"url"`, `"path"`. The latter source object carries respectively owner/repo/ref, URL/ref, or absolute path. Both local inputs become the path arm. [VERIFIED: features/lib/published-marketplace.ts:22-25] [VERIFIED: extensions/pi-claude-marketplace/shared/notification-types.ts:880-897]

Recommended implementation: add one info-specific full-result assertion step with a documented empty-cell convention for absent source members. It should construct the expected complete source object from the explicit table and deep-compare the entire result projection, retaining count, envelope, description, timestamp, and unexpected-field checks. Keep this adapter in the info step module; do not teach the generic comparator to ignore extra or missing fields. The existing generic comparator intentionally rejects columns absent from every record, so a table containing blank URL/owner/repo cells does not work unchanged for local rows. [VERIFIED: features/lib/field-rows.ts:73-95] [VERIFIED: features/step_definitions/command.steps.ts:116-121]

Use one untagged local Examples block and the existing remote tag blocks. The profile currently declares `"tags": "not @url and not @github"`; remote fixture dispatch explicitly throws until the stand-ins land. Give remote rows explicit ref-bearing source inputs; later source-kind phases must publish the named ref. Do not activate these rows in this phase. [VERIFIED: cucumber.json:2-7] [VERIFIED: features/lib/published-marketplace.ts:112-130]

Add a description setup operation through the existing fixture dispatcher and local fixture writer, called by a reusable publishing step. Keep the description explicit in the scenario. Apply it after any plugin-offering setup because offering plugins republishes the manifest. Local fixture creation writes `path.join(root, ".claude-plugin", "marketplace.json")`; the file input uses that manifest while the directory input uses its root. Info projects the recorded marketplace root, so do not expect the file input string as its output path. [VERIFIED: features/lib/path-marketplace.ts:60-62,83-104] [VERIFIED: features/lib/published-marketplace.ts:119-126] [VERIFIED: features/step_definitions/marketplace/publishing.steps.ts:33-43] [VERIFIED: extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts:79-80]

### Scope isolation and mixed outcomes

Use distinct fixture directories with the same manifest name for mixed validity. Adding the same path twice and corrupting it corrupts both scopes. The existing alternate-directory publisher separates directory and manifest name; its add-specific step deliberately does not replace the world's name-keyed record. Reuse that library seam from an info-owned setup step, or promote genuinely shared step text in a separate commit under the layout rule. [VERIFIED: features/lib/published-marketplace.ts:106-126] [VERIFIED: features/step_definitions/marketplace/add.steps.ts:55-65] [VERIFIED: features/support/world.ts:47-48]

Implement D-02 by keeping ordered outcomes through classification. If every outcome succeeds, preserve the current one-block or success-cascade form. If any fails, emit each outcome in collection order. Add a regression for failed project/healthy user; retain healthy project/failed user and all-success coverage. The current unit test covers only healthy project followed by failed user, with a missing manifest, which cannot expose the reversed case. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts:178-209] [VERIFIED: tests/orchestrators/marketplace/info.test.ts:945-1005]

Use the existing multi-result step for mixed outcomes. It already compares every field across the payload sequence and has no row arrays to mark when the two payloads are standalone info and failed plugin-info. No notification schema widening is necessary. [VERIFIED: features/step_definitions/command.steps.ts:152-161]

### Scope-miss vocabulary

Preserve the actual cross-scope indication: `"marketplace not added to user scope"` and `"marketplace not added to project scope"`. The unqualified case is `"marketplace not added"`. The indication is a resolved reason, not a separate wire flag the test should invent. This satisfies D-03's instruction to preserve the existing cross-scope indication; the generic token in the catalog's scope-mismatch example is stale relative to resolver and focused tests. [VERIFIED: extensions/pi-claude-marketplace/shared/notification-resolve.ts:565-572] [VERIFIED: tests/orchestrators/marketplace/info.test.ts:707-783] [VERIFIED: docs/output-catalog.md:2705-2717]

## Plan-Ready Task Boundaries

These are recommended implementation tasks, with ownership scoped to the inspected seams:

1. **Source identity and manifest details:** convert the directory scenario into one four-kind Outline; add description setup and the narrow info assertion; add the declaration-order allowance scenario. Own the info feature, new info step module, publishing steps, and the two fixture libraries. Use the existing allowance step twice with a reverse-alphabetical pair. Do not change global fixture defaults.
2. **Scope selection:** complete both directed scoped misses, retain the unscoped miss, and strengthen healthy fan-out with different per-scope autoupdate values so copying one scope's details fails. Own the info feature; reuse command setup and whole-result assertions.
3. **Failure isolation and ordering:** build independent same-name fixtures, add two mixed-validity scenarios, reproduce the failed-project ordering defect in the paired owner test, and make the narrow orchestrator correction. Own the info fixture step, info feature, marketplace info orchestrator, and its paired test. Review any notification catalog statement changed by the correction.

Sequence these tasks because they share the info feature. Name concrete scenario titles in each plan. Proposed titles: “Info shows the source identity and description”; “Info preserves the declared order of allowed marketplaces”; “Info reports a missing project scope without falling back”; “Info reports a missing user scope without falling back”; “Info reports an invalid project before a healthy user”; “Info keeps a healthy project when the user manifest is invalid”. The existing feature contains the remaining baseline behaviors. [VERIFIED: features/marketplace/info.feature:7-70]

## Don't Hand-Roll

| Problem | Use instead | Evidence |
| --- | --- | --- |
| Real-process command execution | Existing Pi driver and command steps | [VERIFIED: features/step_definitions/command.steps.ts:101-113] |
| Multi-result comparison | Existing complete envelope table | [VERIFIED: features/step_definitions/command.steps.ts:152-161] |
| Allowed marketplace setup | Existing append operation, repeated in declaration order | [VERIFIED: features/lib/path-marketplace.ts:110-118] |
| Scope enumeration | Existing scope collector | [VERIFIED: extensions/pi-claude-marketplace/orchestrators/scope-fanout.ts:56-70] |
| Remote source simulation | Deferred source-kind stand-ins | [VERIFIED: .planning/phases/05-marketplace-info/05-CONTEXT.md:164-167] |

## Common Pitfalls

- **Sorting the allowance:** the fixture appends, and info passes through the array; use reverse lexical order so an accidental sort fails. [VERIFIED: features/lib/path-marketplace.ts:110-118] [VERIFIED: extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts:101-104]
- **Wrong invalid input:** use valid JSON that violates the manifest schema. The fixture writes `plugins: "nope"`; malformed JSON has a different reason in the existing catalog. [VERIFIED: features/lib/path-marketplace.ts:121-142] [VERIFIED: docs/output-catalog.md:2679-2691]
- **Timestamp omission:** the JSON baseline includes `details last updated at` even for local sources. Keep `{scenario time}`; text rendering rules do not define the wire shape. [VERIFIED: features/marketplace/info.feature:14-23]
- **Success-only ordering proof:** healthy project/failed user passes the current success-first partition. Reverse the failing scope to expose D-02. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts:196-209]
- **Weak source checks:** do not select a handful of fields or derive expected identity from the actual payload. Compare the entire explicitly stated result. [VERIFIED: .agents/skills/cucumber/rules/steps.md]
- **Premature remote execution:** keep the remote Examples excluded; the feature gate still validates their step bindings. [VERIFIED: cucumber.json:6-7] [VERIFIED: .agents/skills/cucumber/SKILL.md]

## Code Examples

Existing append semantics, quoted verbatim; repeated setup calls preserve order. [VERIFIED: features/lib/path-marketplace.ts:114-118]

<!-- DATA_c2b0376e_START -->

```typescript
  manifest.allowCrossMarketplaceDependenciesOn = [
    ...(manifest.allowCrossMarketplaceDependenciesOn ?? []),
    target,
  ];
  await writeFile(manifestPath(root), JSON.stringify(manifest));
```

<!-- DATA_c2b0376e_END -->

Existing complete multi-result comparison, quoted verbatim. Reuse it for mixed scopes. [VERIFIED: features/step_definitions/command.steps.ts:158-162]

<!-- DATA_4dcfb2a1_START -->

```typescript
Then("the command reports these results:", function (this: ScenarioWorld, table: DataTable) {
  const [stated = []] = table.raw();
  const records = this.allResults().map((result) => envelopeFields(result, this.tokens));
  assert.deepStrictEqual(recordTable(stated, records), table.raw());
});
```

<!-- DATA_4dcfb2a1_END -->

## Compatibility and State of the Art

Carry the compatibility record from CONTEXT: installed Claude Code 2.1.296 and official command/schema references were checked there on 2026-10-18; no marketplace-info upstream presentation contract was found. This session reuses that evidence rather than claiming a fresh binary probe. The Pi-only presentation and composition decisions are D-01 through D-04. [VERIFIED: .planning/phases/05-marketplace-info/05-CONTEXT.md:80-102]

Retain the project's structured-output contract instead of terminal substring assertions; keep source concepts aligned with the carried upstream vocabulary. Sources carried by context: [official CLI reference](https://code.claude.com/docs/en/plugins/cli-reference), [official marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference). [VERIFIED: .planning/phases/05-marketplace-info/05-CONTEXT.md:80-102]

## Environment Availability

Observed in this session through version commands and the feature run. [VERIFIED: terminal probes, 2026-10-18]

| Dependency | Available version | Execution implication |
| --- | --- | --- |
| Node | v26.11.1 | Matches the repository's declared floor. |
| npm | 11.20.0 | Existing scripts available. |
| Cucumber | 13.3.0 | Existing feature runs. |
| Pi | 1.0.0 | Runs successfully outside the tool sandbox. |

The initial sandboxed feature run failed in every Before hook with `Error: Pi exited (0)`; no behavior assertion ran. The same command outside the sandbox passed all four scenarios and 27 steps in 2.754 seconds. Treat the first result as an execution-environment issue, not an info regression. [VERIFIED: terminal runs, 2026-10-18]

No missing dependency requires an install. Remote source stand-ins are deliberately deferred, not a missing dependency to add here. [VERIFIED: .planning/phases/05-marketplace-info/05-CONTEXT.md:164-167]

## Validation Architecture

### Test framework and baseline

Use the existing Cucumber configuration and Node owner tests. Scripts are `"test:cucumber": "cucumber-js"` and `"check:features": "node scripts/check-features.mjs"`. The full check includes behavioral tests and all-pair direct coverage. [VERIFIED: package.json:85-112]

- Quick behavioral command: `npm run test:cucumber -- features/marketplace/info.feature`.
- Binding/layout command: `npm run check:features` (all Examples, including excluded ones).
- Owner regression command: `node --test tests/orchestrators/marketplace/info.test.ts`.
- Production-pair coverage after the ordering change: `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts`.
- Wave/phase gate: `npm run check`.

These commands follow the project's documented check selection. Baseline feature and feature-gate commands passed this session; the complete gate was not rerun for research-only Markdown. [VERIFIED: .agents/skills/local-verification/rules/commands.md] [VERIFIED: terminal runs, 2026-10-18]

### Phase requirements to tests

Use the quick behavioral command above for every row; remote rows additionally use the binding/layout command now and execute in their designated source-kind phases. The present behavior locations are the four scenarios in the existing info feature. [VERIFIED: features/marketplace/info.feature:7-70] [VERIFIED: cucumber.json:6-7]

| Requirement | Behavioral proof | Existing coverage / gap |
| --- | --- | --- |
| INFO-01 | Complete directory and file results with explicit description | Directory baseline exists; description and file variant missing. |
| INFO-02 | URL identity and nonempty ref | Add tagged Outline row; runtime activation deferred. |
| INFO-03 | GitHub owner/repo and nonempty ref | Add tagged Outline row; runtime activation deferred. |
| INFO-04 | Project-first cascade plus both mixed-validity directions | Healthy cascade exists; mixed behavioral cases missing. |
| INFO-05 | Entire unscoped absent result, no scope member | Exists. |
| INFO-06 | Entire scoped absent result and qualified reason in both directions | Add two scenarios. |
| INFO-08 | Schema-invalid failed row and surviving healthy scope | Single invalid case exists; mixed cases missing. |
| INFO-09 | Whole allowed-marketplaces array in nonalphabetical order | Add scenario using existing setup. |

### Sampling and Wave 0 gaps

Run focused scenarios while editing, the owner regression and pair coverage when production changes, and the feature gate before committing. Let the normal hook perform its incremental checks. Run the full combined-tree check at each required GSD gate; passing the hook is insufficient. [VERIFIED: .agents/skills/local-verification/rules/commands.md] [VERIFIED: .agents/skills/local-verification/rules/gates.md]

No new runner or driver bootstrap is needed. The implementation gaps are description setup, the source-aware complete assertion, and independent same-name fixture setup. The existing helpers and their limitations are documented above; implement only helpers actually used by the named scenarios.

## Security Domain

The phase is a local read-only command and behavioral test extension. The official ASVS page describes a web-application standard and says requirement references must be version-qualified. Apply relevant concepts without claiming web-application compliance or copying unversioned category numbers from an old template. [CITED: https://owasp.org/projects/asvs]

| Security area | Phase applicability | Control / evidence |
| --- | --- | --- |
| Input validation | Yes: changed manifest content | Existing manifest parser and typed failure classification. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts:91-104,182-188] |
| Authorization / scope isolation | Yes: requested scope must not fall back | Existing scoped collector; add both missed-scope tests. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/scope-fanout.ts:56-70] |
| Authentication and session management | No new mechanism in this phase | The info orchestrator reads local records and manifests. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts:13-29,161-209] |
| Cryptography and remote transport | No implementation planned | Remote stand-ins and request proofs are deferred by context. [VERIFIED: .planning/phases/05-marketplace-info/05-CONTEXT.md:164-167] |
| Information disclosure / external side effects | Preserve sandbox and offline boundaries | User-owned fixture inputs, no state/clone introspection, no public remote execution. [VERIFIED: .agents/skills/cucumber/rules/world-and-stand-ins.md] |

Threat considerations: malformed manifests must produce the established failed row; a corrupt scope must not conceal the healthy scope; fixture mutations must remain inside scenario-owned roots. These follow the inspected parser, scope loop and fixture release pattern. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts:178-209] [VERIFIED: features/step_definitions/marketplace/publishing.steps.ts:46-55]

## Threat Flags

No new network, credential, or production write surface is recommended. The ordering correction changes notification emission only. Execution summaries must still report any security-relevant surface introduced beyond their plan threat model. [VERIFIED: AGENTS.md] [VERIFIED: extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts:178-209]

## Assumptions Log

No unverified product behavior is promoted to a locked decision. Proposed helper shapes and task splits are recommendations under the context's discretion. Remote runtime behavior remains explicitly unexecuted until the later source-kind phases.

## Open Questions

Resolved during planning; no research question remains open.

- **RESOLVED — regression execution contract:** The failed-project ordering defect is established from control flow, not a newly executed failing regression. `05-01-PLAN.md` Task 1 requires the owner test to record exact notification invocation order and the real-Pi scenario to fail on the current ordering before the narrow production correction. Task 2 verifies the opposite direction and remaining branches. This resolves the implementation approach under D-01 and D-02; red/green execution evidence is still required during execution and is not claimed here. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts:178-209] [VERIFIED: features/marketplace/info.feature:7-70]
- **RESOLVED — deferred remote fixture contract:** `05-02-PLAN.md` Task 1 specifies nonempty `stable` refs and explicit URL/GitHub identity fields in the source Outline, retains `@url`/`@github` runtime exclusions, and validates their bindings now. The stand-ins delivered in Phases 9 and 10 must honor those declared refs when activating the rows. Runtime proof belongs to those phases, as CONTEXT.md explicitly defers it; no remote fixture implementation or execution is required in Phase 5. [VERIFIED: cucumber.json:6-7] [VERIFIED: features/lib/published-marketplace.ts:127-129]

## Sources and Metadata

Primary project evidence: phase context and requirements; marketplace info orchestrator and owner tests; scope collector; notification type and reason definitions; info feature; publishing, command and fixture modules; Cucumber and local-verification rules. Every source-specific claim cites the inspected location above.

External lookup used the research-plan seam, which selected Jina; that provider was unavailable, so the built-in web reader fetched the official ASVS page. Its digest was cached under the plan key. Compatibility evidence was carried from CONTEXT without a redundant lookup. Graphify reported disabled; CodeGraph was used for initial code discovery. [VERIFIED: research-plan, research-store and graphify terminal results, 2026-10-18]

The confidence classifier returned `LOW` for both `codebase --verified` and `webfetch --verified`; this report retains that conservative overall tier rather than inventing a higher provider tier. Direct in-repository observations remain checkable through verbatim values and source references. There are no inferred compatibility bounds or registry-legitimacy claims.

**Validity:** Recheck affected source citations after implementation; remote-runtime readiness must be established in the later source-kind phases.
