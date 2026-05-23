import { causeChainTrailer } from "./errors.ts";

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
 *
 * SANCTIONED WRAPPERS (CMC-19 Phase 12 affirmation, governed by style guide
 * §10 MSG-SR-1..7):
 *
 *   (§10 numbering: MSG-SR-1..3 govern single-shot severity routing -- one
 *    rule per wrapper for the non-cascade case; MSG-SR-4..6 govern cascade
 *    summary routing -- those rules pick BETWEEN notifySuccess and
 *    notifyWarning for cascade summaries and never assign to notifyError or
 *    notifyUsageError; MSG-SR-7 is the dedicated usage-error rule routing to
 *    notifyUsageError.)
 *
 *   - notifySuccess(ctx, message)                -- default severity (MSG-SR-1; cascade variant MSG-SR-4)
 *   - notifyWarning(ctx, message)                -- "warning" severity (MSG-SR-2; cascade variant MSG-SR-5; MSG-SR-6 forbids cascade notifyError)
 *   - notifyError(ctx, message, cause?)          -- "error" severity (MSG-SR-3)
 *   - notifyUsageError(ctx, message, usageBlock) -- "error" severity (MSG-SR-7)
 *
 * Phase 13 composers return strings that flow VERBATIM into these wrappers;
 * no fifth wrapper, no structured-payload arg, no cascade-summary helper is
 * added (D-CMC-11). Severity remains structural via the wrapper name --
 * never embedded as a "[error]" / "[warning]" prefix in message text
 * (PRD §6.12 ES-2, reaffirmed by MSG-SR-7).
 *
 * Import path (D-CMC-13): callers import the wrappers directly from this
 * file (e.g., `import { notifySuccess } from "../../shared/notify.ts"`). No
 * presentation/ barrel re-exports the wrappers in Phase 12; the existing
 * direct-import path is the stable surface.
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
 * Error notify -- operation did not succeed; state unchanged or fully rolled
 * back. Optional `cause` feeds Error.cause for the depth-5 MSG-CC-1 walk; the
 * trailer is appended automatically with a blank-line separator
 * (`${message}\n\n${trailer}`), matching the MSG-RH-1 blank-line discipline.
 *
 * D-CMC-12 (Phase 13): this body replaces the Phase 6 placeholder that
 * surfaced the cause as `\nCause: <message>`. The depth-5 walker lives in
 * `shared/errors.ts::causeChainTrailer` (re-exported from
 * `presentation/cause-chain.ts` for presentation-layer consumers); orchestrators
 * pass bare `err` here and let `notifyError` compose the trailer once, retiring
 * the legacy per-callsite pre-format-then-pass-as-message wrapping.
 *
 * NFR-9 / T-13-05 invariant: the trailer surfaces ONLY `Error.message` (or
 * `string` verbatim or `Object.prototype.toString.call` fallback for non-Error
 * causes). No `.stack`, no absolute paths. Callers that need to expose a path
 * must put it in `message` deliberately. Depth bound 5 prevents cycle DoS
 * (T-13-04) via the walker's cycle-detection inside `shared/errors.ts`.
 */
export function notifyError(ctx: ExtensionContext, message: string, cause?: unknown): void {
  const trailer = cause === undefined ? "" : causeChainTrailer(cause);
  const body = trailer === "" ? message : `${message}\n\n${trailer}`;
  ctx.ui.notify(body, "error");
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
