---
phase: 07-agent-frontmatter-and-grants
plan: "03"
subsystem: bridges-agents
tags: [frontmatter, agents, description, rename, parity]
status: complete
requires:
  - readAgentFrontmatter (plan 07-02), which reads `description: |` with its line breaks and `name: "x"` as `x`
provides:
  - descriptionLines (bridges/agents/frontmatter.ts, module-private), the `|-` block emitter
  - a harness agent-detail projection that keeps every line of a description
  - Then "the installation record of the {word} scope holds these agents of {string}:"
  - Then "the agents directory of the {word} scope holds these file names:"
affects:
  - every producer of a generated agent file (install, update, reinstall, enable, apply, grants rewrite)
tech-stack:
  added: []
  patterns: ["fixed-indent literal block so no free-text line reaches column 0 of a line-based reader"]
key-files:
  created:
    - .planning/phases/07-agent-frontmatter-and-grants/07-03-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts
    - test/bridges/agents/frontmatter.test.ts
    - features/lib/upstream/subagents.ts
    - features/agent/frontmatter.feature
    - test/integration/provenance-invisibility.test.ts
    - features/step_definitions/plugin/installation.steps.ts
    - docs/mcp-compatibility.md
decisions:
  - "A description that splits on CRLF, CR, LF, U+2028, or U+2029 into more than one part is written as `description: |-` plus each part, an empty part as an empty line, any other part with two spaces in front (D-PG7-06, AG-8)"
  - "A one-line description that is exactly `|`, `|-`, `>`, or `>-` is written inside double quotes"
  - "The quoted-name rename needs no production change: the agents commit removes every previous row the plugin owns (D-PG7-07)"
metrics:
  completed: 2026-11-14
  tasks: 3
actuals:
  tokens: 9000
  tasks: 3
  commits: 3
plan_head_before: f31f7361e8a55decd90b8603ff135dfc1d43f185
plan_head_after: 448f5be76d78f0900c14cd45e9236309a420377f
---

# Phase 07 Plan 03: Description blocks and quoted-name renames Summary

A multi-line agent description now reaches pi-subagents as a `|-` literal block with a two-space indent, so `subagent get` shows each line and no line can become a key or close the frontmatter. Two guard scenarios prove that an update and a reinstall rename an agent installed under a quoted name, with no production change.

## Commits

| Task | Commit | Title | Hook |
|------|--------|-------|------|
| 07-03-01 | 71c1a5aa | feat(agents): keep the lines of a multi-line description (5 files) | check:commit Passed, gitlint Passed |
| 07-03-02 | 46b4225d | test(agents): prove the rename of an agent with a quoted name (2 files) | check:commit Passed (second attempt), gitlint Passed |
| 07-03-03 | 448f5be7 | docs(agents): record description blocks and quoted-name renames (1 file) | gitlint Passed (docs-only, npm-check skipped by its file filter) |

No commit used `--no-verify`, `--amend`, `git stash`, or `git add -A`. `07-VALIDATION.md` stayed unstaged in every commit. The commit of 07-03-02 lists no path under `extensions/` (`git diff --quiet HEAD -- extensions` exit 0 before it).

## Red and green runs

Node v26.13.1 locally (CI pins 24).

Task 07-03-01:
- Red, on the tree plan 07-02 left (HEAD f31f7361), with only the new scenario added: `npm run test:cucumber:profile -- --profile adapter features/agent/frontmatter.feature --name "A description block keeps its lines"`: exit 1, 1 scenario (1 failed). The tool result read `description Reviews the change. Then it reports each finding.` (one flattened line); the staged-file step was skipped.
- Green after the change: `npm run test:cucumber:profile -- --profile adapter features/agent`: exit 0, 49 scenarios (49 passed), 696 steps. `features/mcp-server/agent-grants.feature` (the only other feature that calls `subagent get`), adapter: 20 passed. Builtin profile, `features/mcp-server/agent-grants.feature features/agent/frontmatter.feature`: 14 passed.
- `node --import "$PWD/test/platform/isolated-pi-home.ts" --test "test/bridges/agents/*.test.ts"`: 455 tests, 455 pass.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts`: exit 0.
- `node scripts/install-test-peers.mjs && node --import ... --test test/integration/provenance-invisibility.test.ts test/integration/skill-path-resolution.test.ts`: 7 tests, 7 pass (pi-subagents 0.88.1).
- Mutation: removing the two-space indent from the block lines made the new integration case fail (`frontmatter.description` came back `''`); the file was restored from a copy.
- `npm run check:features`: exit 0. ESLint and Prettier over the five files: clean.

Task 07-03-02:
- Green with the code as it is: `npm run test:cucumber:profile -- --profile adapter features/agent/frontmatter.feature --name "renames an agent"`: 2 scenarios (2 passed), 48 steps.
- Red by a working-tree mutation of `partitionPreviousEntries` in `bridges/agents/stage.ts`: both branches returned `{ replaced: [], kept: [...foreignPreservedEntries, ...previousEntries] }`, so no previous row's file or row is removed. Result: 2 scenarios (2 failed); each failed at "the agents directory of the user scope holds these file names:" with `pi-claude-marketplace-demo-"x".md` still present. A first mutation of only the non-force branch left the reinstall scenario green, because the reinstall swap commits with `force: overwrite`; the mutation was widened to cover both. The file was restored from a copy and `git diff --quiet HEAD -- extensions` returned 0.
- Green after restore: `npm run test:cucumber:profile -- --profile adapter features/agent/frontmatter.feature features/plugin/reinstall.feature features/plugin/update.feature`: exit 0, 69 scenarios (69 passed), 1013 steps.
- `recordedPlugin` now also requires `resources.agents`, so every feature that reads the installation record was run (adapter, 41 feature files): exit 0, 751 scenarios (751 passed), 9857 steps. After the dedupe refactor, the two features using the `... of {string}:` steps: 36 passed.
- `npm run check:features`: exit 0.

Task 07-03-03:
- `SKIP=npm-check pre-commit run --files docs/mcp-compatibility.md`: every hook passed, no file rewritten.
- The page cites three scenario titles; each exists once in `features/agent/frontmatter.feature`, and the feature passed in the 07-03-02 runs above.

The full `npm run check` wave gate was not run here. The orchestrator owns it.

## The two new steps

```gherkin
Then the installation record of the {word} scope holds these agents of {string}:
  | agent |
  | <generated name> ... |
Then the agents directory of the {word} scope holds these file names:
  | file |
  | <file name> ... |
```

Both compare complete tables. The record step reads `resources.agents` through a new `recordedNames` helper that also reads `resources.skills`, and fails when the record holds no such plugin (through a new `recordedPluginOf`, shared with the skills step).

## Changed owner-test expectations

`test/bridges/agents/frontmatter.test.ts`:
- The row "LF and CRLF sequences as spaces" (`first line second line third line`) is replaced by the block rows: two lines, a blank line with leading spaces, the hostile lines (`name: injected`, `tools: bash`, `# not a comment`, `---`), and one row each for CRLF, lone CR, U+2028, and U+2029. Four header-only rows are new.
- "emits complete metadata, sanitized provenance, and exact body bytes": the description `'"Review\nsource changes"'` was pinned as `description: '"Review source changes"'`; it is now `description: |-` with the lines `  "Review` and `  source changes"`. This changes by design (D-PG7-06). It is the only pinned multi-line description found.
- Every other one-line row passes with its expectation unedited (plain, both quote flips, both unmatched quotes, empty).

`test/integration/provenance-invisibility.test.ts`: the header no longer describes this extension's old line reader; two new tests (the hostile block, and the four header-only values) run against pi-subagents' own `parseFrontmatter`.

## Deviations from Plan

**1. [Rule 3 - Blocking] fallow clone group in the steps file.** The new agents step and the skills step shared a seven-line plugin lookup; `check:commit` failed on `dup:40dfb347`. I extracted `recordedPluginOf` and committed on the second attempt.

**2. [Rule 3 - Blocking] The update scenario compares the session's plugin rows.** A session that reports a pending update must have its rows compared before the next command, so the update scenario states the two `will update` rows, as its analog does.

**3. The rename mutation covers both branches of `partitionPreviousEntries`** (see the red runs). The plan named only the removal of previous rows; the reinstall path takes the forced branch.

**4. Header row in the file-names step.** The step compares a `file` heading row too, as the other directory steps do.

## Flagged assumptions (carried from the plan)

- The single-quoted fixture (`name: '"x"'`) stands in for an earlier release; the earlier-release step then replaces the installed file with an `async: false` text. The index row's source hash differs from a real earlier install, and the removal path does not read it.
- The rename scenarios are guards: they pass as soon as plan 07-02 landed and fail when the removal path breaks.
- The block scenario writes the agent file from a doc string, not a table cell (A4 not relied on).
- The emitter splits on U+2028 and U+2029 too, because pi-subagents' key pattern refuses them inside a one-line value.
- A description with a blank line, or with a line that reads as `<label>: <value>`, cannot be read through the harness detail projection; the owner and integration cases carry those.
- `translateLine` in `bridges/agents/legacy-grant-form.ts` is not edited (D-PG7-13); the fixed indent keeps a description line from reading as a `tools:` or `excludeTools:` line.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-07-09 and T-07-10 are mitigated by the block emitter with owner rows and the integration case; T-07-11 adds no write path.

## Parent lines

- CHANGELOG: "An agent whose plugin quotes its name, such as `name: \"x\"`, is now named without the quote marks; run `/claude:plugin reinstall` once to rename its installed file. A multi-line agent description now keeps its lines."
- PROJECT.md: D-PG7-07 (an update, a reinstall, or an apply renames an agent installed under a quoted name; nothing changes at load) is accepted without review.

## Self-Check: PASSED

- FOUND: commits 71c1a5aa, 46b4225d, 448f5be7 are ancestors of HEAD.
- FOUND: `description: |-` and `D-PG7-06` in frontmatter.ts; `D-PG7-06` in provenance-invisibility.test.ts, and no `line-based parseFrontmatter`; `holds these agents of` in installation.steps.ts; two `installed under a name with quote marks` titles; `D-PG7-06` and `D-PG7-07` in docs/mcp-compatibility.md.
