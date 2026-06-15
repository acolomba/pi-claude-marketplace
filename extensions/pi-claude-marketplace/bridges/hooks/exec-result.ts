// bridges/hooks/exec-result.ts
//
// HookExecResult discriminated-union outcome type for the hooks bridge
// (D-60-01).
//
// The wire-protocol parser (`./wire-protocol.ts`) maps a child process's
// exit code + stdout + stderr to one of four arms; the dispatch reducer
// (lands in a follow-up plan) folds a sequence of arms across the
// composite handler's bucket and ultimately calls a per-Pi-event adapter
// (D-60-03). The four-arm union expresses outcome-as-data: an entry that
// blocks cannot ALSO mutate; an entry that mutates cannot ALSO stop.
//
//   - `noop`   -- entry ran, no structural effect on the Pi event surface.
//                 `suppressOutput` is the upstream Claude-shaped opt-out
//                 from echoing the hook's stdout to the user.
//   - `block`  -- entry refuses the operation. `reason` flows to the user
//                 via the per-Pi-event adapter (exit-2 stderr trimmed, or
//                 a parsed `decision: "block"` / `permissionDecision:
//                 "deny"` body).
//   - `mutate` -- entry transforms the input/output. The wide field set
//                 covers every per-event mutate shape Claude documents
//                 (PreToolUse permission + input, PostToolUse output,
//                 UserPromptSubmit additionalContext); the per-event
//                 adapter narrows to the right Pi-side mutation.
//   - `stop`   -- entry signals end-of-chain via Claude's
//                 `continue: false` body. The reducer short-circuits the
//                 remaining bucket; the per-Pi-event adapter has no
//                 stop-shaped Pi return for v1.13 events (debug-logged).
//
// The union is a pure leaf -- no imports, no module-level state. NFR-7
// (discriminated unions + assertNever exhaustiveness gate) drives the
// shape: any future arm requires updating every `kind`-switch consumer.

/**
 * D-60-01: four-arm discriminated outcome type. Every wire-protocol parse
 * and every reducer fold resolves to exactly one of these arms; the
 * `kind` discriminator drives per-event adapter dispatch downstream.
 */
export type HookExecResult =
  | { kind: "noop"; suppressOutput?: boolean }
  | { kind: "block"; reason?: string }
  | {
      kind: "mutate";
      updatedInput?: unknown;
      updatedToolOutput?: unknown;
      additionalContext?: string;
      permissionDecision?: "allow" | "deny" | "ask";
      permissionDecisionReason?: string;
    }
  | { kind: "stop"; stopReason?: string };

/**
 * Exhaustiveness gate for `HookExecResult` switch statements. Reaching
 * this call site at runtime means a new arm was added without updating
 * the consumer; the compile-time `never` parameter additionally fails
 * `tsc` so the gap is caught before CI. NFR-7 pattern.
 */
export function assertNever(x: never): never {
  throw new Error(`unreachable HookExecResult arm: ${JSON.stringify(x)}`);
}
