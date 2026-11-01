// domain/context-injection.ts
//
// D-CF1-02: Claude Code's dynamic context injection. In the body of a skill or
// command, after argument substitution, each `` !`cmd` `` runs as a shell
// command and its output replaces the pattern before the content reaches the
// model. The command runner is a port (`ShellRun`), so this module never
// starts a process; the edge passes a runner built by
// platform/prompt-shell.ts. D-CF1-03: only user-invoked skills and commands
// reach this module, because Pi offers no hook on the path where the model
// reads a skill by itself.

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

// An inline `` !`cmd` `` at the start of a line or after whitespace.
const INLINE_PATTERN = /(?<=^|\s)!`([^`]+)`/gm;

interface Injection {
  readonly raw: string;
  readonly command: string;
}

function findInjections(text: string): Injection[] {
  // Group 1 always takes part in a match, so String() only narrows the type.
  return [...text.matchAll(INLINE_PATTERN)].map((match) => ({
    raw: match[0],
    command: String(match[1]).trim(),
  }));
}

async function runInjection(injection: Injection, run: ShellRun): Promise<string> {
  const result = await run(injection.command);
  if (result.kind === "exited" && result.code === 0) {
    return result.stdout.trimEnd();
  }

  throw new Error(`Shell command failed for pattern "${injection.raw}"`);
}

/**
 * Runs every `!` command in `text` through `run` and replaces each pattern
 * with its output.
 */
export async function expandContextInjections(text: string, run: ShellRun): Promise<string> {
  const injections = findInjections(text);
  const outputs = await Promise.all(injections.map((injection) => runInjection(injection, run)));
  return injections.reduce(
    (expanded, injection, index) => expanded.replace(injection.raw, () => String(outputs[index])),
    text,
  );
}
