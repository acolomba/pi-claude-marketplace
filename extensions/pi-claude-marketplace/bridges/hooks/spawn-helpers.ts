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

import type { RoutingEntry } from "./routing-state.ts";

/** EXEC-02 stdin cap. */
const STDIN_TRUNCATION_BYTES = 256 * 1024;

const TRUNCATION_MARKER_JSON = '"_truncated":true';

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
 * When the raw JSON exceeds the cap, retain as much top-level data as fits
 * beside an authoritative `_truncated: true` marker. The final serialized
 * value, including that marker, never exceeds the cap.
 *
 * CR-02: cap comparison measures UTF-8 bytes (`Buffer.byteLength`), not
 * UTF-16 code units (`String.prototype.length`). For ASCII payloads they
 * are equal; for multi-byte payloads the byte count is 2-4x the
 * code-unit count, so measuring code units would silently relax the
 * documented 256 KB stdin cap.
 *
 * WR-02: the `_truncated: true` marker is serialized LAST so a payload key
 * named `_truncated` cannot override it (defense in depth; no v1.13
 * translator emits this key today).
 */
export function serializeWithTruncation(payload: unknown): string {
  const raw = JSON.stringify(payload);
  if (Buffer.byteLength(raw, "utf8") <= STDIN_TRUNCATION_BYTES) {
    return raw;
  }

  const parsed = JSON.parse(raw) as unknown;
  if (Array.isArray(parsed)) {
    return serializeBoundedArray(parsed);
  }

  if (parsed !== null && typeof parsed === "object") {
    return serializeBoundedObject(parsed as Record<string, unknown>);
  }

  // An oversized JSON primitive can only be a string. Keep the defensive
  // envelope used by the prior implementation, but bound its string value.
  return serializeBoundedPrimitive(parsed as string);
}

function serializeBoundedArray(payload: readonly unknown[]): string {
  const prefix = '{"payload":[';
  const suffix = `],${TRUNCATION_MARKER_JSON}}`;
  const parts: string[] = [];
  let partsBytes = 0;

  for (const value of payload) {
    const serialized = JSON.stringify(value);
    const nextCount = parts.length + 1;
    const nextBytes =
      Buffer.byteLength(prefix, "utf8") +
      partsBytes +
      Buffer.byteLength(serialized, "utf8") +
      (nextCount - 1) +
      Buffer.byteLength(suffix, "utf8");

    if (nextBytes <= STDIN_TRUNCATION_BYTES) {
      parts.push(serialized);
      partsBytes += Buffer.byteLength(serialized, "utf8");
      continue;
    }

    if (typeof value === "string") {
      const bounded = largestFittingString(value, (candidate): string => {
        const candidateParts = [...parts, JSON.stringify(candidate)];
        return `${prefix}${candidateParts.join(",")}${suffix}`;
      });
      if (bounded !== undefined) {
        return bounded;
      }
    }

    break;
  }

  return `${prefix}${parts.join(",")}${suffix}`;
}

function serializeBoundedObject(payload: Readonly<Record<string, unknown>>): string {
  const entries = Object.entries(payload)
    .filter(([key]) => key !== "_truncated")
    .map(([key, value], index) => {
      const serialized = `${JSON.stringify(key)}:${JSON.stringify(value)}`;
      return { index, key, serialized, value };
    });
  const selected = new Map<number, string>();
  let selectedBytes = 0;

  const fits = (serialized: string): boolean =>
    2 +
      Buffer.byteLength(TRUNCATION_MARKER_JSON, "utf8") +
      selectedBytes +
      Buffer.byteLength(serialized, "utf8") +
      selected.size +
      1 <=
    STDIN_TRUNCATION_BYTES;

  // Keep every complete top-level field that fits before using the remaining
  // budget for a prefix of the first oversized string field.
  for (const entry of entries) {
    if (fits(entry.serialized)) {
      selected.set(entry.index, entry.serialized);
      selectedBytes += Buffer.byteLength(entry.serialized, "utf8");
    }
  }

  for (const entry of entries) {
    if (selected.has(entry.index) || typeof entry.value !== "string") {
      continue;
    }

    const keyJson = JSON.stringify(entry.key);
    const bounded = largestFittingString(entry.value, (candidate): string => {
      const candidateEntry = `${keyJson}:${JSON.stringify(candidate)}`;
      const next = new Map(selected);
      next.set(entry.index, candidateEntry);
      return serializeMarkedObject(entries, next);
    });
    if (bounded !== undefined) {
      return bounded;
    }
  }

  return serializeMarkedObject(entries, selected);
}

function serializeBoundedPrimitive(payload: string): string {
  const emptyEnvelope = JSON.stringify({ payload: "", _truncated: true });
  return largestFittingString(
    payload,
    (candidate): string => JSON.stringify({ payload: candidate, _truncated: true }),
    emptyEnvelope,
  );
}

function serializeMarkedObject(
  entries: readonly { readonly index: number }[],
  selected: ReadonlyMap<number, string>,
): string {
  const parts = entries.flatMap((entry) => {
    const serialized = selected.get(entry.index);
    return serialized === undefined ? [] : [serialized];
  });
  const serializedParts = parts.length === 0 ? "" : `${parts.join(",")},`;
  return `{${serializedParts}${TRUNCATION_MARKER_JSON}}`;
}

function largestFittingString(
  value: string,
  serialize: (candidate: string) => string,
  initialBest: string,
): string;
function largestFittingString(
  value: string,
  serialize: (candidate: string) => string,
): string | undefined;
function largestFittingString(
  value: string,
  serialize: (candidate: string) => string,
  initialBest?: string,
): string | undefined {
  let best = initialBest;
  let low = 0;
  let high = value.length;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const serialized = serialize(value.slice(0, middle));
    if (Buffer.byteLength(serialized, "utf8") <= STDIN_TRUNCATION_BYTES) {
      best = serialized;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return best;
}
