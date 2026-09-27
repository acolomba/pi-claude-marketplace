---
phase: 260925-ucm
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
  - tests/domain/components/hooks/matcher.test.ts
  - tests/bridges/hooks/dispatch.test.ts
  - docs/hooks-compatibility.md
  - CHANGELOG.md
autonomous: true
requirements: [TOOL-02, MATCH-02]
must_haves:
  truths:
    - "A `PreToolUse` hook whose matcher is `Write|Edit|apply_patch` fires on the Pi `write` and `edit` tools; the foreign alternative is dropped and the group is not."
    - "A matcher whose every alternative is foreign (`MultiEdit` alone, `apply_patch` alone, `apply_patch|MultiEdit`) still drops its group as `unmapped-tool` and still renders `(partially-available) {unsupported hooks}`."
    - "An `mcp__<server>__<tool>` alternative still matches that MCP tool at dispatch, alone and beside Claude tool alternatives."
    - "A matcher containing any character outside `[A-Za-z0-9_|-]`, or an empty alternative, is still classified `regex`."
    - "`docs/hooks-compatibility.md` states per-alternative dropping and no longer claims `mcp__*` matchers are unsupported."
  artifacts:
    - extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - tests/domain/components/hooks/matcher.test.ts
    - docs/hooks-compatibility.md
    - CHANGELOG.md
  key_links:
    - "`parseMatcher` -> `toolMatcherCondition` in `domain/components/hooks/partition.ts`: only an all-foreign matcher may still return `unmapped`, or the `unmapped-tool` drop cond and every test that asserts it break."
    - "`parseMatcher` -> `matcherFiresOnToolEvent` in `bridges/hooks/dispatch.ts`: the generalized `tool-set` set is the sole dispatch-time comparison for both Pi tool literals and MCP tool names."
---

<objective>
Make a pipe-OR hook matcher degrade per alternative instead of dropping the whole
group. `Write|Edit|apply_patch` must keep firing on Pi `write` and `edit`; only a
matcher with no supported alternative left may drop.

Purpose: restore upstream parity. `docs/research/claude-hook-config-syntax.md:51`
records that Claude Code treats a matcher of only `[A-Za-z0-9_|]` as
exact-string-or-pipe-OR with no validation against a known-tool list, so upstream
`apply_patch` simply never matches and its siblings keep working. The whole-group
drop is this bridge's divergence (issue #217).

Output: a generalized `tool-set` arm carrying both Pi tool literals and MCP tool
names, the now-redundant `mcp-literal` arm folded into it, the test row that
asserts the bug flipped, and the compatibility doc and changelog corrected.
</objective>

<context>
@/home/acolomba/src/pi-claude-marketplace-issue-217/CLAUDE.md
@/home/acolomba/src/pi-claude-marketplace-issue-217/AGENTS.md
@/home/acolomba/src/pi-claude-marketplace-issue-217/skills/typescript-comments/SKILL.md
@/home/acolomba/src/pi-claude-marketplace-issue-217/skills/typescript-unit-testing/SKILL.md
@/home/acolomba/src/pi-claude-marketplace-issue-217/skills/typescript-google-style-review/SKILL.md
@extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts
@extensions/pi-claude-marketplace/domain/components/hooks/partition.ts
@extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts
@extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
@tests/domain/components/hooks/matcher.test.ts
</context>

<execution_environment>
Read this before the first edit. These are properties of this checkout, not advice.

- Working tree is the git worktree `/home/acolomba/src/pi-claude-marketplace-issue-217`
  on branch `features/issue-217`. Stay on it. Do not create or switch branches, do
  not move HEAD backwards, do not `git stash` (the stash stack is shared with other
  live sessions), do not `git commit --amend`.
- **Stage explicit paths only.** Never `git add -A` or `git add .`. The user edits
  files in this same checkout concurrently. At planning time the tree already carried
  unrelated modifications to `.claude/settings.json` and `.codex/config.toml` and an
  untracked `.mcp.json`; none of those belong to this change and none may be staged.
- Execution is sequential in this tree. There is no harness worktree isolation.
- `pre-commit` is a real binary on PATH (`/home/acolomba/.local/bin/pre-commit`,
  4.5.1). Invoke it as `pre-commit`, never `npx pre-commit`.
- No git `pre-commit` hook is installed, so committing runs no checks. Run the
  `pre-commit` gates yourself (Task 3).
- The `mdformat`, `markdownlint-cli2`, `trailing-whitespace`, `end-of-file-fixer`,
  `fix-smartquotes`, `fix-spaces` and `fix-unicode-dashes` pre-commit hooks REWRITE
  files. `git status --short` after every commit; repair any rewrite with a
  FOLLOW-UP commit, never an amend.
- Prose dashes in tracked markdown and in comments are `--`, not an em dash. The
  `fix-unicode-dashes` hook enforces it.
- Commit subjects are Conventional Commits with no phase, plan, milestone or PR
  number (the squash merge appends the PR number). `gitlint` runs with `B5,B6`
  ignored, so a body is optional.
- Node is v26.9.0 and runs `.ts` test files directly: `node --test <path>.test.ts`
  works with no flags.
- **Pin every git range to an explicit SHA.** Other sessions commit into sibling
  worktrees of this repository, so `HEAD~1` / `HEAD~3` names whatever landed last
  rather than your own work. Before the first edit, record the starting tip:

      SHAS=/tmp/claude-1000/-home-acolomba-src-pi-claude-marketplace-issue-217/4d22b5a2-ed1f-42fa-a06b-0b724c82f152/scratchpad/217-shas.env
      mkdir -p "$(dirname "$SHAS")"
      echo "BASE_SHA=$(git rev-parse HEAD)" > "$SHAS"

  After each commit, append its SHA (`FIX_SHA`, then `DOC_SHA`, then any
  `FMT_SHA`) to that file and source it in the verify steps. Never write `HEAD~N`.
</execution_environment>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Degrade a pipe-OR matcher per alternative and fold `mcp-literal` into `tool-set`</name>

  <files>
extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts
extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
tests/domain/components/hooks/matcher.test.ts
tests/bridges/hooks/dispatch.test.ts
  </files>

  <read_first>
`extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts` (whole file,
62 lines), `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts` lines
105-125, `tests/domain/components/hooks/matcher.test.ts` (whole file, 164 lines),
`tests/bridges/hooks/dispatch.test.ts` lines 57-75 and 125-150.
  </read_first>

  <behavior>
Write these expectations in `tests/domain/components/hooks/matcher.test.ts` FIRST
and observe the new and flipped rows RED against unmodified `matcher.ts`, then
implement. The rows marked "stays green" are regression anchors and must pass both
before and after.

Mixed retention (new or flipped -- these go RED first):
  - `Write|Edit|apply_patch` -> `{kind:"tool-set", toolNames:new Set(["write","edit"])}`
    (issue #217's own matcher)
  - `Edit|Write|MultiEdit`   -> `{kind:"tool-set", toolNames:new Set(["edit","write"])}`
  - `Edit|mcp__server__tool|Write`
                             -> `{kind:"tool-set", toolNames:new Set(["edit","mcp__server__tool","write"])}`
    (the row at line 85 today asserts the bug and must flip)
  - `apply_patch|mcp__server__tool`
                             -> `{kind:"tool-set", toolNames:new Set(["mcp__server__tool"])}`

No alternative survives (new row plus existing rows kept):
  - `apply_patch|MultiEdit`  -> `{kind:"unmapped", token:"apply_patch"}` (the FIRST
    discarded alternative, and the only row that exercises a second discard)
  - every single-token row at lines 98-122 (`edit`, `MultiEdit`, `WebFetch`, `Task`,
    `toString`, `constructor`, `__proto__`, `mcp____tool`, `mcp__server`,
    `mcp__server__`) -> `{kind:"unmapped", token}`  [stays green]

Representation change (flipped):
  - each of `mcp__github__create_issue`, `mcp__server__tool`,
    `mcp__my-server-1__some_tool`, `mcp__server__nested__tool`
                             -> `{kind:"tool-set", toolNames:new Set([literal])}`
  - the one-unsafe-character row at line 151: `mcp__server__tool` ->
    `{kind:"tool-set", ...}` while `mcp__server__tool!` -> `{kind:"regex"}`

Unchanged (stays green):
  - `""` and `"*"` -> `{kind:"match-all"}`
  - the 7 single Claude tool rows -> `{kind:"tool-set", toolNames:new Set([piTool])}`
  - every row at lines 124-149 -> `{kind:"regex"}`, including `Edit||Write`, `|`,
    `Edit|`, `|Edit`, `mcp__bad!__tool`, `mcp__server__bad!`
  </behavior>

  <action>
**A. `matcher.ts` -- generalize `tool-set` and classify per alternative.**

Change the `ParsedMatcher` `tool-set` arm to `{ kind: "tool-set"; toolNames:
ReadonlySet<string> }` and DELETE the `{ kind: "mcp-literal"; literal: string }`
arm. `toolNames` (not `piTools`) is the name: the set now also carries MCP tool
names, which are not `PiToolName` values, so the old name would state something
false about its own contents. Keep `CLAUDE_TO_PI_TOOL_NAME_LOOKUP` typed
`ReadonlyMap<string, PiToolName>` so the `PiToolName` import stays load-bearing.

Rewrite `parseMatcher` to this order, keeping `isMcpLiteral` and
`SAFE_MATCHER_CHARS` byte-identical:

1. `""` / `"*"` -> `{kind:"match-all"}` (unchanged, first).
2. `!SAFE_MATCHER_CHARS.test(raw)` -> `{kind:"regex"}` (MATCH-02). This test now
   runs BEFORE any MCP handling. That is behavior-preserving: `MCP_SEGMENT`
   admits only `[A-Za-z0-9_-]`, a strict subset of the safe set, so every
   MCP-shaped string passes the safe-character test. `mcp__bad!__tool` and
   `mcp__server__bad!` still reach `regex` by this line.
3. Split on `|` and classify each alternative in one pass:
   - empty alternative -> return `{kind:"regex"}` (unchanged).
   - a key of `CLAUDE_TO_PI_TOOL_NAMES` -> add its Pi spelling to `toolNames`.
   - `isMcpLiteral(alternative)` -> add the alternative verbatim to `toolNames`
     (Pi emits these as `CustomToolCallEvent.toolName`).
   - anything else -> discard, remembering the FIRST discarded alternative.
4. `toolNames.size === 0` -> `{kind:"unmapped", token:<first discarded>}`;
   otherwise `{kind:"tool-set", toolNames}`.

Step 4 is what keeps `partition.ts` correct with no edit: a wholly foreign
matcher still returns `unmapped`, so `toolMatcherCondition` still yields
`cond:"unmapped-tool"` and the closed `DroppedHook` cond set is untouched.
Do NOT edit `partition.ts` and do NOT edit `domain/resolver-types.ts`.

Use this shape for the first-discarded record, because `!` is banned in
`extensions/**` (`@typescript-eslint/no-non-null-assertion` is only relaxed for
`tests/**`) and `noUncheckedIndexedAccess` makes `discarded[0]` possibly
undefined:

  declare `let firstDiscarded = "";` before the loop; in the discard arm assign
  only when `firstDiscarded.length === 0`; return `token: firstDiscarded`
  directly. The empty string is a safe sentinel because an empty alternative
  returns `regex` from inside the loop, so no real discarded alternative can be
  `""`. State that reason in a comment.

Any alternative shape is acceptable ONLY if it satisfies both: no non-null
assertion and no `as`, and no branch that is unreachable for every possible
input. A `?? fallback` or `&&` whose second operand can never decide the result
costs 100% branch coverage, which `npm run test:coverage:unit` enforces.

Comments: say what the code does and why per `skills/typescript-comments`.
`TOOL-02`, `MATCH-02`, `D-58-04`, `D-58-05` and `#217` are allowed anchors.
No phase, plan, wave, milestone or `Pitfall N` / `Pattern N` reference. Do not
narrate the removed whole-group behavior -- describe only the code as it stands.

**B. `dispatch.ts` -- drop the folded arm and the cast.**

In `matcherFiresOnToolEvent` (line 112) delete `case "mcp-literal"` and change
`matcher.piTools.has(toolName as never)` to `matcher.toolNames.has(toolName)`.
The cast existed only because a `ReadonlySet<PiToolName>` cannot be queried with
a plain `string`; a `ReadonlySet<string>` can. Removing the arm keeps the switch
exhaustive over the four remaining kinds, which `noImplicitReturns` plus
`switch-exhaustiveness-check` require.

Update the docblock above it (lines 105-111): it names the `piTools` set. Restate
it for the current field -- the parsed matcher's `toolNames` set, which holds the
Pi tool literals a Claude matcher token maps to and the MCP tool names Pi emits
verbatim -- and keep the existing sentence about `regex` / `unmapped` being
unreachable at dispatch with a defensive `false`.

**C. `tests/domain/components/hooks/matcher.test.ts` -- flip and extend.**

Rename `piTools:` to `toolNames:` in the three existing tool-set assertions
(lines 37, 51, 64). Flip the four MCP-literal rows (lines 68-83) and the
one-unsafe-character row (line 161) to the tool-set representation, retitling the
MCP loop so its title describes keeping the MCP tool name as a matcher member
rather than a distinct kind. Rewrite the row at lines 85-96 to the mixed-retention
expectation in `<behavior>` and retitle it -- its current title and expectation
are the bug. In the single-token loop, replace the expected token expression
`token.includes("|") ? "mcp__server__tool" : token` with plain `token`: that
ternary encodes the removed whole-group behavior and no row in the list contains
a `|`. Add the four new rows from `<behavior>`.

Test titles state observable behavior and carry no planning references; `#217` is
an allowed anchor. Keep the existing arrange / act / assert comment structure and
one behavior per test, per `skills/typescript-unit-testing`.

**D. `tests/bridges/hooks/dispatch.test.ts` -- rename the projected field.**

Rename `piTools` to `toolNames` at lines 64 (the `ExecutorCall` projection type),
141 (the projection itself) and 425 and 457 (the two expected entries). No
expectation value changes: every entry there is built from `parseMatcher("Bash")`
or `parseMatcher("Read")`. Leave the test at line 1102 alone -- it drives dispatch
outcomes, not parsed kinds, and its `mcp__catalog__fetch` / `mcp__catalog__publish`
rows must stay green unedited as proof the fold preserved MCP dispatch.

**E. Never write the retired names into a comment or a test title.**

<!-- planner-discipline-allow: piTools -->
<!-- planner-discipline-allow: mcp-literal -->
Both names are grepped to zero by this task's own verify step and both appear
above, which is unavoidable: an instruction to rename a field has to name the
field being renamed. What the gate is protecting against is the executor copying
either name into a file it writes.

The strings `piTools` and `mcp-literal` are grepped to zero across `extensions/`
and `tests/` by this task's own gate (the `if-field` union is the one exemption,
and it is not edited here). A comment or test title that says "renamed from
`piTools`" or "folded the `mcp-literal` kind" would re-introduce the token AND
narrate code that no longer exists, which `skills/typescript-comments` forbids.
Describe only the current shape.

**F. Do not touch these, and treat a change in them as a stop signal.**

`tests/domain/components/hooks/partition.test.ts` (lines 49, 67-68) and
`tests/domain/plugin-resolver.test.ts` (lines 2274-2297) both assert a single-token
`MultiEdit` matcher drops with `cond:"unmapped-tool"`. They must pass UNEDITED. If
either needs an expectation changed, the rule was implemented wrong: stop, do not
edit the expectation, and report.

The `mcp-literal` string also names an arm of the unrelated `IfPredicate` union in
`bridges/hooks/if-field/index.ts`. Confirmed at planning time: that union,
`tests/bridges/hooks/if-field/index.test.ts`, `tests/bridges/hooks/settle.test.ts:614`,
`tests/architecture/hooks-if-field.test.ts:91` and
`docs/competitive-analysis/pi-plugins.md` all refer to it. None of them is in scope.
Re-confirm with the grep in `<verify>` before editing, then leave them untouched.

Commit the four files as ONE commit: `fix(hooks): degrade a pipe-OR tool matcher
per alternative`. Stage the four paths explicitly.
  </action>

  <verify>
    <automated>
cd /home/acolomba/src/pi-claude-marketplace-issue-217
SHAS=/tmp/claude-1000/-home-acolomba-src-pi-claude-marketplace-issue-217/4d22b5a2-ed1f-42fa-a06b-0b724c82f152/scratchpad/217-shas.env
# 1. The fold's blast radius is exactly the four in-scope files. Any other
#    ParsedMatcher-side hit is out of scope and must be reported, not edited.
grep -rn 'piTools' --include=*.ts extensions/ tests/ ; echo "grep piTools RC=$? (expect 1 / no matches)"
grep -rn 'mcp-literal' --include=*.ts extensions/ tests/ | grep -v 'if-field' | grep -v 'settle.test.ts' | grep -v 'hooks-if-field'
echo "grep residual mcp-literal RC=$? (expect 1 / no matches)"
# 2. Types, then the six suites that read parseMatcher, then the two that must
#    pass unedited.
npm run typecheck ; TC=$?; echo "typecheck RC=$TC"
node --test \
  tests/domain/components/hooks/matcher.test.ts \
  tests/domain/components/hooks/partition.test.ts \
  tests/bridges/hooks/dispatch.test.ts \
  tests/bridges/hooks/event-router.test.ts \
  tests/bridges/hooks/settle.test.ts \
  tests/domain/plugin-resolver.test.ts ; NT=$?; echo "node --test RC=$NT"
# 3. Neither untouchable suite may appear in this commit. Pinned to the SHA you
#    recorded as FIX_SHA -- never HEAD~N.
. "$SHAS"; echo "FIX_SHA=$FIX_SHA"
git show --name-only --format= "$FIX_SHA" -- tests/domain/components/hooks/partition.test.ts tests/domain/plugin-resolver.test.ts
echo "untouchable-suite list above must be empty"
git show --name-only --format= "$FIX_SHA"
echo "the list above must be exactly the four in-scope files"
    </automated>
  </verify>

  <done>
`typecheck RC=0` and `node --test RC=0`. `grep piTools` and the residual
`mcp-literal` grep both report no matches in `extensions/` or `tests/` outside the
`if-field` union. `partition.test.ts` and `plugin-resolver.test.ts` are absent from
the diff. `tests/domain/components/hooks/matcher.test.ts` contains a row asserting
`Write|Edit|apply_patch` yields a tool-set of `write` and `edit`, and a row
asserting `apply_patch|MultiEdit` yields `{kind:"unmapped", token:"apply_patch"}`.
One commit exists on `features/issue-217` touching exactly the four files.
  </done>
</task>

<task type="auto">
  <name>Task 2: Correct the compatibility doc paragraph and add the changelog entry</name>

  <files>
docs/hooks-compatibility.md
CHANGELOG.md
  </files>

  <read_first>
`docs/hooks-compatibility.md` lines 92-108 (the `### Tool name mapping` section
and its closing paragraph at line 107) and `CHANGELOG.md` lines 1-14 (the
`## [Unreleased]` section, for voice).
  </read_first>

  <action>
**A. `docs/hooks-compatibility.md` -- replace the single paragraph at line 107.**

The paragraph makes two false claims: that a pipe-OR matcher with any unmapped
alternative drops the whole group (the behavior Task 1 removes), and that any
`mcp__*` MCP server tool is unmapped (MCP matchers are supported, through the path
Task 1 folded into `tool-set`). Replace the whole paragraph. Edit that paragraph
and nothing else in the file.

The replacement must state, in this order:

1. Which Claude tools have no Pi analog: `MultiEdit`, `NotebookEdit`, `WebFetch`,
   `WebSearch`, `Task`, `TodoWrite`, `KillShell`, `BashOutput`. The `mcp__*`
   clause is deleted from this list.
2. An `mcp__<server>__<tool>` matcher IS supported and matches that MCP tool by
   exact name.
3. A tool with no Pi analog is dropped from its matcher's alternative list, and the
   remaining alternatives keep working. Use `Edit|Write|MultiEdit` as the worked
   example: it still runs on `Edit` and `Write`.
4. Only a matcher left with no supported alternative drops the group; that plugin
   then resolves `(partially-available)` under the single aggregate
   `{unsupported hooks}` brace. Use a matcher of `MultiEdit` alone as the example.
5. Matcher compatibility is not payload compatibility: a hook matched on a Pi tool
   receives THAT tool's Claude-form payload. A matcher of `Write|Edit|apply_patch`
   runs on Pi `write` and `edit` and hands the script the `Write` or `Edit` payload,
   so a script written for another agent's similarly-named tool is responsible for
   the input it gets.

Style for this file: plain English for plugin authors, Claude Code's own field
names, `--` for prose dashes. NO internal jargon -- no requirement IDs, no
`TOOL-02`, no bucket letters, no phase or plan reference, and no `tests/...` path
citation (`tests/architecture/no-stale-test-citations.test.ts` polices `docs/**`
for those). The paragraph's closing parenthetical names a specific third-party
plugin and asserts what it resolves to. Drop that parenthetical entirely and do
not name any third-party plugin in the replacement: the claim depended on the
whole-group drop, and nothing here re-measures what that plugin resolves to now.
The verify step greps the plugin's name to zero, so reproducing it fails the gate.

Leave the `## if field` table untouched. Its `MultiEdit(...)` / `NotebookEdit(...)`
"falls open" row describes the `if` compiler, a different mechanism this change
does not touch.

**B. `CHANGELOG.md` -- one bullet under `## [Unreleased]`.**

Add one top-level bullet in the voice of the surrounding entries: user-facing,
present tense, states the new behavior rather than the diff. It must say that a
hook matcher listing several tools now keeps the tools Pi supports instead of
dropping the whole matcher, that a matcher with no supported tool left still drops,
and it must credit the reporter and the issue: end the bullet with
`Thanks to @fank, who reported #217. (#217)`. Do NOT bump any version -- no
`package.json`, no `package-lock.json`, no `EXTENSION_VERSION`, no
`sonar-project.properties`. The release process owns the bump.

Commit both files as ONE commit: `docs(hooks): state per-alternative matcher
degradation`. Stage the two paths explicitly.
  </action>

  <verify>
    <automated>
cd /home/acolomba/src/pi-claude-marketplace-issue-217
SCRATCH=/tmp/claude-1000/-home-acolomba-src-pi-claude-marketplace-issue-217/4d22b5a2-ed1f-42fa-a06b-0b724c82f152/scratchpad
SHAS="$SCRATCH"/217-shas.env
mkdir -p "$SCRATCH"
# The three retired claims are gone from the compatibility doc. Each count was
# measured non-zero at planning time, so a zero here is a real removal.
grep -c 'drops the whole matcher group' docs/hooks-compatibility.md
echo "whole-group claim count must be 0 (was 1)"
grep -c 'security-guidance' docs/hooks-compatibility.md
echo "third-party-plugin claim count must be 0 (was 1)"
grep -c 'and any `mcp__\*` MCP server tool' docs/hooks-compatibility.md
echo "stale mcp-unsupported clause count must be 0 (was 1)"
# The replacement carries the new content, inside the tool-name-mapping section
# rather than anywhere in the file. `apply_patch` was absent from this file at
# planning time, so this count is not satisfiable by the pre-edit text.
awk '/^### Tool name mapping$/{f=1} f&&/^## /{exit} f' docs/hooks-compatibility.md > "$SCRATCH"/toolmap.txt
grep -c 'apply_patch' "$SCRATCH"/toolmap.txt
echo "apply_patch mentions in the tool-name-mapping section must be at least 1 (was 0)"
grep -c 'Edit|Write|MultiEdit' "$SCRATCH"/toolmap.txt
echo "the worked keep-working example must still be present (at least 1)"
grep -c 'Thanks to @fank, who reported #217' CHANGELOG.md
echo "changelog credit count must be 1"
# The doc gates that actually rewrite these files.
pre-commit run --files docs/hooks-compatibility.md CHANGELOG.md ; PC=$?; echo "pre-commit scoped RC=$PC"
git status --short docs/hooks-compatibility.md CHANGELOG.md
echo "a non-empty status here means a hook rewrote a file -- follow-up commit, never amend"
# No version file moved. Pinned to the SHA you recorded as DOC_SHA.
. "$SHAS"; echo "DOC_SHA=$DOC_SHA"
git show --name-only --format= "$DOC_SHA" -- package.json package-lock.json sonar-project.properties extensions/pi-claude-marketplace/shared/extension-version.ts
echo "version-file list above must be empty"
    </automated>
  </verify>

  <done>
`docs/hooks-compatibility.md` no longer contains `drops the whole matcher group`,
`security-guidance`, or the `and any mcp__* MCP server tool` clause. Inside the
`### Tool name mapping` section the replacement mentions `apply_patch` at least
once (it was absent from the whole file before this task) and still names
`Edit|Write|MultiEdit` as a matcher that keeps working.
`CHANGELOG.md` carries one new `## [Unreleased]` bullet ending
`Thanks to @fank, who reported #217. (#217)`. The scoped `pre-commit` run exits 0
and `git status` for the two files is clean (or a follow-up commit made it clean).
No version file appears in the commit.
  </done>
</task>

<task type="auto">
  <name>Task 3: Run the full gate chain and the per-module coverage check</name>

  <files>
(no edits expected; any file this task changes is a gate repair, committed separately)
  </files>

  <action>
Run the three gates below and report each one's real exit code. Do not infer a
verdict from a glyph or from a piped command's status.

1. `npm run check` -- the full chain: typecheck, lint, workflow lint, fallow,
   format:check, corresponding-tests, direct-coverage negative controls,
   `test:coverage:unit` (100% line / function / branch over `extensions/**`),
   integration, type-members. Write it to a log and capture the exit code into the
   log BEFORE reading anything, then read the log link by link. Two traps this
   chain has produced here before: `format:check` sits mid-chain and its failure
   hides every later link, and `fallow` prints `✗` on health and dupes while
   exiting 0, so `0 above threshold` is the verdict rather than the glyph.
2. `npm run test:coverage:direct -- <path>` once for each changed production module.
   The script takes one source or test path per invocation. Neither module has a
   coverage pin, so both must report 100%.
3. `SKIP=trufflehog pre-commit run --all-files`. CI runs `--all-files`, so a scoped
   `--files` run is not sufficient evidence. TruffleHog always fails inside a git
   worktree; skipping it is expected and is the only permitted skip.

If `test:coverage:unit` or `test:coverage:direct` reports an uncovered branch in
`matcher.ts`, add the public-behavior test row that reaches it -- never a coverage
suppression directive, and never a coverage pin. If the uncovered branch cannot be
reached by any input, the branch is unreachable by construction: remove it and
report which shape you replaced it with.

**Runtime budget.** `npm run check` runs 7000+ unit tests plus integration, and
`pre-commit run --all-files` has taken about nine minutes in this repository. Both
exceed a default Bash timeout. Give each the maximum foreground timeout
(`timeout: 600000`), or run it in the background and poll the log. Do NOT shorten
either run, and do NOT substitute a scoped run for the `--all-files` one.

If any gate rewrites a tracked file, commit the rewrite as its own follow-up
commit (`style: apply pre-commit formatting`) with explicit paths. Never amend.
Never stage `.claude/settings.json`, `.codex/config.toml` or `.mcp.json`.
  </action>

  <verify>
    <automated>
cd /home/acolomba/src/pi-claude-marketplace-issue-217
SHAS=/tmp/claude-1000/-home-acolomba-src-pi-claude-marketplace-issue-217/4d22b5a2-ed1f-42fa-a06b-0b724c82f152/scratchpad/217-shas.env
LOG=/tmp/claude-1000/-home-acolomba-src-pi-claude-marketplace-issue-217/4d22b5a2-ed1f-42fa-a06b-0b724c82f152/scratchpad/check-217.log
mkdir -p "$(dirname "$LOG")"
npm run check > "$LOG" 2>&1 ; CHECK_RC=$?; echo "CHECK_RC=$CHECK_RC" >> "$LOG"; echo "CHECK_RC=$CHECK_RC"
grep -n 'CHECK_RC=\|above threshold\|error\|failing\|fail ' "$LOG" | tail -40
npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts ; M_RC=$?; echo "coverage matcher.ts RC=$M_RC"
npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts ; D_RC=$?; echo "coverage dispatch.ts RC=$D_RC"
SKIP=trufflehog pre-commit run --all-files ; PC_RC=$?; echo "pre-commit --all-files RC=$PC_RC"
git status --short ; echo "only the pre-existing .claude/settings.json, .codex/config.toml and .mcp.json entries are allowed here"
# Pinned range from the SHA recorded before the first edit -- never HEAD~N.
. "$SHAS"; git log --oneline "$BASE_SHA"..HEAD ; echo "every commit above must be one of yours"
    </automated>
  </verify>

  <done>
`CHECK_RC=0`, `coverage matcher.ts RC=0`, `coverage dispatch.ts RC=0` and
`pre-commit --all-files RC=0` (with only TruffleHog skipped) are all reported with
their captured values. `git status --short` shows no tracked change beyond the
three pre-existing unrelated entries. Both per-module coverage runs report 100%
with no suppression directive and no coverage pin added.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| plugin `hooks/hooks.json` -> `parseMatcher` | A third-party plugin author's matcher string is untrusted input that decides whether a hook command runs on a given tool call. |
| `parseMatcher` -> `matcherFiresOnToolEvent` | The parsed set decides hook execution for a runtime tool event. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-217-01 | Elevation of Privilege | `parseMatcher` widening | high | mitigate | Only two alternative shapes may join `toolNames`: an exact key of `CLAUDE_TO_PI_TOOL_NAMES`, or a string `isMcpLiteral` accepts. No wildcard, no prefix, no regex, no verbatim retention of a non-MCP foreign literal. The `SAFE_MATCHER_CHARS` gate keeps its position ahead of the split, so no `RegExp` is ever built from plugin input (MATCH-02). Verified by the unchanged `regex` rows at `matcher.test.ts` lines 124-149. |
| T-217-02 | Spoofing | foreign literal kept verbatim | high | mitigate | A non-MCP foreign alternative is DISCARDED, not kept. Keeping `apply_patch` verbatim would let a plugin register a matcher that fires on a future Pi tool of that name without review. Verified by the `apply_patch|MultiEdit` -> `unmapped` row. |
| T-217-03 | Repudiation | lost degradation signal | medium | mitigate | A wholly foreign matcher still returns `unmapped`, so the `unmapped-tool` drop cond and the `{unsupported hooks}` render still reach the user. Verified by `partition.test.ts` and `plugin-resolver.test.ts` passing UNEDITED. |
| T-217-04 | Tampering | silent scope creep in the fold | low | accept | The `mcp-literal` rename touches only a type member name and one dispatch arm; the pre-edit grep in Task 1 bounds the surface, and `lint:type-members` fails a member with no reader. |
| T-217-SC | Tampering | npm/pip/cargo installs | n/a | accept | No package install in this change. No `package.json` dependency is added or moved, so no package-legitimacy audit is required. |
</threat_model>

<verification>
- Every matcher-parse row in `tests/domain/components/hooks/matcher.test.ts` passes,
  including the flipped MCP rows and the four new mixed-retention / no-survivor rows.
- `tests/domain/components/hooks/partition.test.ts` and
  `tests/domain/plugin-resolver.test.ts` pass with no edit, proving the
  `unmapped-tool` degradation path survived.
- `tests/bridges/hooks/dispatch.test.ts` passes, including the unedited
  `mcp__catalog__fetch` / `mcp__catalog__publish` dispatch rows, proving MCP matcher
  dispatch survived the fold.
- `npm run check` exit 0 with its code captured, not inferred.
- `npm run test:coverage:direct` 100% for `matcher.ts` and for `dispatch.ts`.
- `SKIP=trufflehog pre-commit run --all-files` exit 0.
- `git status --short` clean apart from the three pre-existing unrelated entries;
  HEAD is on `features/issue-217` and no commit was amended.
</verification>

<success_criteria>
- A `PreToolUse` group whose matcher is `Write|Edit|apply_patch` is retained and
  fires on Pi `write` and `edit`.
- A group whose matcher is `MultiEdit` alone, `apply_patch` alone, or
  `apply_patch|MultiEdit` still drops with `cond:"unmapped-tool"` and still renders
  `(partially-available) {unsupported hooks}`.
- `ParsedMatcher` has four arms; `mcp-literal` is gone and `matcherFiresOnToolEvent`
  carries no type assertion.
- `docs/hooks-compatibility.md` describes per-alternative dropping, states that
  `mcp__<server>__<tool>` matchers are supported, and distinguishes matcher
  compatibility from payload compatibility.
- `CHANGELOG.md` carries one `## [Unreleased]` bullet crediting @fank and #217, with
  no version bump.
- Two or three commits on `features/issue-217`, each atomic, none amended; no file
  outside the six in `files_modified` is changed except a formatting rewrite
  committed on its own.
</success_criteria>

<output>
Create `.planning/workstreams/workflows/quick/260925-ucm-fix-217-hook-matcher-pipe-or-degrades-pe/260925-ucm-SUMMARY.md` when done.

Report in it: the captured `npm run check` exit code and unit/integration counts,
both `test:coverage:direct` percentages, the `pre-commit --all-files` exit code and
the single skipped hook, the commit SHAs, and -- if any gate rewrote a file -- which
file and which follow-up commit repaired it.
</output>
