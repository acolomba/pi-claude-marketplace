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
