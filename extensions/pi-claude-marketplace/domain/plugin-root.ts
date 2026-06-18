// domain/plugin-root.ts
//
// Branded `AbsolutePluginRoot` type for the security-relevant plugin source
// path that flows from state.json -> CacheEntry -> RoutingEntry -> the
// `CLAUDE_PLUGIN_ROOT` env var on every dispatched hook subprocess.
//
// The schema validates `resolvedSource` as `Type.String()` (NFR-7's
// installable-vs-non-installable union does not constrain its shape). An
// empty, relative, or traversal-containing string would flow through to
// the subprocess silently. This brand pins runtime invariants
// (non-empty + absolute + no null byte + no traversal segment) at the
// state-IO load boundary and at every cache-mutator entrypoint.

import path from "node:path";

declare const __absolutePluginRootBrand: unique symbol;

/**
 * String narrowed to "validated absolute plugin root path". Constructed
 * only by `asAbsolutePluginRoot`. Type-system marker; the runtime value
 * is the underlying string.
 */
export type AbsolutePluginRoot = string & { readonly [__absolutePluginRootBrand]: never };

/**
 * Validate and brand a string as an absolute plugin root path. Throws
 * with a descriptive message on any of:
 *   - empty string
 *   - null byte (POSIX/Windows path-truncation vector)
 *   - not absolute (`path.isAbsolute` -- handles both `/` and `C:\` shapes)
 *   - any normalized segment equals `..` (post-normalize traversal)
 *
 * Idempotent: callers can wrap an already-branded value without effect.
 */
export function asAbsolutePluginRoot(value: string): AbsolutePluginRoot {
  if (value.length === 0) {
    throw new Error("AbsolutePluginRoot: empty string");
  }

  if (value.includes("\0")) {
    throw new Error("AbsolutePluginRoot: contains null byte");
  }

  if (!path.isAbsolute(value)) {
    throw new Error(`AbsolutePluginRoot: not absolute: ${value}`);
  }

  const normalized = path.normalize(value);
  if (normalized.split(path.sep).includes("..")) {
    throw new Error(`AbsolutePluginRoot: traversal segment: ${value}`);
  }

  return value as AbsolutePluginRoot;
}
