// persistence/config-io.ts
//
// CONFIG_SCHEMA (CFG-01) + loadConfig (CFG-03 / D-15 trichotomy) +
// saveConfig (NFR-1 / NFR-10 / SPLIT-02 write-site enforcement).
//
// Mirror of `persistence/state-io.ts` for the user-authored declarative
// config file `claude-plugins.json` (+ entry-level override
// `claude-plugins.local.json`). Where state-io owns the MACHINE bookkeeping
// (materialized artefact records, resolved versions), config-io owns the
// USER-AUTHORED desired state -- and inverts state-io's load shape: instead
// of throwing on bad input and defaulting on missing input, `loadConfig`
// returns a discriminated `ConfigLoadResult` union so the downstream
// reconciler can distinguish absent / invalid / valid and abort cleanly on
// bad input rather than silently coercing it to empty desired state.
//
// A 0-byte file lands in JSON.parse failure -> invalid, NEVER
// valid-with-empty-defaults. NO try/catch+default anywhere in this file.
//
// SPLIT-02: `saveConfig` runs `assertPathInside(scopeRoot,
// filePath, ...)` BEFORE `atomicWriteJson`. PathContainmentError propagates
// loudly per shared/path-safety.ts semantics; we do NOT catch it.
//
// D-02: `source` is a raw `Type.String()`; the semantic gate
// (`parsePluginSource`) runs at downstream consume time (planner / apply), not
// inside this schema. D-09: schema is lenient by default -- typebox
// `Type.Object` accepts unknown extra keys; we do NOT add the
// extra-property-forbidding directive anywhere. D-11: `schemaVersion` is
// optional and locked to `Type.Literal(1)`.

import { readFile } from "node:fs/promises";

import Type from "typebox";
import { Compile } from "typebox/compile";

import { atomicWriteJson } from "../shared/atomic-json.ts";
import { errorMessage } from "../shared/errors.ts";
import { assertPathInside } from "../shared/path-safety.ts";

/**
 * D-02 / D-04: per-marketplace config entry. `source` is the raw user-typed
 * string (e.g. `"acme/claude-tools"` or `"./local-mp"`); classification into
 * github/path/url/etc. happens at downstream consume time. `autoupdate` is
 * optional -- defaults are applied by the consumer, NOT at load.
 */
export const MARKETPLACE_CONFIG_ENTRY_SCHEMA = Type.Object({
  source: Type.String(),
  autoupdate: Type.Optional(Type.Boolean()),
});

/**
 * D-04 / D-06: per-plugin config entry. `enabled` is optional (defaults
 * applied at consume time). No `version` field per D-06 -- versions are a
 * machine fact owned by `state.json`.
 */
export const PLUGIN_CONFIG_ENTRY_SCHEMA = Type.Object({
  enabled: Type.Optional(Type.Boolean()),
});

/**
 * CFG-01 / D-05 / D-11: top-level config shape.
 *   - `schemaVersion`: Optional literal 1 (D-11; future versions land in a
 *     successor file, not by bumping this literal).
 *   - `marketplaces` / `plugins`: both Optional Records (D-05); absent is
 *     legal (means "no declarations"), distinct from present-but-empty.
 *
 * D-09 (lenient): typebox's default for `Type.Object` accepts unknown extra
 * keys at the top level AND inside each entry. We do NOT add the
 * extra-property-forbidding directive anywhere -- a user-authored typo or a
 * forward-compatible new key does NOT fail validation.
 */
export const CONFIG_SCHEMA = Type.Object({
  schemaVersion: Type.Optional(Type.Literal(1)),
  marketplaces: Type.Optional(Type.Record(Type.String(), MARKETPLACE_CONFIG_ENTRY_SCHEMA)),
  plugins: Type.Optional(Type.Record(Type.String(), PLUGIN_CONFIG_ENTRY_SCHEMA)),
});

export type ScopeConfig = Type.Static<typeof CONFIG_SCHEMA>;
export type MarketplaceConfigEntry = Type.Static<typeof MARKETPLACE_CONFIG_ENTRY_SCHEMA>;
export type PluginConfigEntry = Type.Static<typeof PLUGIN_CONFIG_ENTRY_SCHEMA>;

/**
 * S7 (PR #51): consume-time tri-state predicate for the optional `enabled`
 * field. D-04 declares `enabled === false` excludes; everything else (literal
 * `true` OR an absent field) includes. Consumers should call this helper
 * instead of repeating the `entry.enabled !== false` comparison so the
 * "absent means enabled" semantics live in ONE place.
 */
export function isDeclaredEnabled(entry: PluginConfigEntry): boolean {
  return entry.enabled !== false;
}

/** JIT-compiled validator (D-07 mirror of STATE_VALIDATOR). */
export const CONFIG_VALIDATOR = Compile(CONFIG_SCHEMA);

/** Format the first validator error into a single-line message. */
function firstConfigValidationErrorDetail(value: unknown): string {
  const errors = CONFIG_VALIDATOR.Errors(value);
  const first = errors[0];
  if (!first) {
    return "(no detail available)";
  }

  return `${first.instancePath || "<root>"}: ${first.message}`;
}

/**
 * D-15 / CFG-03: discriminated trichotomy returned by `loadConfig`. The
 * reconcile planner narrows on `status` and aborts on `invalid` rather than
 * coercing it to empty desired state.
 *   - `absent`: file does not exist (ENOENT). NOT an error.
 *   - `invalid`: read I/O failure, JSON parse failure, or schema validation
 *     failure. The 0-byte case lands here via JSON parse.
 *   - `valid`: file read, parsed, and schema-validated.
 */
export type ConfigLoadResult =
  | { readonly status: "absent" }
  | { readonly status: "invalid"; readonly filePath: string; readonly error: string }
  | { readonly status: "valid"; readonly filePath: string; readonly config: ScopeConfig };

/**
 * CFG-03 / D-15: load a per-scope config file as a discriminated result.
 *
 * NEVER throws on missing, malformed, or schema-invalid input -- every
 * failure mode is encoded into the returned union. A 0-byte file lands in
 * JSON.parse failure (Node's `JSON.parse("")` throws
 * `SyntaxError: Unexpected end of JSON input`) and therefore in the
 * `invalid` arm, NOT in `absent` or `valid` with empty defaults.
 */
export async function loadConfig(filePath: string): Promise<ConfigLoadResult> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { status: "absent" };
    }

    return {
      status: "invalid",
      filePath,
      error: `read failed: ${errorMessage(err)}`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      status: "invalid",
      filePath,
      error: `JSON parse failed: ${errorMessage(err)}`,
    };
  }

  if (!CONFIG_VALIDATOR.Check(parsed)) {
    return {
      status: "invalid",
      filePath,
      error: `schema validation failed: ${firstConfigValidationErrorDetail(parsed)}`,
    };
  }

  return { status: "valid", filePath, config: parsed };
}

/**
 * CFG-01 / NFR-1 / NFR-10 / SPLIT-02: atomic config write with write-site
 * containment.
 *
 * Order is load-bearing:
 *   1. `CONFIG_VALIDATOR.Check(config)` -- a caller bug (mutated config into
 *      an invalid shape) surfaces here, not on disk. Message format mirrors
 *      `saveState refused: ...` modulo the function name.
 *   2. `await assertPathInside(scopeRoot, filePath, "saveConfig")` --
 *      SPLIT-02 write-site enforcement. PathContainmentError
 *      propagates loudly per the shared seam's PI-14 contract; we do NOT
 *      catch it.
 *   3. `await atomicWriteJson(filePath, config)` -- the single sanctioned
 *      JSON-write seam per NFR-1.
 */
export async function saveConfig(
  filePath: string,
  config: ScopeConfig,
  scopeRoot: string,
): Promise<void> {
  if (!CONFIG_VALIDATOR.Check(config)) {
    throw new Error(
      `saveConfig refused: in-memory config failed schema validation: ${firstConfigValidationErrorDetail(config)}`,
    );
  }

  await assertPathInside(scopeRoot, filePath, "saveConfig");
  await atomicWriteJson(filePath, config);
}
