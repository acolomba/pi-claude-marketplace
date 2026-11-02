// domain/context-injection.ts
//
// D-CF1-02: Claude Code's dynamic context injection. In the body of a skill or
// command, after argument substitution, each `` !`cmd` `` and each ```` ```! ````
// block runs as a shell command and its output replaces the pattern before the
// content reaches the model. A command that fails aborts the invocation with a
// `ContextInjectionError`, and nothing reaches the model; the edge reports the
// error through the notify chokepoint (IL-2). Pi has no permission modes, so
// every command runs, as in Claude Code's `bypassPermissions` mode.
//
// The command runner is a port (`ShellRun`), so this module never starts a
// process; the edge passes a runner built by platform/prompt-shell.ts.
// D-CF1-03: only user-invoked skills and commands reach this module. A skill
// file that the model reads by itself gets its variables filled, but its `!`
// commands never run.
//
// The parser, the order, the replacement, and the texts follow Claude Code
// 2.1.316 (`FUr`, `TGe`, `d$o`, `qTn`, `MRr`). Residual differences recorded
// under D-CF1-02: Claude Code's Bash tool merges stderr into stdout and may
// add an exit-code note to the failure text, and it caps a long output; here
// the runner keeps the two streams apart and nothing is truncated.

/** What happened to one command. */
export type ShellRunResult =
  | {
      readonly kind: "exited";
      readonly code: number | null;
      readonly stdout: string;
      readonly stderr: string;
      readonly shell: "bash" | "powershell";
    }
  | { readonly kind: "interrupted" }
  | { readonly kind: "not-started"; readonly message: string };

/** Runs one command and resolves with what happened; never rejects. */
export type ShellRun = (command: string) => Promise<ShellRunResult>;

/** Why a command aborted the invocation. */
export type ContextInjectionFailure = "failed" | "interrupted" | "not-started";

/** D-CF1-02: a `!` command that did not succeed, with Claude Code's message. */
export class ContextInjectionError extends Error {
  /** The pattern as written, such as `` !`git status` ``. */
  readonly pattern: string;
  readonly reason: ContextInjectionFailure;
  constructor(pattern: string, reason: ContextInjectionFailure, message: string) {
    super(message);
    this.name = "ContextInjectionError";
    this.pattern = pattern;
    this.reason = reason;
  }
}

// A fenced block runs from ```! to the next ```. Claude Code finds it with
// /```!\s*\n?([\s\S]*?)\n?```/g; the command is trimmed, so the text between
// the two markers gives the same command without that regex's backtracking.
const FENCE_OPEN = "```!";
const FENCE_CLOSE = "```";

// An inline !`cmd` at the start of a line or after whitespace; group 1 is the
// command. It runs on the masked text, so a pattern inside a code span is skipped.
const INLINE_PATTERN = /(?<=^|\s)!`([^`]+)`/gm;

// An ordinary inline code span, which the mask blanks unless `!` or a backtick
// comes right before it.
const CODE_SPAN = /`[^`\n]+`/g;

// The blank lines at the start of a command's stdout.
const LEADING_BLANK_LINES = /^(\s*\n)+/;

const SHELL_TOOL_NAMES = { bash: "Bash", powershell: "PowerShell" } as const;

interface Injection {
  readonly raw: string;
  readonly command: string;
}

// Blanks each ordinary code span, keeping its backticks and its length.
function maskCodeSpans(text: string): string {
  return text.replace(CODE_SPAN, (span: string, offset: number) => {
    const before = text[offset - 1];
    return before === "!" || before === "`" ? span : `\`${" ".repeat(span.length - 2)}\``;
  });
}

function toInjection(raw: string, command: string): Injection {
  return { raw, command: command.trim().replaceAll("\r\n", "\n") };
}

function fencedInjections(text: string): Injection[] {
  const found: Injection[] = [];
  let open = text.indexOf(FENCE_OPEN);
  while (open !== -1) {
    const close = text.indexOf(FENCE_CLOSE, open + FENCE_OPEN.length);
    if (close === -1) {
      break;
    }

    const end = close + FENCE_CLOSE.length;
    found.push(toInjection(text.slice(open, end), text.slice(open + FENCE_OPEN.length, close)));
    open = text.indexOf(FENCE_OPEN, end);
  }

  return found;
}

// Group 1 always takes part in a match, so String() only narrows the type.
function inlineInjections(text: string): Injection[] {
  return [...maskCodeSpans(text).matchAll(INLINE_PATTERN)].map((match) =>
    toInjection(match[0], String(match[1])),
  );
}

// Fenced blocks first, then inline patterns, skipping empty commands.
function findInjections(text: string): Injection[] {
  const inline = text.includes("!`") ? inlineInjections(text) : [];
  return [...fencedInjections(text), ...inline].filter((injection) => injection.command !== "");
}

function successOutput(stdout: string, stderr: string, shell: "bash" | "powershell"): string {
  const output = [stdout.replace(LEADING_BLANK_LINES, "").trimEnd(), stderr.trim()]
    .filter((part) => part !== "")
    .join("\n");
  return output === "" ? `(${SHELL_TOOL_NAMES[shell]} completed with no output)` : output;
}

function failureOutput(stdout: string, stderr: string): string {
  const parts = [stdout.trim()];
  if (stderr.trim() !== "") {
    parts.push(`[stderr]\n${stderr.trim()}`);
  }

  return parts.filter((part) => part !== "").join("\n");
}

function outputOf(raw: string, result: ShellRunResult): string {
  switch (result.kind) {
    case "exited":
      if (result.code === 0) {
        return successOutput(result.stdout, result.stderr, result.shell);
      }

      throw new ContextInjectionError(
        raw,
        "failed",
        `Shell command failed for pattern "${raw}": ${failureOutput(result.stdout, result.stderr)}`,
      );
    case "interrupted":
      throw new ContextInjectionError(
        raw,
        "interrupted",
        `Shell command interrupted for pattern "${raw}": [Command interrupted]`,
      );
    case "not-started":
      throw new ContextInjectionError(raw, "not-started", `[Error]\n${result.message}`);
  }
}

async function runInjection(injection: Injection, run: ShellRun): Promise<string> {
  return outputOf(injection.raw, await run(injection.command));
}

/**
 * D-CF1-02: runs every `!` command in `text` through `run`, all at once, and
 * replaces the first remaining occurrence of each pattern with its output,
 * fenced blocks first. Rejects with a `ContextInjectionError` when a command
 * fails, is interrupted, or cannot start.
 */
export async function expandContextInjections(text: string, run: ShellRun): Promise<string> {
  const injections = findInjections(text);
  const outputs = await Promise.all(injections.map((injection) => runInjection(injection, run)));
  // A replacer function keeps `$&` and similar sequences in an output literal.
  return injections.reduce(
    (expanded, injection, index) => expanded.replace(injection.raw, () => String(outputs[index])),
    text,
  );
}
