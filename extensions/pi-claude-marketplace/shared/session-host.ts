// shared/session-host.ts
//
// The facts about the Pi host that the reload rules read, and the one place
// that picks the command an instruction to reload names (RELOADCMD-D1). It
// imports nothing, so every layer can read it.

/** The fact about the Pi host that decides whether it takes later commands. */
export interface SessionHost {
  readonly hasUI: boolean;
}

/**
 * RELOADCMD-D1: whether this Pi process accepts later commands, a "sessionful"
 * host. Pi sets `hasUI` when the host bound a real UI context
 * (`core/extensions/runner.js:404`): the terminal and RPC bind one, print and
 * json bind none. A dialog needs an answer that arrives later, so `hasUI`
 * means a process that keeps reading input. The converse is not certain: a
 * future long-lived host without dialogs reads false, which is the safe
 * direction, because the extension then offers and names no reload there. It
 * is not whether Pi saves a session file: RPC with `--no-session` still takes
 * later commands. No other code decides this.
 */
export function acceptsLaterCommands(host: SessionHost): boolean {
  return host.hasUI;
}

/**
 * RELOADCMD-D1: whether the host has Pi's own `/reload`. Pi fact (1.5.1): the
 * terminal handles a typed `/reload` before any extension command
 * (`modes/interactive/interactive-mode.js:2762`); RPC's prompt runs only
 * extension commands, skills, and templates (`core/agent-session.js:1704`),
 * and the RPC command set has no reload (`modes/rpc/rpc-types.d.ts`).
 */
function hasNativeReload(mode: string): boolean {
  return mode === "tui";
}

/** The command that an instruction to reload names. */
export type ReloadCommand = "/reload" | "/claude:plugin reload";

/**
 * RELOADCMD-D1: the one place that picks the command an instruction to reload
 * names: Pi's own `/reload` where the host has it, `/claude:plugin reload` in
 * any other host that accepts later commands, and none in a one-shot run, whose
 * next run loads the change. Pi's terminal binds a UI, so a host with Pi's own
 * `/reload` always accepts later commands, and its check comes first.
 */
export function reloadCommandFor(mode: string, host: SessionHost): ReloadCommand | undefined {
  if (hasNativeReload(mode)) {
    return "/reload";
  }

  return acceptsLaterCommands(host) ? "/claude:plugin reload" : undefined;
}
