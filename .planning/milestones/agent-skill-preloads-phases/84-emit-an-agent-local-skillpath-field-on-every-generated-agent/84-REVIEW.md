---
phase: 84-emit-an-agent-local-skillpath-field-on-every-generated-agent
reviewed: 2026-07-20T12:57:05Z
depth: deep
files_reviewed: 9
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts
  - extensions/pi-claude-marketplace/bridges/agents/convert.ts
  - package.json
  - README.md
  - tests/bridges/agents/frontmatter.test.ts
  - tests/bridges/agents/convert.test.ts
  - tests/bridges/agents/convert-byte-identity.test.ts
  - tests/integration/skill-path-resolution.test.ts
  - package-lock.json
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 84: Code Review Report

**Reviewed:** 2026-07-20T12:57:05Z
**Depth:** deep
**Files Reviewed:** 9
**Status:** clean

## Summary

Reviewed the phase's six execution commits (`df4ba01c`, `e441eee7`, `148024ba`,
`cd14e8aa`, `8b0a79af`, `78bb14fa`) against `83ca1965`. This phase adds a
constant `skillPath: ../pi-claude-marketplace/resources/skills` line to every
generated agent that declares `skills:`, collapses the skill legend's two-state
annotation (`preloaded in your context` / `available on demand`) down to a
single unconditional `available on demand` annotation, adds `pi-subagents`
as an optional peer dependency floor at `>=0.35.0`, and adds an SC-2
resolver-contract integration test.

**Cross-file trace performed:**

1. **Legend collapse completeness.** `SkillLegendEntry.preloaded` and
   `detectSkillTokens`'s `emittedSkills`/`emitted.has(generated)` producer
   were both deleted in the same diff hunk that removed the `renderSkillLegend`
   ternary. Grepped the full tree for `preloaded in your context`,
   `emittedSkills`, and `.preloaded` — zero hits outside the phase's own
   diff, and the surviving prose uses of the word "preloaded" in
   `convert.test.ts` (lines 426, 482, 747, 805, 819, 1039) all describe
   membership in the emitted `skills:` frontmatter list, a still-live
   concept distinct from the deleted annotation string, and traced correctly
   (e.g. line 1039's "preloaded Pi skill" sits right after an assertion that
   `skills: spec-tree-review-changes` is present in that same test's
   frontmatter). No dangling references, no terminology drift.

2. **skillPath gating.** `emitGeneratedAgentFile` in `frontmatter.ts` only
   pushes the `skills:` and `skillPath:` lines inside the same
   `if (frontmatter.skills.length > 0)` block, so a skill-less agent's
   frontmatter is untouched — confirmed against the "omits skills line when
   skills array is empty" test and the AGSK-04 byte-identity fixtures.
   Verified the asymmetric case too: a legend entry for a *known-but-not-
   emitted* skill (token in body, not in `skills:`) correctly produces no
   `skillPath:` line, since resolving that skill relies on the inherited
   catalog, not the agent-local search root — internally consistent with
   the feature's purpose.

3. **Path correctness / NFR-10.** Traced `locations.ts`:
   `agentsDir = <scopeRoot>/agents`, `skillsTargetDir =
   <scopeRoot>/pi-claude-marketplace/resources/skills`. The literal
   `../pi-claude-marketplace/resources/skills`, resolved relative to the
   directory containing the agent `.md` file (`agentsDir`), lands exactly on
   `skillsTargetDir`. The string is a hardcoded literal with zero
   interpolation from plugin/user input — satisfies NFR-10 containment by
   construction, not by runtime check.

4. **Integration test soundness.** Ran the full affected test slice
   directly (`node --experimental-strip-types --test tests/bridges/agents/
   frontmatter.test.ts tests/bridges/agents/convert.test.ts tests/bridges/
   agents/convert-byte-identity.test.ts tests/integration/skill-path-
   resolution.test.ts`): 101/101 pass. Notably the SC-2 integration test did
   NOT hit its `t.skip()` path in this environment — it located a real
   installed `pi-subagents`, copied its `src/` tree out of `node_modules`,
   dynamically imported the internal `agents/skills.ts` module, and asserted
   real `resolveSkillsWithFallback`/`discoverAvailableSkills` behavior
   against a staged skill and the emitter's actual output. This is strong
   affirmative evidence the `skillPath` contract works end-to-end, not just
   that the test *would* pass if it ran. Every env var mutation
   (`PI_CODING_AGENT_DIR`, `PI_OFFLINE`) is captured before the `try` and
   restored in `finally`; the scratch dir is always removed in `finally`.
   Since `node --test` runs each file in its own subprocess, the env
   mutation carries no cross-file interference risk even under concurrent
   runs.

5. **peerDependenciesMeta.** `pi-subagents` is a net-new optional peer at
   `>=0.35.0` in both `package.json` and `package-lock.json`, consistent
   with the phase's design (this bridge should still function without
   `pi-subagents` installed — `resources/skills` staging and `mcp.json`
   entries don't depend on it). README's prerequisites bullet was updated to
   match the same floor. `package-lock.json`'s remaining diff (a `bin` path
   normalization and `libc` fields on optional platform packages) is routine
   `npm install` churn unrelated to this change, not something to flag.

6. **Static checks.** `npx tsc --noEmit`, `npx eslint` on the touched files,
   and `npx prettier --check` on the touched files (including `package.json`
   and `README.md`) all pass clean. Grepped the full diff for hardcoded
   secrets, `eval`/`innerHTML`/`exec(` patterns, debug artifacts
   (`console.log`, `debugger`, `TODO`/`FIXME`/`XXX`/`HACK`), and empty catch
   blocks — none found. The two `try { ... } catch { return undefined/null; }`
   blocks in the new integration test and in `mapSkills`'s
   `generatedSkillName` call are deliberate, documented graceful-degradation
   patterns (skip-on-absence, warn-drop-never-throw), not empty/silent
   swallows — each has a comment explaining why the catch exists and each
   caller-visible effect (skip, warning-push) is externally observable.
   Checked touched files against `.claude/rules/typescript-comments.md`
   (no `Phase NN`/`Plan NN`/`Wave N` references in any new or edited
   comment or test title — all traceability anchors use `D-84-0N`,
   `AGSK-0N`, `SC-2` style IDs).

All reviewed files meet quality standards. No issues found.
