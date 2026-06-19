// bridges/hooks/spawn-helpers.ts
//
// Cross-site spawn primitives shared by `dispatch-exec.ts` (the
// synchronous bucket-A dispatch path) and `async-rewake/registry.ts`
// (the EXEC-05 async-rewake replay path). Both sites translate the same
// `RoutingEntry` shape into a `child_process.spawn` invocation and both
// serialize the same stdin payload under the EXEC-02 256 KB cap.
//
// Living here so the two call sites cannot drift on the exec-form vs
// shell-form discriminator (EXEC-04: `args` field presence, NOT
// emptiness) and on the truncation marker placement (WR-02: assign
// `_truncated: true` LAST so a payload-supplied key cannot win).

import type { RoutingEntry } from "./event-router.ts";

/** EXEC-02 stdin cap. */
export const STDIN_TRUNCATION_BYTES = 256 * 1024;

export interface SpawnPlan {
  readonly command: string;
  readonly args: readonly string[];
  readonly shell: boolean | string;
}

/**
 * EXEC-04: `entry.handlerDecl.args !== undefined` -> exec-form
 * `spawn(command, args, { shell: false })`. Otherwise -> shell-form
 * `spawn(command, [], { shell: entry.handlerDecl.shell ?? true })`.
 * `args: []` is the exec-form arm -- the discriminator is "args defined",
 * not "args non-empty".
 */
export function planSpawn(entry: RoutingEntry): SpawnPlan {
  const command = entry.handlerDecl.command ?? "";
  const argsField = entry.handlerDecl.args;

  if (Array.isArray(argsField)) {
    const args: string[] = (argsField as readonly unknown[]).map((a): string =>
      typeof a === "string" ? a : JSON.stringify(a),
    );
    return { command, args, shell: false };
  }

  const shellField = entry.handlerDecl.shell;
  const shell: boolean | string = typeof shellField === "string" ? shellField : true;
  return { command, args: [], shell };
}

/**
 * EXEC-02: cap the serialized stdin payload at `STDIN_TRUNCATION_BYTES`.
 * When the raw JSON exceeds the cap, re-serialize with a top-level
 * `_truncated: true` marker -- the marker takes precedence over the cap,
 * so the JSON with the marker may itself exceed the cap by a few bytes
 * (marker overshoot <= 20 bytes by construction).
 *
 * CR-02: cap comparison measures UTF-8 bytes (`Buffer.byteLength`), not
 * UTF-16 code units (`String.prototype.length`). For ASCII payloads they
 * are equal; for multi-byte payloads the byte count is 2-4x the
 * code-unit count, so measuring code units would silently relax the
 * documented 256 KB stdin cap.
 *
 * WR-02: the `_truncated: true` marker is assigned LAST so a payload key
 * named `_truncated` cannot override it via spread order (defense in
 * depth; no v1.13 translator emits this key today).
 */
export function serializeWithTruncation(payload: unknown): string {
  const raw = JSON.stringify(payload);
  if (Buffer.byteLength(raw, "utf8") <= STDIN_TRUNCATION_BYTES) {
    return raw;
  }

  // Inject the top-level marker by re-wrapping. When the payload is a
  // plain object (the only shape the 8 translators emit), assign the
  // marker AFTER the spread so a payload-supplied `_truncated` key
  // cannot win.
  if (payload !== null && typeof payload === "object" && !Array.isArray(payload)) {
    const marked: Record<string, unknown> = { ...(payload as Record<string, unknown>) };
    marked._truncated = true;
    return JSON.stringify(marked);
  }

  // Defensive arm: non-object payloads (shouldn't happen for v1.13
  // translators) get wrapped under a synthetic envelope so the marker
  // is still observable at the top level.
  return JSON.stringify({ payload, _truncated: true });
}
