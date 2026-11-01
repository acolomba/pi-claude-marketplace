---
phase: 01-harness-and-version-raise
reviewed: 2026-11-01T06:31:02Z
depth: standard
files_reviewed: 56
files_reviewed_list:
  - .fallowrc.json
  - .github/workflows/ci.yml
  - extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts
  - extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts
  - extensions/pi-claude-marketplace/bridges/mcp/adapter-escape.ts
  - extensions/pi-claude-marketplace/domain/argument-substitution.ts
  - extensions/pi-claude-marketplace/domain/claude-mcp-variables.ts
  - extensions/pi-claude-marketplace/domain/component-paths.ts
  - extensions/pi-claude-marketplace/domain/context-injection.ts
  - extensions/pi-claude-marketplace/domain/description-fallback.ts
  - extensions/pi-claude-marketplace/domain/invocation-frontmatter.ts
  - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
  - extensions/pi-claude-marketplace/domain/resolver-types.ts
  - extensions/pi-claude-marketplace/domain/shell-words.ts
  - extensions/pi-claude-marketplace/edge/command-invocation.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/platform/mcp-status.ts
  - extensions/pi-claude-marketplace/platform/pi-api.ts
  - extensions/pi-claude-marketplace/platform/prompt-shell.ts
  - extensions/pi-claude-marketplace/platform/workflow-home.ts
  - features/lib/agent-files.ts
  - features/lib/companions.ts
  - features/lib/hook-files.ts
  - features/lib/hook-recorder.ts
  - features/lib/mcp-configuration.ts
  - features/lib/mcp-server-files.ts
  - features/lib/mcp-stub-server.ts
  - features/lib/pi-launch-environment.ts
  - features/lib/pi-process.ts
  - features/lib/pi-registry-probe/extension.ts
  - features/lib/pi-registry-probe/snapshot.ts
  - features/lib/scripted-model/extension.ts
  - features/lib/scripted-model/script.ts
  - features/lib/skill-files.ts
  - features/lib/slash-command-files.ts
  - features/lib/turn-records.ts
  - features/lib/workflow-files.ts
  - features/step_definitions/agent/runs.steps.ts
  - features/step_definitions/companion.steps.ts
  - features/step_definitions/hook/runs.steps.ts
  - features/step_definitions/mcp-configuration.steps.ts
  - features/step_definitions/mcp-server/calls.steps.ts
  - features/step_definitions/model.steps.ts
  - features/step_definitions/plugin/publishing.steps.ts
  - features/step_definitions/session.steps.ts
  - features/step_definitions/skill/invocation.steps.ts
  - features/step_definitions/slash-command/listing.steps.ts
  - features/step_definitions/workflow/runs.steps.ts
  - features/support/world.ts
  - package.json
  - rule-packs/architecture.json
  - scripts/install-test-peers.mjs
  - scripts/pi.sh
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-11-01T06:31:02Z
**Depth:** standard
**Files Reviewed:** 56
**Status:** issues_found

## Structural Findings (fallow)

`fallow audit` against base `e4a4c71f277a5751ce7902a01bfab8e3bac960d5`: verdict `pass`, no findings.
The caller also reports that `npm run check` and `npm run test:cucumber` (1169 scenarios) pass on this tree.

## Narrative Findings (AI reviewer)

## Summary

I reviewed the phase diff against `e4a4c71`. Scope: the invocation cores (argument
substitution, the shell-word tokenizer, context injection, description fallback, the
dropped-field table), the `!` prompt-shell spawn module, the D-CF1-06 component-directory
change, the D-CF1-13/14 MCP escape and carried-field changes, the harness under
`features/lib`, `features/support`, and `features/step_definitions`, the version raise,
and the CI shards.

The product code is careful. I traced the D-CF1-13 escape writer through
pi-mcp-adapter 7.0.0's real `interpolateEnvVars` (three passes) and its `!`-prefix secret
rule. I tried defaults that end in a partial `$en`/`{env` marker, defaults before
`env:`/`v:`/`:X` text, and text ending in `$` before a defaulted reference. Each one
reached the server as Claude would write it. `substituteArguments` matches the
research's `T2e`/`m1t`/`xM` transcription on every case I ran. `context-injection.ts`
reproduces `FUr`/`TGe`/`qTn` exactly, including the first-occurrence splice. Random
fuzzing of `splitArguments` (200k short inputs, plus 10,000-character worst cases for
`for`, `[`, `"$(`, `((`, `)` and redirections) found no hang and no crash.

The main defect is in the tokenizer. I ran a differential test of `splitArguments`
against the research's own tree-sitter-bash 0.25.1 harness. On quoting- and
escape-heavy input, about 3% of cases (113 of 4,000) differ from upstream, and every one
involves `\$` after a quoted piece or an expansion. D-CF1-01 requires quoting and
backslash escapes to match exactly. A wrong token count shifts every later `$N`. The
other findings: a Windows shell-selection parity gap, a CI shard list that can silently
drop new feature directories, and two harness timeouts that will flake on a cold
compile cache.

## Warnings

### WR-01: `\$` after a quoted piece or expansion tokenizes differently from upstream, against D-CF1-01's quoting/escape carve-out

**File:** `extensions/pi-claude-marketplace/domain/shell-words.ts:291-295` (`escapeStartsWord`, `GLUING_ESCAPES` at line 25), and `readUnquoted` at lines 237-244
**Issue:** D-CF1-01 licenses tokenizer residuals except one class: the port "must match quoting and backslash escapes". When `\$` comes right after a quoted piece or an expansion, `escapeStartsWord` starts a new word, and `readUnquoted` reads `\$` as an ordinary escaped `$`. Upstream (tree-sitter-bash 0.25.1 through `Twe`/`Vst`/`pe`, run with the research harness `scripts/ck.mjs`) drops that `$` instead:

| typed | upstream | port |
|---|---|---|
| `"a"\$ b` | `["a","b"]` | `["a","$","b"]` |
| `"cost"\$ 5 now` | `["cost","5","now"]` | `["cost","$","5","now"]` |
| `$X\$ b` | `["$X","b"]` | `["$X","$","b"]` |
| `"a"\$"b" c` | `["a","b","c"]` | `["a","$b","c"]` |
| `x "a"\$5 y` | `["x","a","$5","y"]` | same (matches) |

In a 4,000-input random differential over quotes, backslashes, `$X`/`${X}` and plain words, 113 inputs differ, and all 113 contain `\$`. Every other quoting/escape combination matched. The extra or merged token shifts every later `$N` and `$ARGUMENTS[N]`, so the model receives different content from the content Claude Code sends. The test module records one instance as a "licensed residual" (`test/domain/shell-words.test.ts:138`, `x 'a'\$ y`). That conflicts with the decision's carve-out, because this residual is a backslash-escape case.
**Fix:** After a non-`word` piece, treat a word that begins with `\$` the way tree-sitter recovers. Read the `\$` as a lone `$` expansion piece. A lone piece is then dropped by `addArgument`'s lone-expansion rule. The `$` is also dropped before a following quoted piece, and it stays glued only before a parameter character (as in `\$5`). One possible shape:

```ts
// readWord, before the piece loop: an escaped dollar that opens a word after a
// quoted piece or expansion reads as tree-sitter's bare `$`.
if (previous !== "word" && charAt(cursor) === "\\" && charAt(cursor, 1) === "$") {
  cursor.pos += 2;
  PARAMETER.lastIndex = cursor.pos;
  const name = PARAMETER.exec(cursor.text)?.[0] ?? "";
  pieces.push({ kind: name === "" ? "expansion" : "word", text: `$${name}` });
  cursor.pos += name.length;
}
```

Then promote the five rows above (and `x 'a'\$ y`) from `RESIDUAL_ROWS` to `GOLDEN_ROWS`. The new rows must be checked against `scripts/ck.mjs`, not hand-derived.

### WR-02: Explicit `shell: bash` on Windows without Git Bash silently runs PowerShell; upstream aborts the invocation

**File:** `extensions/pi-claude-marketplace/platform/prompt-shell.ts:212-221`
**Issue:** `selectPromptShell("bash", host)` returns `"powershell"` whenever `bashAvailable(host)` is false. The research for D-CF1-02 (`01-RESEARCH.md:447`) records upstream's behavior here. When `shell: bash` is declared and Git Bash is missing, upstream throws: `Skill /<name> requires bash (\`shell: bash\` in frontmatter) but Git Bash was not found. ... or change the skill's frontmatter to \`shell: powershell\`.` Bash syntax would then run under `powershell.exe -Command`. That can execute a different command from the one the author wrote, instead of failing cleanly. The return type `PromptShell` has no way to express "refuse", so Phases 2 and 3 cannot wire upstream's error without changing this frozen core.
**Fix:** Return a refusal arm and let the edge report it through the notify chokepoint:

```ts
export type PromptShellChoice =
  | { readonly kind: "shell"; readonly shell: PromptShell }
  | { readonly kind: "bash-missing" };

export function selectPromptShell(requested: string | undefined, host: PromptShellHost): PromptShellChoice {
  if (requested === "powershell" && powerShellToolEnabled(host)) return { kind: "shell", shell: "powershell" };
  if (bashAvailable(host)) return { kind: "shell", shell: "bash" };
  return requested === "bash" ? { kind: "bash-missing" } : { kind: "shell", shell: "powershell" };
}
```

Or record the divergence under D-CF1-02 if it is intended.

### WR-03: CI behavioral shards list directories, so a new feature directory silently drops out of CI

**File:** `.github/workflows/ci.yml:144-151, 174`
**Issue:** The `behavioral` matrix passes explicit paths (`features/marketplace features/plugin` and the six function directories) to `cucumber-js`. `cucumber.json` sets no `paths`, so a local `npm run test:cucumber` runs every `features/**/*.feature`, while CI runs only the listed directories. A scenario added under any other directory passes locally and never runs on a pull request. Example: a future `features/command/`, or a root-level `features/*.feature`. AGENTS.md requires a behavioral scenario for every user-visible change, so a silent skip defeats that gate.
**Fix:** Add a cheap guard step, or make one shard the complement of the other. For example:

```yaml
      - name: Check that the shards cover every feature file
        if: matrix.shard == 'lifecycle'
        run: |
          uncovered=$(find features -name '*.feature' | grep -Ev '^features/(marketplace|plugin|skill|slash-command|agent|hook|mcp-server|workflow)/' || true)
          test -z "$uncovered" || { echo "feature files outside every shard:"; echo "$uncovered"; exit 1; }
```

### WR-04: The launch-environment profile-Pi step runs under the 30-second default timeout

**File:** `features/step_definitions/mcp-server/calls.steps.ts:106-119`
**Issue:** `"pi runs with the scripted model, pi-mcp-adapter, and the environment variable {string} set to {string}"` calls `usePiWithProfile`, but it passes no step timeout. Cucumber's 30-second default therefore applies. `features/support/world.ts:66-74` documents that a first profile-Pi start per worker takes 13-20 s idle and 27 s or more on a loaded runner. The other two profile starters use `PROFILE_PI_START_TIMEOUT_MS` (90 s). This step also loads pi-mcp-adapter and an extra extension, so it is the heaviest start. With `order: random` and `parallel: 8`, it will intermittently be a worker's first profile Pi and time out.
**Fix:**

```ts
Given(
  "pi runs with the scripted model, pi-mcp-adapter, and the environment variable {string} set to {string}",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld, variable: string, value: string) { ... },
);
```

### WR-05: The untrusted start, which loads every extension twice, has a shorter timeout than the trusted start

**File:** `features/step_definitions/companion.steps.ts:117-120, 167-176`
**Issue:** `UNTRUSTED_START_TIMEOUT_MS = 60_000`, while the trusted starter uses `PROFILE_PI_START_TIMEOUT_MS = 90_000`. The comment above the constant says the untrusted start loads every extension twice. So the slower path gets the smaller budget, and it is the likeliest to flake on a cold jiti cache under parallel load.
**Fix:** Derive the timeout from the shared constant, for example `const UNTRUSTED_START_TIMEOUT_MS = 2 * PROFILE_PI_START_TIMEOUT_MS;`. At minimum, use `PROFILE_PI_START_TIMEOUT_MS`.

## Info

### IN-01: The residual table omits frequent residual classes on natural-language arguments

**File:** `extensions/pi-claude-marketplace/domain/shell-words.ts:8-12` (residual policy); `test/domain/shell-words.test.ts:135-145`
**Issue:** Beyond WR-01, D-CF1-01 licenses the grammar residuals, but the residual table lists only nine exotic examples. The differential run shows common phrases that differ: `100% coverage now` (upstream `["coverage","now"]`, port `["100%","coverage","now"]`), `50% off`, `run == check` (upstream drops `==`), `{x} y`, `! [x]`, `{ b`, and `a= b`. These made up about 11% of a 2,885-input sample of mixed punctuation. `%`-led arguments and `==` are plausible in real `/cmd` arguments.
**Fix:** Add representative rows (`100% coverage`, `a == b`, `{x} y`) to `RESIDUAL_ROWS`, so the licensed difference is recorded, or port tree-sitter's handling where it is cheap (`%`-led first word, `==` arguments).

### IN-02: Whole-file fallow export suppressions for six cores have no removal trigger

**File:** `.fallowrc.json:5-26`; `extensions/pi-claude-marketplace/platform/pi-api.ts:77-82`
**Issue:** `dynamicallyLoaded` plus `ignoreExports: ["*"]` covers six modules, and two `fallow-ignore-next-line unused-type` markers cover the new Pi types. Together they turn off dead-code detection for every export of the invocation cores. The cores are not wired yet, so this is intended. But nothing forces the suppressions out when Phases 2 and 3 wire the cores. An export that stays unused after wiring will never be reported.
**Fix:** Have the Phase 2/3 plans delete each module's entry when they import it, or narrow `exports` to the named symbols each phase is expected to consume.

### IN-03: The exact `pi-ai` dev pin can diverge from the copy `pi-coding-agent` pins

**File:** `package.json:19-21`
**Issue:** `@earendil-works/pi-ai` is pinned exactly to `1.4.0` for the scripted model. `@earendil-works/pi-coding-agent` is `^1.4.0`, and each release depends on an exact `pi-ai` version (1.4.0 today, deduped). After a lockfile refresh to pi-coding-agent 1.5.x, Pi would load a nested pi-ai 1.5.x, while `features/lib/scripted-model/extension.ts` would build its faux provider from the top-level 1.4.0. The harness would then run against two pi-ai copies.
**Fix:** Pin `@earendil-works/pi-coding-agent` exactly in `devDependencies`, or give `pi-ai` the same caret range and add an `npm ls @earendil-works/pi-ai` dedupe check to `check:static`.

### IN-04: A `!` command that leaves a background child holding stdout open runs to the 120 s timeout

**File:** `extensions/pi-claude-marketplace/platform/prompt-shell.ts:333-337`
**Issue:** The run settles on `close`, which waits for every holder of the stdout and stderr pipes. A command like `` !`some-server &` `` exits its shell right away, but the background child keeps the pipe open. The invocation then blocks for two minutes and aborts as "interrupted" when the group is killed. I did not verify upstream's Bash tool against this case, so this may be a parity question rather than a defect.
**Fix:** If upstream returns at shell exit, settle on `exit` and give the streams a short drain window. Otherwise, record this under D-CF1-02's residuals.

---

_Reviewed: 2026-11-01T06:31:02Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
