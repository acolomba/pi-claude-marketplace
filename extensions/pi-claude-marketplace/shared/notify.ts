import { errorMessage } from "./errors.ts";

import type { ExtensionContext } from "../platform/pi-api.ts";

/**
 * shared/notify.ts -- the SOLE sanctioned ctx.ui.notify call site (D-07).
 *
 * Severity is part of the function name. The Pi API's `notify(msg, type?)`
 * accepts a magic-string `"info" | "warning" | "error"` second arg; a typo
 * like `"warining"` silently degrades to `"info"` because there is no
 * exhaustiveness check. Severity-named wrappers eliminate that class of bug.
 *
 * The eslint per-file override in eslint.config.js (D-06 / BLOCK B) disables
 * `no-restricted-syntax` for this file, so inline `eslint-disable-next-line`
 * comments are unnecessary here (they would trigger
 * `reportUnusedDisableDirectives` warnings). The per-file override is the
 * single audit surface; this comment documents the sanctioned-use intent in
 * its place.
 */

/** Default-severity notify -- success path. */
export function notifySuccess(ctx: ExtensionContext, message: string): void {
  ctx.ui.notify(message);
}

/** Warning notify -- used for cleanup leaks, partial failures, soft-dep warnings. */
export function notifyWarning(ctx: ExtensionContext, message: string): void {
  ctx.ui.notify(message, "warning");
}

/**
 * Error notify -- operation did not succeed; state unchanged or fully rolled back.
 * Optional `cause` feeds Error.cause for ES-4 chain traversal. The cause is
 * surfaced flat in the message tail (`\nCause: <message>`); Phase 6's
 * `formatErrorWithCauses` helper will replace this body when it lands.
 *
 * NFR-9 note: `cause.message` is the only content we surface from the cause.
 * Stack traces and absolute paths are NOT included by this wrapper -- callers
 * that need to expose a path must put it in `message` deliberately. The cause
 * value is normalized via `errorMessage()` (the `Error`-or-`String(...)`
 * primitive in shared/errors.ts) so this site never falls through to
 * `[object Object]` on raw thrown objects.
 */
export function notifyError(ctx: ExtensionContext, message: string, cause?: unknown): void {
  const causeText = cause === undefined ? "" : `\nCause: ${errorMessage(cause)}`;
  ctx.ui.notify(`${message}${causeText}`, "error");
}

/**
 * Usage error notify (ES-3 primitive). Surfaces a usage-style error at
 * `error` severity with the relevant Usage block appended after a blank line.
 *
 * Phase 6 will assemble actual Usage block strings (from PRD §6.12 ES-5
 * placeholders + per-subcommand argument tables) and call this primitive at
 * every argument-validation failure site. Phase 1 ships the primitive only;
 * call sites do not yet exist.
 *
 * Contract: the on-the-wire string is `${message}\n\n${usageBlock}`. The
 * blank line between message and Usage block is part of the user contract;
 * tests in Plan 06 assert it byte-for-byte.
 */
export function notifyUsageError(ctx: ExtensionContext, message: string, usageBlock: string): void {
  ctx.ui.notify(`${message}\n\n${usageBlock}`, "error");
}
