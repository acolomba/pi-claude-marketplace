// bridges/hooks/exec-result.ts
//
// HookExecResult discriminated-union outcome type for the hooks bridge
// (D-60-01).
//
// The wire-protocol parser (`./wire-protocol.ts`) maps a child process's
// exit code + stdout + stderr to one of four arms; the dispatch fold
// (`./dispatch.ts`) combines the arms of every matching hook and calls a
// per-Pi-event adapter (D-60-03). The four-arm union expresses
// outcome-as-data: an entry that blocks cannot ALSO mutate; an entry that
// mutates cannot ALSO stop.
//
//   - `noop`   -- entry ran, no structural effect on the Pi event surface.
//                 `suppressOutput` is the upstream Claude-shaped opt-out
//                 from echoing the hook's stdout to the user.
//   - `block`  -- entry refuses the operation. `reason` is a parsed
//                 `decision: "block"` / `permissionDecision: "deny"`
//                 reason, or the trimmed stderr of an exit 2. A deny applies
//                 at any exit code (D-CF5-11). `fromStderr` marks a stderr
//                 reason, which Claude Code shows after the hook's bracketed
//                 command (`[<command>]: <stderr>`); a JSON reason and an
//                 onFailure block carry no marker.
//   - `mutate` -- entry transforms the input/output. The wide field set
//                 covers every per-event mutate shape Claude documents
//                 (PreToolUse permission + input, PostToolUse output,
//                 UserPromptSubmit additionalContext); the per-event
//                 adapter narrows to the right Pi-side mutation.
//   - `stop`   -- entry signals end-of-chain via Claude's
//                 `continue: false` body.
//
// Every arm may also carry the hook's outputs, whatever it decided: its
// `additionalContext` (D-CF5-13) and its `systemMessage` (D-CF5-14). Claude
// Code keeps both on a block too, so a denied tool call still sends its
// context. The fold in `./dispatch.ts` joins every hook's context in routing
// order and keeps each hook's outcome, with its `systemMessage`, for the
// output carriers.
//
// The union is a pure leaf -- no imports, no module-level state. NFR-7
// (discriminated unions + exhaustive `kind` switches with no default arm)
// drives the shape: any future arm requires updating every `kind`-switch
// consumer.

/**
 * D-60-01: four-arm discriminated outcome type. Every wire-protocol parse
 * and every dispatch fold resolves to exactly one of these arms; the
 * `kind` discriminator drives per-event adapter dispatch downstream.
 */
export type HookExecResult =
  | { kind: "noop"; suppressOutput?: boolean; additionalContext?: string; systemMessage?: string }
  | {
      kind: "block";
      reason?: string;
      fromStderr?: true;
      additionalContext?: string;
      systemMessage?: string;
    }
  | {
      kind: "mutate";
      updatedInput?: unknown;
      updatedToolOutput?: unknown;
      additionalContext?: string;
      permissionDecision?: "allow" | "deny" | "ask";
      permissionDecisionReason?: string;
      systemMessage?: string;
    }
  | { kind: "stop"; stopReason?: string; additionalContext?: string; systemMessage?: string };
