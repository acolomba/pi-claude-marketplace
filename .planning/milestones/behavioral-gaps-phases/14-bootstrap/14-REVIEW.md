---
phase: 14-bootstrap
reviewed: 2026-11-08T00:00:00Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - features/plugin/bootstrap.feature
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
  necessity: 1
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-11-08T00:00:00Z
**Depth:** standard
**Files Reviewed:** 1
**Status:** issues_found

## Summary

I reviewed `features/plugin/bootstrap.feature` (diff `7e961d04..HEAD`) against the cucumber skill (`SKILL.md`, `rules/features.md`, `rules/steps.md`), the locked decisions in `14-CONTEXT.md`, and the step definitions the new lines use:

- `command.steps.ts`: the RPC, json-mode, and terminal `When` steps, `the result has these fields:`, `the result lists these plugins:`, `the command reports these results:`, and `pi's terminal shows this result of the command:`
- `scope-state.steps.ts`: the lock-holder `Given`
- `config.steps.ts`: `... does not exist`
- `plugin/installation.steps.ts` with `features/lib/git-clones.ts`: `holds no git clones`
- `marketplace/checkout.steps.ts`: `holds no marketplace checkout`
- `git-host.steps.ts`: `receives no request`
- `marketplace/publishing.steps.ts`: the official marketplace publisher

The new scenarios follow the rules:

- Steps are lower case, and each starts with `Given`, `When`, or `Then`. No `And` or `But` is used.
- Every `Given` comes before the `When`.
- In the terminal scenario, `pi's terminal shows this result of the command:` is the first `Then`.
- None of the new scenarios has an implementation tag. Bootstrap has no MCP surface.
- The tables are aligned.

Each result step compares a whole result:

- `lastResult()` requires exactly one payload.
- `recordTable` and `namesLike` add every column that the table leaves out.
- `resultsTable` pins the count of results.

So a partial match cannot pass. No expectation depends on the host:

- The cause chain uses `{agent dir}`.
- The PTY is a fixed 120 columns (`features/lib/pi-tui.ts:37`), so the 71-character refusal line does not wrap.
- D-BG-1404 correctly keeps the lock-held notice out of the terminal, because its cause line wraps at the length of a real temporary path.

The red proofs in the SUMMARY are sound for the result tables and for the refusal outline's first no-change step. I found no BLOCKER. There are two WARNINGs:

- The lock-held title says the bootstrap "records nothing", but no step reads the installation record.
- The new refusal titles say "with the user scope", which reads as the normal bootstrap target and not as the refused `--scope user` flag.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: The lock-held scenario says "records nothing" but never reads the installation record

**File:** `features/plugin/bootstrap.feature:130-143` (and the json-mode scenario at `145-158`)

**Issue:** The title says the bootstrap "fails as lock held and records nothing". In this project, the installation record is the scope's `state.json`, which `Then the installation record of ...` and `Then the <scope> scope holds no marketplace record` read. The scenario checks four things: the user `claude-plugins.json` is absent, there is no marketplace checkout, there are no git clones, and there are no git requests. It never checks the record. Suppose an implementation saves a `claude-plugins-official` marketplace record before it notices the held lock, still reports the `lock held` row, and does not clone. That implementation passes every step.

This is not very likely, because the add normally saves inside `withLockedStateTransaction`. That is why this finding is a WARNING and not a BLOCKER. But the title states a claim that no step proves. Its sibling `marketplace/failed-add.feature:112` and the dead-lock case in `marketplace/state-lock.feature:178` both state the record check explicitly.

**Fix:** Add the existing step to both lock-held scenarios. It returns early when `state.json` is absent, so it passes on today's product:

```gherkin
    Then the "claude-plugins.json" file of the user scope does not exist
    Then the user scope holds no marketplace record
    Then the user scope holds no marketplace checkout
    Then the user scope holds no git clones
    Then the git host receives no request
```

### WR-02: The new refusal titles say "with the user scope", which reads like a successful bootstrap

**File:** `features/plugin/bootstrap.feature:184`, `features/plugin/bootstrap.feature:198`

**Issue:** "Bootstrapping with the user scope in json mode reports the refusal it reports over rpc" and "Bootstrapping with the user scope in the terminal shows the refusal ..." do not say what is refused. Bootstrap always targets the user scope (line 3 of the description says so). So "bootstrapping with the user scope" describes the normal command, and the reader has to open the `When` line to learn that the refused thing is the `--scope user` flag. `rules/features.md` says a reader who never opens a step definition must understand what each scenario proves, and the title must name the behavior. The outline row label `the user scope` (line 179) has the same ambiguity. That label is older than this phase, but the new titles copy it.

**Fix:** Name the flag in the title, for example:

```gherkin
  Scenario: Bootstrapping with a --scope flag in json mode reports the refusal it reports over rpc
  Scenario: Bootstrapping with a --scope flag in the terminal shows the refusal it reports over rpc
```

If you also change the outline's `rejected` cells (for example, to `the --scope user flag`), the titles and the outline read the same.

## Info

### IN-01: Already-defended-elsewhere: `holds no marketplace checkout` repeats `holds no git clones`

**File:** `features/plugin/bootstrap.feature:141-142`, `features/plugin/bootstrap.feature:156-157`

**Category:** necessity

**Issue:** `readGitClones` (`features/lib/git-clones.ts:114-136`) asserts that `sources-staging` is empty and returns one clone for each subdirectory of `sources`. That is the same pair of directories that `holds no marketplace checkout` (`marketplace/checkout.steps.ts:45-57`) requires to be empty. The only difference is that the checkout step also counts plain files in those directories. A bootstrap does not create such files, because it only clones. `marketplace/state-lock.feature:140-141` sets the same precedent, so this costs nothing, but the second step adds almost no protection. The redundancy is provable from the two step bodies. Whether one step should go is a judgment call, so this is Info.

**Fix:** Keep both steps for parity with `marketplace/state-lock.feature`, or drop `holds no marketplace checkout` from the two lock-held scenarios.

### IN-02: The lock-held red proofs never reach the four no-change steps

**File:** `features/plugin/bootstrap.feature:140-143`, `features/plugin/bootstrap.feature:155-158`

**Issue:** Mutation M3 in the SUMMARY makes `acquireStateLock` ignore a held lock. Both lock-held scenarios then fail at `the command reports these results:`, so the four no-change steps after it never ran red. They are not vacuous. An add that clones before it takes the lock would trip `holds no git clones` and `receives no request`. But the SUMMARY claims that the scenarios "record nothing", and the red proof does not show it. For the refusal outline, the plan used a silent-sink mutation (Task 3, M1) to reach the later steps. The lock-held scenarios did not get the same treatment.

**Fix:** None is required for this file. If a later phase records red proofs for "changes nothing" claims, use a mutation whose result still matches, such as a silent-sink clone before the lock, so the trailing steps are the ones that fail.

### IN-03: Two different result steps pin the same single-cascade failure in one file

**File:** `features/plugin/bootstrap.feature:119-123` vs `features/plugin/bootstrap.feature:134-136`, `149-151`

**Issue:** The 404 scenario states its failure with `the result has these fields:` (vertical table, `summary` row). The new lock-held scenarios state the same shape with `the command reports these results:` (horizontal table, `summary` column). `marketplace/state-lock.feature` uses the vertical form for the identical lock-held failure. Both steps compare the result whole, and both require exactly one result, so protection is equal. But the file now uses two forms for one kind of outcome (P14-DC-08 records the choice).

**Fix:** Use `the result has these fields:` in the two lock-held scenarios, so they match the 404 scenario and `marketplace/state-lock.feature`.

### IN-04: The feature description grew to five lines

**File:** `features/plugin/bootstrap.feature:3-7`

**Issue:** `rules/features.md` says that every feature has a description of two or three lines. The description was four lines before this phase, and the phase added a fifth for the lock-holder helper. Many other feature files exceed the limit too (for example, `features/mcp-server/agent-grants.feature`). `check:features` does not enforce it, so this is Info.

**Fix:** Shorten the description. For example, fold the two stand-in sentences into one: "A loopback https git host stands in for GitHub, and a helper process holds the user scope's state lock as a second Pi would; one-shot json-mode and terminal Pis run the same command."

---

_Reviewed: 2026-11-08T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
