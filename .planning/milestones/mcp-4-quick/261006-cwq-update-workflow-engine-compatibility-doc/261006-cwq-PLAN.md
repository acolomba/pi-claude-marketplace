---
phase: 261006-cwq
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/pi.sh
  - docs/workflows-compatibility.md
  - CHANGELOG.md
autonomous: true
requirements: [CWQ-01, CWQ-02, CWQ-03, CWQ-04]

estimate:
  tokens: 45000
  raw_tokens: 45000
  tasks: 1
  confidence: low

must_haves:
  truths:
    - "CWQ-01: scripts/pi.sh pins @quintinshaw/pi-dynamic-workflows@3.13.1, a published release with SLSA provenance, keeps the other two companion pins, still parses, and exits 0 on --help. Its comment says 3.13.1 includes engine PRs #233 and #234, that no grade in docs/workflows-compatibility.md names 3.13.1, and that the pin must not move to a release with engine PR #238 until the bridge follows it, because --home sets PI_CODING_AGENT_DIR (WPTH-04)."
    - "CWQ-02: docs/workflows-compatibility.md explains the 3.13.0 child-tool failure, says engine 3.13.1 creates child sessions through the host Pi (engine pull request #233) and that no run recorded there used 3.13.1, and keeps Pi 0.86.1 as the minimum because the 2026-09-23 run tested that version. The peer bullet names 3.13.1 beside 3.13.0."
    - "CWQ-02: the guide names one remaining 3.13.1 limit, result delivery under --no-extensions -e, with engine pull request #232 on the engine's main branch and in no release as of 2026-10-06. The status-label limit is gone."
    - "CWQ-02: the guide warns that engine pull request #238 stores workflows under $PI_CODING_AGENT_DIR/workflows when that variable is set, that this bridge derives the storage root from the home directory alone (WPTH-04), and that users leave PI_CODING_AGENT_DIR unset with such a release until the bridge follows the same rule."
    - "CWQ-02 and CWQ-04: no grade in the guide names 3.13.1, the number of `at 3.13.0` phrases equals the count at 16267383, everything before `## Host engine requirements` and from `## Install-time disposition` on is byte-identical to 16267383, and tests/live-uat keeps every grade-reproducing 3.13.0 pin."
    - "CWQ-03: CHANGELOG.md waits only for engine fix #232, and its Pi 0.86.1 bullet makes no child-tool claim. README.md and README.es.md are unchanged."
    - "Exactly one Conventional Commit, `docs(workflows): pin engine 3.13.1 and update compatibility notes`, changes exactly scripts/pi.sh, docs/workflows-compatibility.md, and CHANGELOG.md. No staged file is a build input, so the commit hook skips npm-check and the task needs no `npm run check`."
  artifacts:
    - path: "scripts/pi.sh"
      provides: "Engine pin 3.13.1 and the comment that says why, what no grade covers, and when the pin must hold"
      contains: '"@quintinshaw/pi-dynamic-workflows@3.13.1"'
    - path: "docs/workflows-compatibility.md"
      provides: "3.13.1 rationale for the Pi minimum, the one remaining engine limit, and the storage-override warning"
      contains: "Engine 3.13.1 keeps one known limit from 3.13.0."
    - path: "CHANGELOG.md"
      provides: "Release wait narrowed to the unreleased engine fix and a Pi requirement bullet with no child-tool claim"
      contains: "Release waits for `pi-dynamic-workflows` fix [#232]"
  key_links:
    - from: "scripts/pi.sh engine pin comment"
      to: "docs/workflows-compatibility.md evidence grades"
      via: "the comment states that no grade names the pinned version, so nobody aligns the grade-reproducing live-UAT pins with the launcher pin"
      pattern: "No grade in docs/workflows-compatibility.md names 3.13.1."
    - from: "docs/workflows-compatibility.md storage-override paragraph"
      to: "extensions/pi-claude-marketplace/platform/workflow-home.ts"
      via: "the paragraph cites WPTH-04, the rule workflowHomeDir implements by reading os.homedir() only"
      pattern: "(WPTH-04)"
    - from: "CHANGELOG.md release-wait sub-bullet"
      to: "docs/workflows-compatibility.md remaining-limit paragraph"
      via: "both name engine pull request #232 as the one unreleased fix"
      pattern: "pi-dynamic-workflows/pull/232"
---

# Update workflow-engine compatibility docs and pins after pi-dynamic-workflows 3.13.1

<objective>
Bring the launcher pin, the workflow compatibility guide, and the changelog in line with engine release 3.13.1, without upgrading any evidence grade and without touching source or test code.

Purpose: `@quintinshaw/pi-dynamic-workflows` 3.13.1 (published 2026-09-29) includes engine pull requests #233 (child sessions use the host Pi) and #234 (status label of a completed run). The guide still gives the old reason for the Pi 0.86.1 minimum, still lists the status-label limit, and says nothing about engine pull request #238, which moves the engine's storage under `PI_CODING_AGENT_DIR` in its next release while this bridge keeps the home-directory root (WPTH-04). The changelog still waits for #233 and #234.

Output: one tracer task and one commit.

- `scripts/pi.sh` pins engine 3.13.1. Its comment says what 3.13.1 includes, that no grade names 3.13.1, and why the pin holds below the release with #238.
- `docs/workflows-compatibility.md` gets four edits in the Host engine requirements and Upstream stability sections.
- `CHANGELOG.md` gets two one-line edits.
</objective>

## Requirement map

CWQ-01 to CWQ-04 are this task's own labels. Never cite CWQ-NN in docs, code comments, or commit messages.

| ID     | Source (task scope)                               | Outcome                                                                                                                                                       | Edits               |
| ------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| CWQ-01 | Scope 1: launcher pin and comment                 | `scripts/pi.sh` pins 3.13.1 and states honestly what the pin is and is not graded for                                                                        | TXT-1, TXT-2        |
| CWQ-02 | Scope 3: compatibility guide                      | New minimum rationale, one remaining limit with #232, the #238 storage warning, 3.13.1 in the peer bullet, engine links in the `pull/NNN` URL form            | TXT-3 to TXT-6      |
| CWQ-03 | Scope 4: changelog and READMEs                    | Release wait narrowed to #232; the Pi bullet makes no child-tool claim; both READMEs stay unchanged                                                          | TXT-7, TXT-8        |
| CWQ-04 | Scope 2: live-UAT README and storage canary       | Every engine version there reproduces a published grade, so nothing changes; the verify pins that                                                            | none (verified)     |

## Scope rule

Edit only the eight TXT sites below. Do not edit `tests/live-uat/README.md`, `tests/live-uat/workflow-storage-canary.mjs`, `tests/live-uat/workflow-agent-failure-canary.mjs`, `README.md`, `README.es.md`, `package.json`, `package-lock.json`, or `extensions/pi-claude-marketplace/platform/workflow-home.ts`. Do not change any other sentence of the three target files, even when it looks stale. The section "Out-of-scope observations" lists what planning found; copy it into the SUMMARY.

## Findings verified during planning

Planning ran on 2026-10-06 against HEAD 16267383 (`162673835d542d9982dfe97520d10d431582ca52`), a clean tree on branch `features/workflows-refine` in the worktree `pi-claude-marketplace-workflows-refine`, with Node v26.10.0 and npm 11.19.1.

1. **Registry facts, read with `npm view` on 2026-10-06.** The `latest` dist-tag is 3.13.1, published 2026-09-29T04:05:43Z. Its peers are `@earendil-works/pi-coding-agent >=0.80.8`, `@earendil-works/pi-tui >=0.80.6`, and `typebox *`, the same as 3.13.0. Its only dependency is `acorn ^8.16.0`, the same as 3.13.0. Both releases were published by GitHub Actions with an SLSA v1 provenance attestation from `QuintinShaw/pi-dynamic-workflows`, maintainer `quintinshaw`, and neither declares a `preinstall`, `install`, `postinstall`, or `prepare` script.
2. **Engine pull request facts come from the task scope and were not re-derived.** #233 and #234 are in 3.13.1. #232 merged to the engine's main branch on 2026-10-06 and #238 on 2026-10-05; no release includes either. With #238, `workflowHomeDir()` returns `join(getAgentDir(), "workflows")` when `PI_CODING_AGENT_DIR` is set, and `~/.pi/workflows` otherwise.
3. **The child-tool mechanism comes from this repository's own debug record**, `.planning/milestones/ws-workflows-2026-09-27/debug/resolved/openai-workflow-child-tools.md`. Engine 3.13.0 gives the host Pi's model runtime to a child session that its own Pi dependency created. Pi 0.85.1 sends tools in `context.tools`, and Pi 0.86.1 and 0.87.0 declare them in transcript system messages, so a 0.85.1 host with a 0.87.0 engine dependency sent no tools. TXT-4 states only this mechanism, in plain words.
4. **Engine version occurrences.** `git grep -n '3\.13\.0\|3\.13\.1' -- ':!.planning' ':!package-lock.json'` finds them only in `scripts/pi.sh` (lines 95 and 100), `tests/live-uat/workflow-storage-canary.mjs:17`, `tests/live-uat/README.md` (lines 69, 79, 117-128, 147, and 182-196), and `docs/workflows-compatibility.md`. `tests/live-uat/workflow-agent-failure-canary.mjs:21` pins 3.10.1.
5. **Per-occurrence decision for the live-UAT files (CWQ-04).** Lines 69 and 79 reproduce the agent-failure grade, which the guide publishes as runtime-measured at 3.10.1 and at 3.13.0. Line 147 and the canary's line-17 install hint reproduce the storage grade, runtime-measured at 3.13.0. Lines 117-128 and 182-196 are observed transcripts at 3.13.0. Line 73 compares the private prefix of `scripts/pi.sh` with the scratch install and names no version. No occurrence describes the launcher pin, so none changes. The verify requires three `pi-dynamic-workflows@3.13.0` lines in the README and one in the storage canary.
6. **READMEs.** `README.md:38` and `README.es.md:38` state only "0.86.1 or newer" and "0.86.1 o posterior". Neither ties the Pi version to child tools, so neither changes.
7. **Build inputs.** `scripts/pi.sh`, `CHANGELOG.md`, and `docs/workflows-compatibility.md` do not match the `npm-check` `files:` pattern in `.pre-commit-config.yaml` or the `build_inputs` list in `.github/workflows/ci.yml`. Every path under `tests/` does. So the commit hook skips `npm-check`, and the local-verification rule that a quick task committing a build input runs `npm run check` does not apply. Editing a live-UAT file would have made this a build-input commit.
8. **Hooks that apply.** For the two Markdown files: mdformat (`.mdformat.toml` sets `wrap = "no"`), markdownlint-cli2, the texthooks fixers (smart quotes, Unicode dashes, ligatures, irregular spaces, bidi controls), whitespace, end of file, and TruffleHog. For `scripts/pi.sh`: the same text hooks plus the shebang and executable checks. No shell linter runs.
9. **Vocabulary.** `docs/workflows-compatibility.md` uses "upstream" for Claude Code ("Upstream REPLACES"), so the new text says "engine pull request". This repository has its own PRs #233, #234, and #238, so the commit body names no engine PR number (GitHub would link a bare number to this repository), and the `scripts/pi.sh` comment says "engine PR".
10. **Changelog provenance.** `git log -S` shows that the Pi 0.86.1 bullet and the release-wait sub-bullet both came from PR #205 (5c652697). The Pi bullet carries no PR number.
11. **Anchors.** Each anchor named in "Exact text" occurs exactly once in its file at 16267383.
12. **Dry run.** All eight TXT edits were applied to copies of the three files in a throwaway git repository. Each anchor matched once. `SKIP=npm-check,prettier pre-commit run --files` over the three files passed and rewrote nothing. The task's `<verify>` passed in zsh and in bash, both before and after a scratch commit with the TXT-9 message, and it fails on the unedited copies. POST-1 passed in both shells after that commit, and the repository's gitlint hook accepted the TXT-9 message. `git diff --numstat` gave CHANGELOG.md 2/2, the guide 7/3, and `scripts/pi.sh` 7/3. Every new sentence has 21 words or fewer, and no new paragraph has more than six sentences.
13. **Fallow.** On the clean tree, `npx fallow audit --base HEAD --format json --quiet` returned verdict `pass` in about one second with fallow 3.30.0. Fallow analyzes no `.md` or `.sh` file.

## Choices made

- **One task, one commit.** The task scope requires one commit, and the quick executor commits once per task. So the plan has a single tracer task that carries all three files through the hooks into one commit.
- **The live-UAT files stay unchanged (CWQ-04).** Every engine version there reproduces a published grade. The `scripts/pi.sh` comment carries the fact that no grade names 3.13.1, so nobody aligns those pins with the launcher pin.
- **The changelog Pi bullet keeps only its first sentence.** `.claude/rules/changelog.md` allows a second sentence only for a reader action and puts rationale in the commit body. A sentence such as "child tools work with engine 3.13.1 or later" would also read as excluding 3.13.0, but the 2026-09-23 run in the guide shows child tools with 3.13.0 on Pi 0.86.1. The guide carries the full explanation.
- **The status-label limit is dropped, not reworded**, as the scope says. The guide says 3.13.1 "keeps one known limit from 3.13.0", and the `scripts/pi.sh` comment names #234.
- **Two planner additions; veto either one by deleting its TXT text.** TXT-3 names 3.13.1 in the peer bullet, from the registry facts above, because the rewritten rationale points readers at 3.13.1. The last two sentences of TXT-1 hold the pin below the release with #238, because `--home` sets `PI_CODING_AGENT_DIR` and that release would split the engine's storage root from the bridge's.
- **The provenance paragraph (line 7) and the grade list stay unchanged.** Each new claim states its source in place: an engine pull request link, the package metadata, and "no run recorded here used engine 3.13.1". The Host engine requirements section already does this for its package-metadata and live-run claims. No grade moves to 3.13.1.
- **The Pi minimum stays 0.86.1.** `package.json` does not change.
- **Verification.** No `npm run check` runs, because no build input changes. The SUMMARY records: focused task verification passed; no build input changed, so the hook skipped npm-check and no full check is required.

<execution_context>
@.claude/gsd-core/workflows/execute-plan.md
@.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@skills/local-verification/SKILL.md
@.claude/rules/changelog.md

Rules that apply to the task:

1. Read each target region before you edit it. Every edit is an exact text replacement or insertion from "Exact text" below. Find each site by its anchor text, not by line number.
2. Apply each TXT block verbatim. The planner wrote them under the `simple-english` skill (Plain mode) and the `humanizer` skill, and the verify runs the mechanical self-check over every added line. Do not reword them. Each Markdown paragraph and bullet is one physical line. Keep the indentation shown.
3. Stage explicit paths only, never `git add -A`, because the operator may edit files in this checkout during the run. Never revert a file with `git checkout --`. Never use `--no-verify`, never amend, never rebase, and never commit to `main`.
4. Run `SKIP=npm-check pre-commit run --files ...` in the foreground with a 600000 ms timeout. Never pipe it and never poll it. Do not run ESLint, type checking, or tests before the commit.
5. Write the commit message with the Write tool into a file in your session scratchpad and commit with `git commit -F <file>`, because backticks in `-m` execute in this shell. TXT-9 overrides the executor's default `{type}({phase}-{plan})` message: AGENTS.md forbids milestone, phase, plan, and quick-task references in commit messages.
6. Run the `<verify>` and POST-1 commands as written. They run unchanged in bash and in zsh, and they need the commit 16267383 in the object store, which every worktree of this repository shares.
</context>

## Exact text

Each item names the file, how to find the site, and the operation. NEW text goes in exactly as shown.

### TXT-1: `scripts/pi.sh` pin comment, 6 lines for 2

Inside the comment above `pi_cm_pins=(`, keep the first line, `# Companion extensions, pinned here only -- never in package.json or`. Replace the two lines after it, the one that begins `# package-lock.json (NFR-5, D-98-10).` and the one that is `# docs/workflows-compatibility.md grades.`, with these six lines:

```text
# package-lock.json (NFR-5, D-98-10). Engine 3.13.1 includes engine PRs
# #233 (child sessions use the host Pi) and #234 (completed-run status).
# No grade in docs/workflows-compatibility.md names 3.13.1. Do not move
# this pin to a release with engine PR #238 until the bridge follows it.
# That release stores workflows under PI_CODING_AGENT_DIR, which --home
# sets, and the bridge ignores that variable for workflows (WPTH-04).
```

### TXT-2: `scripts/pi.sh` engine pin, 1 line for 1

Same file. Replace the third entry of the `pi_cm_pins` array, the `@quintinshaw/pi-dynamic-workflows` entry, with this line. Keep its two leading spaces. Leave the `pi-mcp-adapter@2.37.0` and `pi-subagents@0.71.0` entries unchanged.

```text
  "@quintinshaw/pi-dynamic-workflows@3.13.1"
```

### TXT-3: guide peer bullet, 1 line for 1

File `docs/workflows-compatibility.md`, section `## Host engine requirements`. Replace the whole bullet line that begins ``- `@quintinshaw/pi-dynamic-workflows` 3.13.0 peers on`` with:

```text
- `@quintinshaw/pi-dynamic-workflows` 3.13.0 and 3.13.1 peer on `@earendil-works/pi-coding-agent >=0.80.8` and `@earendil-works/pi-tui >=0.80.6`. The published package metadata of both releases states these minimum versions, and 3.10.1 declared the same ones.
```

### TXT-4: guide minimum-version rationale, 2 paragraphs for 1

Same section. Replace the whole paragraph that begins `The marketplace requires the higher Pi version` with these two paragraphs and the one blank line between them. Keep the blank line after the second paragraph, before the paragraph that begins `On 2026-09-23, a saved workflow`, which stays unchanged.

```text
The marketplace raised its minimum Pi version to 0.86.1 because of a child-tool failure in engine 3.13.0. Each `agent()` call starts a child session. Engine 3.13.0 creates that session with its own Pi dependency, and the host Pi sends the session's requests to the model. In the tested pairing, Pi 0.85.1 hosted an engine with a Pi 0.87.0 dependency. These two Pi versions use different tool formats, so the child sessions received no tools. Pi 0.86.1 passed the same OpenAI tool test with the same engine.

Engine 3.13.1 creates each child session through the host Pi instead (engine pull request [#233](https://github.com/QuintinShaw/pi-dynamic-workflows/pull/233)). The session and its model requests then come from the same Pi, so their tool formats always match. The pull request states this, and no run recorded here used engine 3.13.1. The minimum stays at 0.86.1 because the 2026-09-23 run below tested that version. Lowering it needs a new run with an older Pi. Install Pi 0.86.1 or a newer version before you install this extension.
```

### TXT-5: guide remaining-limit paragraph, 1 line for 1

Same section. Replace the whole paragraph that begins `Engine 3.13.0 still has` with:

```text
Engine 3.13.1 keeps one known limit from 3.13.0. If you launch Pi with `--no-extensions -e` to load the engine explicitly, the engine can leave result delivery pending. Load it through Pi's normal package discovery. As of 2026-10-06, engine pull request [#232](https://github.com/QuintinShaw/pi-dynamic-workflows/pull/232) fixes this on the engine's main branch, and no release includes it.
```

### TXT-6: guide storage-override paragraph, inserted

Same file, section `## Upstream stability`. Find the list under `Specifically, at 3.10.1 and unchanged at 3.13.0:`. Its last bullet begins ``- The engine depends on `acorn ^8.16.0` ``. Insert this paragraph after that bullet and before `## Install-time disposition`, with one blank line before it and one blank line after it. Change no bullet.

```text
Engine pull request [#238](https://github.com/QuintinShaw/pi-dynamic-workflows/pull/238) adds an environment-variable override for the storage root. As of 2026-10-06, it is on the engine's main branch, and no release includes it. With that change, the engine stores workflows under `$PI_CODING_AGENT_DIR/workflows` when `PI_CODING_AGENT_DIR` is set. This bridge still derives the storage root from the home directory alone (WPTH-04). If you install an engine release that includes #238, leave `PI_CODING_AGENT_DIR` unset until this bridge follows the same rule. Otherwise, the engine does not find the workflows that this extension installs.
```

### TXT-7: changelog Pi bullet, 1 line for 1

File `CHANGELOG.md`, under `## [Unreleased]`. Replace the whole top-level bullet line that begins `- Pi Coding Agent 0.86.1 is now required.` with:

```text
- Pi Coding Agent 0.86.1 is now required.
```

### TXT-8: changelog release-wait sub-bullet, 1 line for 1

Same file, inside the workflow entry that ends `(#205)`. Replace the whole sub-bullet line that begins `  - Release waits for` with this line. Keep its two leading spaces.

```text
  - Release waits for `pi-dynamic-workflows` fix [#232](https://github.com/QuintinShaw/pi-dynamic-workflows/pull/232).
```

### TXT-9: commit message

Title, 65 characters:

```text
docs(workflows): pin engine 3.13.1 and update compatibility notes
```

Body. Put one blank line between the title and the body, then add one blank line and the attribution trailer that your environment specifies after the body:

```text
scripts/pi.sh now pins @quintinshaw/pi-dynamic-workflows 3.13.1. That
release creates workflow child sessions through the host Pi and fixes
the status label of a completed run.

The compatibility guide explains the child-tool failure in engine 3.13.0
and keeps Pi 0.86.1 as the minimum, because a run tested that version.
It drops the fixed status-label limit and keeps the result delivery
limit of --no-extensions -e. It also warns that an unreleased engine
change moves workflow storage under PI_CODING_AGENT_DIR, which this
bridge does not follow yet.

The changelog now waits only for the unreleased delivery fix.
```

### POST-1: post-commit check

Run after the commit. It must exit 0. It finds the task commit by its title, so a commit from another session cannot stand in for it. It checks that exactly one commit since 16267383 has that title, that the commit changes exactly the three files, that its message has no GSD reference, and that the touched paths are clean. Each `git` call is captured before use, so a failing `git` fails the check.

```text
CS="$(git log --format=%H --fixed-strings --grep='docs(workflows): pin engine 3.13.1 and update compatibility notes' 16267383..HEAD)" && [ -n "$CS" ] && [ "$(printf '%s\n' "$CS" | wc -l)" -eq 1 ] && FILES="$(git diff-tree --no-commit-id --name-only -r "$CS")" && [ "$(printf '%s\n' "$FILES" | sort | tr '\n' ' ')" = "CHANGELOG.md docs/workflows-compatibility.md scripts/pi.sh " ] && MSG="$(git log -1 --format=%B "$CS")" && ! printf '%s\n' "$MSG" | grep -qiE 'phase|milestone|quick|261006|cwq' && ST="$(git status --porcelain -- scripts/pi.sh docs/workflows-compatibility.md CHANGELOG.md tests/live-uat)" && [ -z "$ST" ]
```

<tasks>

<task type="tracer">
  <name>Task 1: Pin engine 3.13.1 and bring the guide and changelog in line with it, in one commit (CWQ-01, CWQ-02, CWQ-03, CWQ-04)</name>
  <files>scripts/pi.sh, docs/workflows-compatibility.md, CHANGELOG.md</files>
  <precondition>`git diff --quiet 16267383 HEAD -- scripts/pi.sh docs/workflows-compatibility.md CHANGELOG.md tests/live-uat` exits 0, `git status --porcelain -- scripts/pi.sh docs/workflows-compatibility.md CHANGELOG.md tests/live-uat` prints nothing, and `git rev-parse --abbrev-ref HEAD` does not print `main`.</precondition>
  <read_first>
    - scripts/pi.sh lines 90-102 (the pin comment and the `pi_cm_pins` array)
    - docs/workflows-compatibility.md lines 9-17 (the evidence grades and the rule that a source read is never presented as a measurement)
    - docs/workflows-compatibility.md lines 186-232 (Host engine requirements, then Upstream stability through the end of its list)
    - CHANGELOG.md lines 1-40
    - .claude/rules/changelog.md (whole file)
  </read_first>
  <action>
This is the whole change as one thin slice through every layer it touches: the launcher pin, the user guide, the release notes, the hooks, and one commit. The task scope requires exactly one commit, so no expansion task follows.

1. Run the precondition commands. If one fails, stop and report, because the TXT anchors were verified at 16267383.
2. Apply TXT-1 and TXT-2 to `scripts/pi.sh`, TXT-3 to TXT-6 to `docs/workflows-compatibility.md`, and TXT-7 and TXT-8 to `CHANGELOG.md`, exactly as given in "Exact text". Change nothing else in these files. Leave `tests/live-uat/` untouched, because its engine pins reproduce published grades (CWQ-04).
3. Run the `<verify>` command once. It must exit 0. Two of its checks read the npm registry with `npm view`. If the registry is unreachable, stop and report. Do not drop the check.
4. Run `SKIP=npm-check pre-commit run --files scripts/pi.sh docs/workflows-compatibility.md CHANGELOG.md` in the foreground with a 600000 ms timeout. The planning dry run passed it without a rewrite. If a fixer rewrites a file anyway, read the diff and run the command again until it exits 0. Then run `<verify>` again. If `<verify>` now fails, stop and report the fixer's change as a deviation.
5. Run `npx --no-install fallow audit --base HEAD --format json --quiet` and save its output to a file in your session scratchpad. Expect verdict `pass`, because fallow analyzes none of these files. The `--no-install` flag keeps npx from fetching an unpinned fallow. If fallow is not installed in this checkout, record that and continue.
6. Write TXT-9 into a message file in your session scratchpad with the Write tool, then add the attribution trailer. Stage the three files by path. Run `git commit -F <message file>` in the foreground with the longest available timeout. The commit hook skips `npm-check`, because no staged file is a build input. If a hook fails, the commit did not happen: fix the cause, restage, and commit again.
7. Run POST-1. It must exit 0. Then run `<verify>` again. It must still exit 0, because it compares against 16267383 and not against HEAD.
  </action>
  <verify>
    <automated>bash -n scripts/pi.sh && bash scripts/pi.sh --help >/dev/null && grep -qxF '  "@quintinshaw/pi-dynamic-workflows@3.13.1"' scripts/pi.sh && ! grep -qF 'pi-dynamic-workflows@3.13.0' scripts/pi.sh && grep -qxF '  "pi-mcp-adapter@2.37.0"' scripts/pi.sh && grep -qxF '  "pi-subagents@0.71.0"' scripts/pi.sh && grep -qF 'No grade in docs/workflows-compatibility.md names 3.13.1.' scripts/pi.sh && grep -qF 'which --home' scripts/pi.sh && grep -qF '(WPTH-04)' scripts/pi.sh && [ "$(npm view @quintinshaw/pi-dynamic-workflows@3.13.1 version)" = "3.13.1" ] && [ "$(npm view @quintinshaw/pi-dynamic-workflows@3.13.1 dist.attestations.provenance.predicateType)" = "https://slsa.dev/provenance/v1" ] && BASEDOC="$(git show 16267383:docs/workflows-compatibility.md)" && [ -n "$BASEDOC" ] && diff <(printf '%s\n' "$BASEDOC" | sed -n '1,/^## Host engine requirements$/p') <(sed -n '1,/^## Host engine requirements$/p' docs/workflows-compatibility.md) && diff <(printf '%s\n' "$BASEDOC" | sed -n '/^## Install-time disposition$/,$p') <(sed -n '/^## Install-time disposition$/,$p' docs/workflows-compatibility.md) && grep -qF '`@quintinshaw/pi-dynamic-workflows` 3.13.0 and 3.13.1 peer on' docs/workflows-compatibility.md && grep -qF 'The marketplace raised its minimum Pi version to 0.86.1 because of a child-tool failure in engine 3.13.0.' docs/workflows-compatibility.md && grep -qF 'Engine 3.13.1 creates each child session through the host Pi instead (engine pull request [#233](https://github.com/QuintinShaw/pi-dynamic-workflows/pull/233)).' docs/workflows-compatibility.md && grep -qF 'no run recorded here used engine 3.13.1.' docs/workflows-compatibility.md && grep -qF 'The minimum stays at 0.86.1 because the 2026-09-23 run below tested that version.' docs/workflows-compatibility.md && grep -qF 'Engine 3.13.1 keeps one known limit from 3.13.0.' docs/workflows-compatibility.md && grep -qF 'engine pull request [#232](https://github.com/QuintinShaw/pi-dynamic-workflows/pull/232) fixes this on the engine' docs/workflows-compatibility.md && grep -qF 'Engine pull request [#238](https://github.com/QuintinShaw/pi-dynamic-workflows/pull/238) adds an environment-variable override for the storage root.' docs/workflows-compatibility.md && grep -qF 'leave `PI_CODING_AGENT_DIR` unset until this bridge follows the same rule.' docs/workflows-compatibility.md && grep -qF 'On 2026-09-23, a saved workflow installed through this bridge ran with Pi 0.86.1 and the published engine 3.13.0.' docs/workflows-compatibility.md && grep -qF 'There is no environment-variable override and no settings knob to relocate that storage.' docs/workflows-compatibility.md && ! grep -qF 'two visible limits' docs/workflows-compatibility.md && ! grep -qF 'Workflow running' docs/workflows-compatibility.md && ! grep -qF 'because workflow children need their tools' docs/workflows-compatibility.md && ! grep -qF 'with the unpatched engine' docs/workflows-compatibility.md && ! grep -qE '(measured|source-read|unchanged|read) at 3\.13\.1' docs/workflows-compatibility.md && [ "$(printf '%s\n' "$BASEDOC" | grep -o 'at 3\.13\.0' | wc -l)" -eq "$(grep -o 'at 3\.13\.0' docs/workflows-compatibility.md | wc -l)" ] && grep -qxF -e '- Pi Coding Agent 0.86.1 is now required.' CHANGELOG.md && grep -qxF -e '  - Release waits for `pi-dynamic-workflows` fix [#232](https://github.com/QuintinShaw/pi-dynamic-workflows/pull/232).' CHANGELOG.md && ! grep -qF 'supports workflow child tools' CHANGELOG.md && ! grep -qF 'pi-dynamic-workflows/pull/233' CHANGELOG.md && ! grep -qF 'pi-dynamic-workflows/pull/234' CHANGELOG.md && NUMSTAT="$(git diff --numstat 16267383 -- CHANGELOG.md docs/workflows-compatibility.md scripts/pi.sh)" && [ "$(printf '%s\n' "$NUMSTAT" | cut -f1,2 | tr '\t\n' ': ')" = "2:2 7:3 7:3 " ] && git diff --check 16267383 -- CHANGELOG.md docs/workflows-compatibility.md scripts/pi.sh && git diff --quiet 16267383 -- tests/live-uat README.md README.es.md package.json && [ "$(grep -n 'pi-dynamic-workflows@3.13.0' tests/live-uat/README.md | cut -d: -f1 | tr '\n' ' ')" = "69 79 147 " ] && [ "$(grep -n 'pi-dynamic-workflows@3.13.0' tests/live-uat/workflow-storage-canary.mjs | cut -d: -f1 | tr '\n' ' ')" = "17 " ] && ADDED="$(git diff -U0 16267383 -- CHANGELOG.md docs/workflows-compatibility.md scripts/pi.sh)" && [ -n "$ADDED" ] && ! printf '%s\n' "$ADDED" | grep -E '^\+[^+]' | grep -qE ';|—|–|\b(should|would|may|might|could)\b|ha(s|ve) been|, [a-z]+ing\b|\*\*'</automated>
  </verify>
  <done>`scripts/pi.sh` pins engine 3.13.1, parses, and exits 0 on `--help`. Its comment states what 3.13.1 includes, that no grade names it, and why the pin holds below the release with engine PR #238. The guide carries the new minimum-version rationale, the one remaining limit with engine pull request #232, the #238 storage warning, and 3.13.1 in the peer bullet. Its other sections and its `at 3.13.0` grade count match 16267383. The changelog waits only for #232 and makes no child-tool claim. The live-UAT pins, both READMEs, and `package.json` are unchanged. One commit with the TXT-9 title holds exactly the three files, POST-1 exits 0, and `<verify>` exits 0 before and after the commit.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
| --- | --- |
| npm registry -> developer machine | `scripts/pi.sh` installs the pinned engine into a private npm prefix, with install scripts enabled, the first time a developer runs it after this change. |
| compatibility guide -> plugin users | The guide tells users which Pi and engine versions to run and when to leave `PI_CODING_AGENT_DIR` unset. A wrong claim makes users trust behavior nobody measured, or lose sight of installed workflows. |

## STRIDE Threat Register

ASVS level 1; blocking threshold `high`. No threat below is high.

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
| --- | --- | --- | --- | --- | --- |
| T-cwq-01 | Tampering | `scripts/pi.sh` engine pin 3.13.1 | medium | mitigate | Planning confirmed on 2026-10-06 that 3.13.1 comes from the same maintainer and repository as 3.13.0, through GitHub Actions with an SLSA v1 provenance attestation, with no install-time script, and with the same dependency and peers. The task's `<verify>` reads the version and the provenance predicate type from the registry again. The task itself installs nothing. |
| T-cwq-02 | Repudiation | guide claims about 3.13.1 and unreleased engine changes | low | mitigate | Each new claim names its source in place (an engine pull request link or the package metadata) and says that no run recorded in the guide used 3.13.1. The `<verify>` rejects any `at 3.13.1` grade phrase, requires the `at 3.13.0` count to equal 16267383, and requires the guide outside the two edited sections to be byte-identical to 16267383. |
| T-cwq-03 | Denial of service | workflows this bridge installs, under an engine release that includes engine PR #238, with `PI_CODING_AGENT_DIR` set | medium | mitigate | TXT-6 tells users to leave `PI_CODING_AGENT_DIR` unset with such a release, and TXT-1 holds the launcher pin below it, because `--home` sets the variable. The bridge change itself is out of scope (the scope forbids changing `workflow-home.ts`). The SUMMARY carries it as a follow-up. |
| T-cwq-04 | Information disclosure | commit contents | low | accept | Prose, a shell comment, and one version string. TruffleHog runs in the pre-commit run and in the commit hook. |
| T-cwq-SC | Tampering | npm/pip/cargo installs | low | accept | This plan runs no package install. `npm view` reads registry metadata only, and `npx --no-install` runs only the locally installed fallow. |
</threat_model>

<verification>
- The precondition held before any edit.
- `<verify>` exited 0 after the edits, after the pre-commit run, and again after the commit.
- `SKIP=npm-check pre-commit run --files scripts/pi.sh docs/workflows-compatibility.md CHANGELOG.md` exited 0. Record whether any fixer rewrote a file.
- The fallow audit verdict was `pass`, or fallow was not installed and the SUMMARY says so.
- The commit hook passed, with `npm-check` skipped because no staged file is a build input.
- POST-1 exited 0.
- No `npm run check` ran. The SUMMARY records: focused task verification passed; no build input changed, so the hook skipped npm-check and no full check is required.
</verification>

<success_criteria>
- The launcher runs engine 3.13.1, and its comment does not claim that any grade covers 3.13.1.
- The guide gives an honest reason for the Pi 0.86.1 minimum, lists only the limit that 3.13.1 still has, and warns about the storage override in engine pull request #238. Every engine pull request it cites is linked in the `https://github.com/QuintinShaw/pi-dynamic-workflows/pull/NNN` form.
- No evidence grade moved: no grade names 3.13.1, and every grade-reproducing 3.13.0 pin in `tests/live-uat/` is unchanged.
- The changelog no longer waits for fixes that shipped, and its Pi bullet makes no child-tool claim.
- Exactly one Conventional Commit holds the change, with no GSD reference in its message.
</success_criteria>

## Out-of-scope observations

Record this list in the SUMMARY. Do not act on it in this task.

1. The bridge does not follow engine pull request #238. `extensions/pi-claude-marketplace/platform/workflow-home.ts` reads only `os.homedir()` (WPTH-04). Once a release includes #238, a user with `PI_CODING_AGENT_DIR` set loses sight of the installed workflows. `tests/live-uat/workflow-storage-canary.mjs` W0 also fails against such a release, because the canary sets `PI_CODING_AGENT_DIR` to its sandbox and points `HOME` at a child of it. This needs a decision before the launcher pin or a canary pin moves past 3.13.1.
2. `scripts/pi.sh` launches Pi with `--no-extensions -e`, the mode in which 3.13.1 can leave result delivery pending. Engine pull requests #232 and #238 both merged after 3.13.1, so the release that brings #232 will probably also bring #238. Taking #232 into the launcher therefore depends on item 1.
3. The `CHANGELOG.md` bullet "Pi Coding Agent 0.86.1 is now required." came from PR #205 (5c652697) and carries no PR number, which `.claude/rules/changelog.md` requires on every top-level bullet.
4. `docs/workflows-compatibility.md` still grades its source reads "unchanged at 3.13.0". The task scope reports those bodies unchanged at 3.13.1 too (`parseWorkflowScript`, `validateMeta`, the determinism blocklist, `src/workflow-saved.ts`, the project-key derivation, and the tool names), but nothing in this repository recorded that re-read. `WPIN-01` tracks a machine-checkable re-read.
5. `docs/workflows-compatibility.md` line 220 counts "60 versions" from `1.0.0` through `3.13.0`. That range is still accurate, but the count predates 3.13.1.

## Source audit

| SOURCE   | ID       | Item                                                                                                                   | Task | Status                                                                                 |
| -------- | -------- | ---------------------------------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------- |
| GOAL     | -        | Update workflow-engine compatibility docs and pins after pi-dynamic-workflows 3.13.1                                   | 1    | COVERED                                                                                |
| REQ      | CWQ-01   | Launcher pin 3.13.1 with an honest comment                                                                             | 1    | COVERED (TXT-1, TXT-2)                                                                 |
| REQ      | CWQ-02   | Guide: rationale, remaining limit, storage warning, peer bullet, link form                                             | 1    | COVERED (TXT-3 to TXT-6)                                                               |
| REQ      | CWQ-03   | Changelog: release wait narrowed to #232, Pi bullet reworded; READMEs checked                                         | 1    | COVERED (TXT-7, TXT-8; READMEs need no edit, finding 6)                                |
| REQ      | CWQ-04   | live-UAT README and storage canary: per-occurrence decision                                                            | 1    | COVERED (no edit, finding 5; the verify pins the counts)                               |
| CONTEXT  | Scope 1  | `scripts/pi.sh` pin 3.13.0 to 3.13.1 and an honest comment                                                             | 1    | COVERED                                                                                |
| CONTEXT  | Scope 2  | `tests/live-uat/README.md` install lines and pin rationale, canary line-17 hint; keep grade-reproducing lines at 3.13.0 | 1    | COVERED (all occurrences reproduce grades, so none changes)                            |
| CONTEXT  | Scope 3a | Rewrite the Pi 0.86.1 rationale; keep the floor; say why without invented claims                                       | 1    | COVERED (TXT-4)                                                                        |
| CONTEXT  | Scope 3b | Drop the status limit; keep the `--no-extensions -e` limit with #232 on main awaiting a release                         | 1    | COVERED (TXT-5)                                                                        |
| CONTEXT  | Scope 3c | Note that the next engine release honors `PI_CODING_AGENT_DIR` (#238) and that the bridge does not (WPTH-04)            | 1    | COVERED (TXT-6)                                                                        |
| CONTEXT  | Scope 3d | Link engine PRs as `https://github.com/QuintinShaw/pi-dynamic-workflows/pull/NNN`                                       | 1    | COVERED (TXT-4, TXT-5, TXT-6)                                                          |
| CONTEXT  | Scope 4a | Narrow the release wait to #232                                                                                        | 1    | COVERED (TXT-8)                                                                        |
| CONTEXT  | Scope 4b | Reword the Pi 0.86.1 bullet so the Pi floor does not claim to make child tools work                                    | 1    | COVERED (TXT-7)                                                                        |
| CONTEXT  | Scope 4c | Check README.md and README.es.md for an equivalent claim                                                               | 1    | COVERED (none exists, finding 6)                                                       |
| CONTEXT  | Verify   | `git diff --check`, pre-commit run, `bash -n scripts/pi.sh`, no remaining status-label claim, one Conventional Commit   | 1    | COVERED (`<verify>`, action steps 4 and 6, POST-1)                                     |
| CONTEXT  | Fact     | #233 and #234 in 3.13.1                                                                                                | 1    | COVERED (TXT-1, TXT-4, TXT-5, TXT-8)                                                   |
| CONTEXT  | Fact     | #232 and #238 merged, unreleased; #238 storage rule; `--home` sets `PI_CODING_AGENT_DIR`                                | 1    | COVERED (TXT-1, TXT-5, TXT-6)                                                          |
| CONTEXT  | Fact     | Engine bodies unchanged since 3.13.0                                                                                   | -    | N/A: used to raise no grade (no grade may name 3.13.1); listed in out-of-scope item 4 |
| RESEARCH | -        | No research phase for this quick task                                                                                  | -    | N/A                                                                                    |

<output>
Create `.planning/quick/261006-cwq-update-workflow-engine-compatibility-doc/261006-cwq-SUMMARY.md` with `status: complete` in its frontmatter. Record:

- the commit hash, title, and shortstat;
- the pre-commit command, its exit status, the Node version, and whether any fixer rewrote a file;
- the commit hook result, including the `npm-check` skip;
- the fallow audit verdict, or the reason it did not run;
- the two `npm view` results that `<verify>` read;
- the verification scope, in these words: focused task verification passed; no build input changed, so the hook skipped npm-check and no full check is required;
- the "Choices made" decisions, the full "Out-of-scope observations" list, and any deviation from this plan.

Include the section that AGENTS.md requires:

```markdown
## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
```

Replace "None" with specifics if execution finds otherwise. Do not commit the SUMMARY: the quick orchestrator commits the docs artifacts.
</output>
