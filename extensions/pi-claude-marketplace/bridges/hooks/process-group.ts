// bridges/hooks/process-group.ts
//
// How the hook lanes signal a hook: through the process group it leads.
//
// Both lanes spawn a hook with `detached` on every platform but Windows, so
// the hook leads a process group of its own, and they send every signal to
// that group. Claude Code 2.1.319 spawns and signals its command hooks the
// same way. A shell-form hook runs as `/bin/sh -c '<command>'`, and the shell
// can run the command as a child instead of in its own place: dash does so
// for a lone command on Ubuntu, and every shell does so for `a || b`, `a; b`,
// or a pipe. A signal to the shell alone would end the shell and leave the
// hook running, holding the shell's stdout and stderr open; the group signal
// reaches both.

import type { ChildLike } from "./exec-timer.ts";

/** Signals the POSIX process group that `pid` leads; throws when it cannot. */
export type SignalGroup = (pid: number, signal: NodeJS.Signals | undefined) => void;

/** Node's group signal: `process.kill` of the group's negative id. */
const signalProcessGroup: SignalGroup = (pid, signal) => {
  process.kill(-pid, signal);
};

/** What decides how a lane signals its hooks. */
export interface GroupSignalDeps {
  readonly spawnImpl?: unknown;
  readonly signalGroup?: SignalGroup;
}

/**
 * `child` with a `kill` that signals the process group the child leads. The
 * exit state reads through to the child.
 *
 * The group signal is `deps.signalGroup`, or Node's when the lane spawns with
 * Node's own `spawn`, which the lanes ask for a group leader. A caller that
 * passes its own `spawnImpl` passes its own `signalGroup`, or the signals reach
 * the child alone. A child with no pid or a pid below 2, which names no group
 * of its own, also gets the signal alone, and so does a child whose group
 * cannot be signalled, such as one spawned on Windows.
 */
export function asGroupLeader(
  child: ChildLike & { readonly pid?: number | undefined },
  deps: GroupSignalDeps,
): ChildLike {
  const signalGroup =
    deps.signalGroup ?? (deps.spawnImpl === undefined ? signalProcessGroup : undefined);
  if (signalGroup === undefined) {
    return child;
  }

  return {
    get exitCode() {
      return child.exitCode;
    },
    get signalCode() {
      return child.signalCode;
    },
    kill(signal?: NodeJS.Signals): boolean {
      const { pid } = child;
      if (pid === undefined || pid < 2) {
        return child.kill(signal);
      }

      try {
        signalGroup(pid, signal);
        return true;
      } catch {
        // The group is gone or cannot be signalled; the child alone still can.
        return child.kill(signal);
      }
    },
  };
}
