---
phase: 01-harness-and-version-raise
plan: 13
subsystem: domain, platform
tags: [context-injection, child-process, prompt-shell, fallow, rule-pack]

requires:
  - phase: 01-harness-and-version-raise
    provides: "01-10 registered domain/context-injection.ts and platform/prompt-shell.ts in .fallowrc.json dynamicallyLoaded and ignoreExports"
provides:
  - "expandContextInjections(text, run) with the ShellRun port and ContextInjectionError (D-CF1-02)"
  - "selectPromptShell(requested, host) and createPromptShellRunner(options), the fifth sanctioned node:child_process site (D-CF1-02, D-21)"
  - "rule pack, SHELL_OUT_EXEMPT_TARGETS, and the exactly-five whitelist test name platform/prompt-shell.ts"
affects: [skills bridge, commands bridge, command invocation, skill invocation]

actuals:
  tokens: 12700
  tasks: 3
  commits: 3
plan_head_before: 9a815c57e5be80e7c6c7ca4df70dbebe7f7bb60c
plan_head_after: 0c12f7934863349b0797410d23d3a596a486aa92

tech-stack:
  added: []
  patterns:
    - "Platform result types mirror the domain port shape structurally, because platform may import only shared/; the platform test pins the match with a ShellRunResult annotation"
    - "Fake processes for overloaded `on` signatures are small test classes, not object literals"

key-files:
  created:
    - extensions/pi-claude-marketplace/domain/context-injection.ts
    - test/domain/context-injection.test.ts
    - extensions/pi-claude-marketplace/platform/prompt-shell.ts
    - test/platform/prompt-shell.test.ts
  modified:
    - rule-packs/architecture.json
    - test/architecture/gate-targets.ts
    - test/architecture/no-shell-out.test.ts

key-decisions:
  - "A spawn failure throws ContextInjectionError with the message `[Error]\\n<message>` and no `Shell command failed for pattern` prefix, because that is what Claude Code 2.1.316 MRr throws"
  - "The fenced pattern is found with indexOf from ```! to the next ``` instead of upstream's regex, which ESLint sonarjs/super-linear-regex rejects; the trimmed command is the same"
  - "A stopped run resolves `interrupted` only after SIGKILL reaches the group, even when the shell closes during the grace, so descendants are always killed"
  - "The runner request takes the already selected shell; the edge calls selectPromptShell(frontmatter.shell, NODE_PROMPT_SHELL_HOST) first"
  - "timeoutMs (120,000) and killGraceMs (2,000) are optional with defaults"
  - "Windows signals the shell process alone (no taskkill tree kill)"

patterns-established:
  - "D-CF1-02 composition: edge builds `command => runner({ command, shell: selectPromptShell(fm.shell, host), cwd, env, signal })` and passes it to expandContextInjections"

requirements-completed: [DEC-01]

coverage:
  - id: D1
    description: "expandContextInjections parses fenced then masked inline patterns, runs them concurrently, splices first occurrences, formats output and the three failure texts"
    requirement: DEC-01
    verification:
      - kind: unit
        ref: "test/domain/context-injection.test.ts (22 D-CF1-02 cases)"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/context-injection.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "createPromptShellRunner launches bash -c / pwsh / powershell.exe with no shell wrapper, stops the process group on timeout or abort, never rejects; selectPromptShell matches upstream"
    requirement: DEC-01
    verification:
      - kind: unit
        ref: "test/platform/prompt-shell.test.ts (41 cases)"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/platform/prompt-shell.ts"
        status: pass
      - kind: manual_procedural
        ref: "one-off real-bash run recorded in this SUMMARY"
        status: pass
    human_judgment: false
  - id: D3
    description: "The rule pack, SHELL_OUT_EXEMPT_TARGETS, and the whitelist test admit exactly five spawn sites; fallow passes"
    requirement: DEC-01
    verification:
      - kind: unit
        ref: "test/architecture/no-shell-out.test.ts#whitelist: exactly five files may import node:child_process"
        status: pass
      - kind: other
        ref: "npm run fallow"
        status: pass
    human_judgment: false

duration: 48min
completed: 2026-11-01
status: complete
---

# Phase 1 Plan 13: Dynamic Context Injection Core Summary

**A pure parser and splicer for `` !`cmd` `` and ```` ```! ```` blocks that takes the command runner as a port and fails with Claude Code 2.1.316's texts, plus a fifth sanctioned `node:child_process` module that picks Bash or PowerShell as upstream does and kills the whole process group on timeout or cancel.**

## Performance

- **Duration:** about 48 min
- **Started:** 2026-11-01T02:56:24Z
- **Completed:** 2026-11-01T03:44:20Z
- **Tasks:** 3
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments

- `domain/context-injection.ts`: `expandContextInjections(text, run)` finds fenced blocks, then inline patterns on text whose ordinary code spans are masked (`TGe`). It trims each command and turns CRLF into LF, skips empty ones, and runs all of them at once through the port. It replaces the first remaining occurrence of each raw pattern with a replacer function, so `$&` stays literal. On success the output is stdout without leading blank lines and with trailing space trimmed, then the trimmed stderr. An empty result reads `(Bash completed with no output)` or `(PowerShell completed with no output)`.
- `ContextInjectionError` carries `pattern`, `reason` (`failed`, `interrupted`, or `not-started`), and Claude Code's message.
- `platform/prompt-shell.ts`: `selectPromptShell` ports `S = requested === "powershell" && Vv() ? PowerShell : jd() ? Bash : PowerShell`. On Windows, Git Bash is found as upstream's `x()` finds it: `CLAUDE_CODE_GIT_BASH_PATH`, the two standard folders, then the bash beside the git on PATH. `createPromptShellRunner` launches with `shell: false`, ignored stdin, and piped output, and on POSIX the shell leads its own process group. A run past the timeout, or a cancelled run, sends SIGTERM and then SIGKILL to the group and resolves `interrupted`. A start failure resolves `not-started`.
- The rule pack, `SHELL_OUT_EXEMPT_TARGETS`, and `no-shell-out.test.ts` name `platform/prompt-shell.ts` as the fifth spawn site.

## Final signatures (for the skill and command phases)

```ts
// domain/context-injection.ts
export type ShellRunResult =
  | { readonly kind: "exited"; readonly code: number | null; readonly stdout: string; readonly stderr: string; readonly shell: "bash" | "powershell" }
  | { readonly kind: "interrupted" }
  | { readonly kind: "not-started"; readonly message: string };
export type ShellRun = (command: string) => Promise<ShellRunResult>;
export type ContextInjectionFailure = "failed" | "interrupted" | "not-started";
export class ContextInjectionError extends Error {
  readonly pattern: string;
  readonly reason: ContextInjectionFailure;
  constructor(pattern: string, reason: ContextInjectionFailure, message: string);
}
export function expandContextInjections(text: string, run: ShellRun): Promise<string>;

// platform/prompt-shell.ts
export type PromptShell = "bash" | "powershell";
export interface PromptShellHost { platform; env: NodeJS.ProcessEnv; isFile(file): boolean; signalGroup(pid, signal): void }
export const NODE_PROMPT_SHELL_HOST: PromptShellHost;
export const NODE_PROMPT_SHELL_SPAWN: PromptShellSpawn;
export function selectPromptShell(requested: string | undefined, host: PromptShellHost): PromptShell;
export interface PromptShellRequest { command: string; shell: PromptShell; cwd: string; env: NodeJS.ProcessEnv; signal?: AbortSignal }
export type PromptShellResult = /* same shape as ShellRunResult */;
export function createPromptShellRunner(options: {
  spawn: PromptShellSpawn; host: PromptShellHost; timeoutMs?: number; killGraceMs?: number;
}): (request: PromptShellRequest) => Promise<PromptShellResult>;
```

Composition at the edge:

```ts
const runner = createPromptShellRunner({ spawn: NODE_PROMPT_SHELL_SPAWN, host: NODE_PROMPT_SHELL_HOST });
const shell = selectPromptShell(frontmatter.shell, NODE_PROMPT_SHELL_HOST);
const body = await expandContextInjections(substituted, (command) =>
  runner({ command, shell, cwd: ctx.cwd, env: process.env, signal }),
);
// catch ContextInjectionError -> notify through shared/notification-dispatch.ts; send nothing to the model
```

## Real-bash run (one-off script outside the suite)

The production runner (`NODE_PROMPT_SHELL_SPAWN`, `NODE_PROMPT_SHELL_HOST`) ran against `/bin/bash` on Linux from a scratch script:

```text
selected: bash
raw result: {"kind":"exited","code":3,"stdout":"a\n","stderr":"b","shell":"bash"}
error class: ContextInjectionError reason: failed
error message: "Shell command failed for pattern \"!`printf 'a\\n'; printf 'b' >&2; exit 3`\": a\n[stderr]\nb"
success: "Dir:   x\nw\nfenced"
timeout result: {"kind":"interrupted"} 507 ms
missing cwd: {"kind":"not-started","message":"spawn bash ENOENT"}
```

The timeout case ran `sleep 30 & sleep 30; wait` with a 300 ms timeout and a 200 ms grace. After it, `pgrep` found no `sleep 30` process, so the group kill reached the background child.

## D-CF1-02 residuals

- **A2, merged streams:** Claude Code's Bash tool merges stderr into stdout. This runner keeps the two streams apart, so the success text is stdout, then stderr, joined by a newline. On failure, upstream's `qTn` shape (`<stdout>\n[stderr]\n<stderr>`) applies to the separate streams.
- **A3, failure tail:** upstream's `ShellError` text may add an exit-code note. Here the failure text has no exit code.
- **A8, timeout and size:** the default timeout is 120,000 ms, the Bash tool's default, and the kill grace is 2,000 ms. Output is not truncated. Upstream caps a long tool result and persists it to a file.
- A missing `cwd` makes Node report `spawn bash ENOENT`, which names the shell, not the folder.

## TDD Gate Compliance

The commit hook runs `check:commit` (direct coverage for the staged pairs), and `--no-verify` is forbidden, so a failing-test commit cannot land. RED ran locally before each GREEN, and each task landed as one `feat` commit with its tests. Evidence is in the agent scratch folder:

- Task 1 RED: `test/domain/context-injection.test.ts#replaces an inline command with its output` failed with an assertion (the splice returned the text unchanged), and the bash launch case failed with an assertion (the skeleton resolved `not-started`).
- Task 2 RED: 11 of 19 cases failed with assertions against the tracer (fenced blocks, the empty command, CRLF, output format, empty-output note, and every error text). The first run stopped at load because `ContextInjectionError` was not exported. A stub class was added so that the cases could fail on their assertions.
- Task 3 RED: the shell selection, launch-table, Git Bash, timeout, abort, start-failure, and NODE host cases failed with assertions against stub exports. The decode case passed already, because the tracer used `StringDecoder`.

## Task Commits

1. **Task 1: Run one inline command through the injected runner, with the fifth spawn site sanctioned**: `47d62ea` (feat)
2. **Task 2: Complete the parser, the splice, and Claude Code's output and failure texts**: `d05424d` (feat)
3. **Task 3: Complete the runner: shell selection, timeout, abort, start failure, and Windows launch**: `0c12f79` (feat)

**Plan metadata:** this SUMMARY commit (docs)

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/context-injection.ts`: the parser, the splicer, and `ContextInjectionError`
- `test/domain/context-injection.test.ts`: 22 cases through a stub runner
- `extensions/pi-claude-marketplace/platform/prompt-shell.ts`: shell selection, the launch table, the group stop, and the Node host
- `test/platform/prompt-shell.test.ts`: 41 cases with a fake process, fake hosts, and fake timers. The Node host cases use a temp file and a `process.kill` stub, and start no process.
- `rule-packs/architecture.json`: `child-process-chokepoint` exclude and message name five sites
- `test/architecture/gate-targets.ts`: `SHELL_OUT_EXEMPT_TARGETS` gains the prompt shell
- `test/architecture/no-shell-out.test.ts`: the docstring paragraph for the fifth site and the exactly-five assertion

## Decisions Made

See `key-decisions` in the frontmatter. In short: upstream's spawn-failure text has no prefix, the fenced finder avoids a backtracking regex, a stopped run resolves `interrupted` only after SIGKILL, the request takes the already selected shell, the timeouts have defaults, and Windows stops the shell process alone.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The not-started text follows upstream, not the plan's "failed shape"**

- **Found during:** Task 2
- **Issue:** The plan says a command that cannot start throws `Shell command failed for pattern "<raw>": [Error]\n<message>`. Claude Code 2.1.316 `MRr` (byte offset 286302881 in `/opt/claude-code/bin/claude`) throws `new vC("[Error]\n" + message)`, with no prefix.
- **Fix:** The message is `[Error]\n<message>`, with `reason: "not-started"` and the pattern as typed fields.
- **Files modified:** `extensions/pi-claude-marketplace/domain/context-injection.ts`
- **Commit:** `d05424d`

**2. [Rule 3 - Blocking] The fenced regex was replaced by an equivalent indexOf scan**

- **Found during:** Task 2
- **Issue:** ESLint `sonarjs/super-linear-regex` rejects upstream's `/```!\s*\n?([\s\S]*?)\n?```/g`.
- **Fix:** Scan from each ```` ```! ```` to the next ```` ``` ````. Whitespace never contains a backtick and the command is trimmed, so the command and the raw text are the same. A case for an unclosed block was added.
- **Commit:** `d05424d`

**3. [Rule 3 - Blocking] The Task 1 tracer included a non-zero-exit guard case**

- **Found during:** Task 1
- **Issue:** The commit hook requires 100% branch coverage of each staged pair. A splice that checks for exit 0 needs a case for the other branch.
- **Fix:** One extra case, "rejects when a command exits with a non-zero code". Task 2 replaced its plain error with `ContextInjectionError`.
- **Commit:** `47d62ea`

**4. [Rule 1 - Bug] The plan's grep criterion for `exactly five files` expected 1 match, and the whitelist docstring repeated the title**

- **Found during:** Task 1 acceptance check
- **Fix:** The docstring now says "the sibling whitelist assertion". This change landed in the Task 2 commit.
- **Commit:** `d05424d`

---

**Total deviations:** 4 auto-fixed (2 bug, 2 blocking). **Impact:** each change follows upstream more closely or satisfies a gate. The scope is unchanged.

## Issues Encountered

- The first Task 1 commit attempt failed `@typescript-eslint/no-use-before-define` on the object-literal fake process. A small `ShellProcess` test class with overloads fixed it. Node's strip-only TypeScript also rejects parameter properties, so the class assigns `pid` in its constructor.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-01-21 (accept), T-01-23 (group stop with a 120 s timeout), T-01-24 (typed error, no output), and T-01-25 (all gates changed together) are in place as planned.

## Dubious Choices

1. Not-started message is upstream's bare `[Error]\n<message>`, not the plan's "failed shape" (deviation 1).
2. Windows stops only the shell process (`child.kill`), not its tree; package-manager.ts uses `taskkill /T /F`, which this module cannot import and would need its own copy of.
3. Windows Git Bash lookup scans absolute PATH entries for `git.exe` instead of upstream's `where.exe git`; the Windows PowerShell executable is `powershell.exe` as the plan says (not verified against upstream's PowerShell tool launcher), and on Linux and macOS it is `pwsh`.
4. On Windows with `CLAUDE_CODE_USE_POWERSHELL_TOOL` unset and Git Bash present, the PowerShell tool counts as off (upstream reads the `tengu_cobalt_ridge` feature flag, default false).
5. A stopped run always waits the full kill grace and sends SIGKILL to the group before it resolves `interrupted`, even when the shell exits on SIGTERM. The default grace is 2,000 ms. Neither value was taken from upstream.
6. The runner request takes an already selected `PromptShell` instead of the frontmatter value. The edge must call `selectPromptShell` itself.
7. `timeoutMs` and `killGraceMs` are optional with defaults. The plan's interface listed them as fields.
8. RED was not committed separately, because the commit hook makes a failing-test commit impossible without `--no-verify`.
9. REQUIREMENTS.md was not touched. DEC-01 is shared by sibling plans that are still running, so the orchestrator marks it.

## Next Phase Readiness

The skill and command invocation handlers can compose `expandContextInjections` with a runner from `createPromptShellRunner` after argument substitution. When they import these modules, the `.fallowrc.json` `dynamicallyLoaded` and `ignoreExports` entries for both files can be removed. Edge wiring, notifying on `ContextInjectionError`, and a cucumber scenario remain for those phases.

## Self-Check: PASSED

- All four created files exist. Commits `47d62ea`, `d05424d`, and `0c12f79` are on this branch.
- The plan verification passed: the three test files ran 70 of 70 cases, `npm run fallow` exited 0, and direct coverage reported no shortfall for either source.

---
*Phase: 01-harness-and-version-raise*
*Completed: 2026-11-01*
