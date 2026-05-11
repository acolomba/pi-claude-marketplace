// domain/resolver.ts
//
// Plugin compatibility resolver. Returns the discriminated `ResolvedPlugin`
// union locked by NFR-7: TypeScript refuses to compile any code that reads
// `pluginRoot` from a non-installable variant.
//
// Per CONTEXT.md D-04: TWO distinct functions, no shared branching.
//   - resolveStrict (MM-5):   union of entry + manifest + implicit + standalone
//   - resolveLoose  (MM-6/7): entry-only; manifest/standalone declarations conflict
//
// Per RESEARCH.md Pitfall 1 (correction of CONTEXT.md D-04 wording):
//   Type.Union([...]) takes NO `discriminator` option in TypeBox 1.x.
//   Literal-tagged variants ARE the discriminator -- TypeScript narrowing
//   works automatically on `if (r.installable)`.
//
// Per RESEARCH.md correction of D-05 wording:
//   Use boolean-literal `installable: true | false` (PRD §6.4 verbatim),
//   NOT the string-tag form (e.g. kind discriminator).

import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import Type from "typebox";

import { PathContainmentError, assertPathInside } from "../shared/path-safety.ts";

import { MCP_SERVERS_VALIDATOR } from "./components/mcp.ts";
import { PLUGIN_MANIFEST_VALIDATOR, type PluginEntry } from "./components/plugin.ts";
import { assertSafeName } from "./name.ts";
import { parsePluginSource, type ParsedSource } from "./source.ts";

// ──────────────────────────────────────────────────────────────────────────
// Schema + types
// ──────────────────────────────────────────────────────────────────────────

// D-07 (COMP-01): array-per-kind shape. The resolver UNIONs declared
// (entry > manifest order) + implicit-by-convention paths with first-wins
// dedup; the array semantics let `componentPaths.skills` carry both the
// declared `custom/skills` and the conventional `skills` simultaneously
// (PR-4 short-circuit semantics SUPERSEDED -- docs deferred to Plan 05-10).
const ComponentPathsSchema = Type.Object({
  skills: Type.Array(Type.String()),
  commands: Type.Array(Type.String()),
  agents: Type.Array(Type.String()),
});

const McpServersFieldSchema = Type.Record(Type.String(), Type.Unknown());

const ResolvedPluginInstallableSchema = Type.Object({
  installable: Type.Literal(true),
  name: Type.String(),
  pluginRoot: Type.String(), // ONLY on installable variant (NFR-7)
  supported: Type.Array(Type.String()),
  unsupported: Type.Array(Type.String()),
  notes: Type.Array(Type.String()),
  componentPaths: ComponentPathsSchema,
  mcpServers: McpServersFieldSchema,
});

const ResolvedPluginNotInstallableSchema = Type.Object({
  installable: Type.Literal(false),
  name: Type.String(),
  supported: Type.Array(Type.String()),
  unsupported: Type.Array(Type.String()),
  notes: Type.Array(Type.String()), // PR-3: contains "contains <name>" entries
  componentPaths: ComponentPathsSchema,
  mcpServers: McpServersFieldSchema,
  // pluginRoot intentionally absent -- NFR-7 enforces non-readability
});

/** Pitfall 1: literal-tagged variants ARE the discriminator. NO options arg. */
export const ResolvedPluginSchema = Type.Union([
  ResolvedPluginInstallableSchema,
  ResolvedPluginNotInstallableSchema,
]);

export type ResolvedPluginInstallable = Type.Static<typeof ResolvedPluginInstallableSchema>;
export type ResolvedPluginNotInstallable = Type.Static<typeof ResolvedPluginNotInstallableSchema>;
export type ResolvedPlugin = Type.Static<typeof ResolvedPluginSchema>;

// ──────────────────────────────────────────────────────────────────────────
// Context (injectable for tests)
// ──────────────────────────────────────────────────────────────────────────

export interface ResolveContext {
  readonly marketplaceRoot: string;
  readonly readFileText?: (p: string) => Promise<string>;
  readonly statKind?: (p: string) => Promise<"file" | "dir" | null>;
}

async function defaultStatKind(p: string): Promise<"file" | "dir" | null> {
  try {
    const s = await stat(p);

    if (s.isDirectory()) {
      return "dir";
    }

    if (s.isFile()) {
      return "file";
    }

    return null;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw err;
  }
}

function statKindOf(ctx: ResolveContext): (p: string) => Promise<"file" | "dir" | null> {
  return ctx.statKind ?? defaultStatKind;
}

function readFileTextOf(ctx: ResolveContext): (p: string) => Promise<string> {
  return ctx.readFileText ?? ((p: string) => readFile(p, "utf8"));
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

const SUPPORTED_COMPONENT_KINDS = ["skills", "commands", "agents"] as const;
type SupportedKind = (typeof SUPPORTED_COMPONENT_KINDS)[number];

/**
 * PR-3: any of these kinds declared in entry OR manifest disqualifies install
 * with note `contains <kind>`.
 *
 * SECURITY (T-02-25): The list is closed. A new kind upstream that's neither
 * in SUPPORTED_COMPONENT_KINDS nor in this list would be silently ignored;
 * matches V1 behavior. Phase 7 review item: re-audit when Claude Code adds
 * new component kinds.
 */
const UNSUPPORTED_COMPONENT_KINDS = [
  "hooks",
  "lspServers",
  "monitors",
  "themes",
  "outputStyles",
  "channels",
  "userConfig",
  "bin",
  "settings",
] as const;

interface PartialResolution {
  supported: string[];
  unsupported: string[];
  notes: string[];
  componentPaths: { skills: string[]; commands: string[]; agents: string[] };
  mcpServers: Record<string, unknown>;
}

function emptyResolution(): PartialResolution {
  return {
    supported: [],
    unsupported: [],
    notes: [],
    componentPaths: { skills: [], commands: [], agents: [] },
    mcpServers: {},
  };
}

function notInstallable(
  name: string,
  partial: PartialResolution,
  additionalNotes: string[] = [],
): ResolvedPluginNotInstallable {
  return {
    installable: false,
    name,
    supported: partial.supported,
    unsupported: partial.unsupported,
    notes: [...partial.notes, ...additionalNotes],
    componentPaths: partial.componentPaths,
    mcpServers: partial.mcpServers,
  };
}

function installable(
  name: string,
  pluginRoot: string,
  partial: PartialResolution,
): ResolvedPluginInstallable {
  return {
    installable: true,
    name,
    pluginRoot,
    supported: partial.supported,
    unsupported: partial.unsupported,
    notes: partial.notes,
    componentPaths: partial.componentPaths,
    mcpServers: partial.mcpServers,
  };
}

/**
 * Steps 1-6 are shared between resolveStrict and resolveLoose. Returns
 * either:
 *   - { kind: "ok", pluginRoot, manifest, partial } -- proceed to mode-specific steps
 *   - { kind: "notInstallable", result }            -- short-circuit
 */
async function preflightStages(
  entry: PluginEntry,
  ctx: ResolveContext,
): Promise<
  | {
      kind: "ok";
      pluginRoot: string;
      manifest: Record<string, unknown> | null;
      partial: PartialResolution;
    }
  | { kind: "notInstallable"; result: ResolvedPluginNotInstallable }
> {
  const partial = emptyResolution();
  // Caller bug if name validation throws -- entry came through PLUGIN_ENTRY_VALIDATOR.
  assertSafeName(entry.name);

  // Classify source. PluginEntry.source is Type.Unknown() per MM-3.
  let parsedSource: ParsedSource;

  if (typeof entry.source === "string") {
    parsedSource = parsePluginSource(entry.source);
  } else if (
    typeof entry.source === "object" &&
    entry.source !== null &&
    "kind" in (entry.source as Record<string, unknown>)
  ) {
    // Already classified (e.g., loaded from state.json). Trust the kind tag.
    parsedSource = entry.source as ParsedSource;
  } else {
    return {
      kind: "notInstallable",
      result: notInstallable(entry.name, partial, [
        `source field is missing or has unrecognized shape`,
      ]),
    };
  }

  // PR-2 case 1: only path sources are installable in V1 (MM-3).
  if (parsedSource.kind !== "path") {
    const reason =
      parsedSource.kind === "unknown"
        ? `unsupported source kind: unknown (${parsedSource.reason})`
        : `unsupported source kind: ${parsedSource.kind}`;
    return {
      kind: "notInstallable",
      result: notInstallable(entry.name, partial, [reason]),
    };
  }

  // PR-2 case 2: source path escape.
  const pluginRoot = path.resolve(ctx.marketplaceRoot, parsedSource.raw);

  try {
    await assertPathInside(
      ctx.marketplaceRoot,
      pluginRoot,
      `plugin source path "${parsedSource.raw}"`,
    );
  } catch (err) {
    if (err instanceof PathContainmentError) {
      return {
        kind: "notInstallable",
        result: notInstallable(entry.name, partial, [
          `source path escapes marketplace root: ${parsedSource.raw}`,
        ]),
      };
    }

    throw err;
  }

  // PR-2 case 3: source dir does not exist.
  if ((await statKindOf(ctx)(pluginRoot)) !== "dir") {
    return {
      kind: "notInstallable",
      result: notInstallable(entry.name, partial, [`source dir does not exist: ${pluginRoot}`]),
    };
  }

  // PR-2 case 4: malformed plugin.json (best-effort -- absence is OK).
  let manifest: Record<string, unknown> | null = null;
  const manifestPath = path.join(pluginRoot, ".claude-plugin", "plugin.json");

  if ((await statKindOf(ctx)(manifestPath)) === "file") {
    try {
      const raw = await readFileTextOf(ctx)(manifestPath);
      const parsed: unknown = JSON.parse(raw);

      if (!PLUGIN_MANIFEST_VALIDATOR.Check(parsed)) {
        const firstErr = PLUGIN_MANIFEST_VALIDATOR.Errors(parsed)[0];
        const detail = firstErr
          ? `${firstErr.instancePath || "(root)"}: ${firstErr.message}`
          : "(no detail)";
        return {
          kind: "notInstallable",
          result: notInstallable(entry.name, partial, [`malformed plugin.json: ${detail}`]),
        };
      }

      manifest = parsed;
    } catch (err) {
      return {
        kind: "notInstallable",
        result: notInstallable(entry.name, partial, [
          `malformed plugin.json: ${err instanceof Error ? err.message : String(err)}`,
        ]),
      };
    }
  }

  return { kind: "ok", pluginRoot, manifest, partial };
}

/**
 * D-07 helper: normalize an untrusted entry / manifest `componentPaths.<kind>`
 * field into a flat readonly string-or-other-element array. The element-level
 * `validateComponentPath` call rejects non-string elements (and nested arrays);
 * we deliberately keep `unknown` typing on each element here so the rejection
 * messaging stays consistent with the V1-shape PR-2 case 7 path.
 *
 * - `undefined` / `null` -> `[]` (not declared)
 * - a single string       -> `[string]`
 * - an array              -> the array as-is (element-level validation later)
 * - any other shape       -> `[value]` (forces validateComponentPath to emit
 *                            the "not a string" failure note for the caller)
 */
function readPathOrArray(value: unknown): readonly unknown[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  return [value];
}

/**
 * Validate a single component-path ELEMENT. Returns `{ ok: true, relative }`
 * on success (caller adds to componentPaths + supported), or
 * `{ ok: false, reason }` on failure (caller adds note + flips notInstallable).
 *
 * D-07 narrowing: the resolver now accepts a top-level array of strings as
 * legal input (the schema is `Type.Array(Type.String())`). Callers MUST
 * normalize their raw inputs through `readPathOrArray` BEFORE handing each
 * element to this function. Per-element non-string / nested-array values
 * are still rejected here (the schema-level guard does not survive the
 * `as unknown` coercion that the resolver uses to read untrusted entry /
 * manifest fields).
 */
async function validateComponentPath(
  kind: SupportedKind,
  raw: unknown,
  pluginRoot: string,
): Promise<{ ok: true; relative: string } | { ok: false; reason: string }> {
  // D-07: nested arrays are still rejected at the element level. Top-level
  // arrays are handled by `readPathOrArray` BEFORE this function is called.
  if (Array.isArray(raw)) {
    return {
      ok: false,
      reason: `component path for "${kind}" contains nested array element; must be a string`,
    };
  }

  // PR-2 case 7: non-string is rejected.
  if (typeof raw !== "string") {
    return {
      ok: false,
      reason: `component path for "${kind}" is not a string (got ${typeof raw})`,
    };
  }

  // PS-3: must be relative.
  if (path.isAbsolute(raw)) {
    return {
      ok: false,
      reason: `component path for "${kind}" must be relative (got absolute "${raw}")`,
    };
  }

  // PR-2 case 8: must not escape pluginRoot.
  const candidate = path.resolve(pluginRoot, raw);

  try {
    await assertPathInside(pluginRoot, candidate, `component path "${kind}"`);
  } catch (err) {
    if (err instanceof PathContainmentError) {
      return { ok: false, reason: `component path for "${kind}" escapes plugin root: "${raw}"` };
    }

    throw err;
  }

  return { ok: true, relative: raw };
}

/**
 * MM-5 strict: union of entry + manifest + implicit-by-convention + standalone-file
 * declarations.
 */
export async function resolveStrict(
  entry: PluginEntry,
  ctx: ResolveContext,
): Promise<ResolvedPlugin> {
  const pre = await preflightStages(entry, ctx);

  if (pre.kind === "notInstallable") {
    return pre.result;
  }

  const { pluginRoot, manifest, partial } = pre;
  let dirty = false; // any "notInstallable" reason found in steps 7-9

  // Step 7 (MM-5 + D-07/COMP-01): component paths are the UNION of declared
  // (entry > manifest order) + implicit-by-convention. PR-4 is SUPERSEDED:
  // implicit-by-convention is ADDITIVE rather than fallback-only -- if the
  // conventional dir exists on disk and is not already declared, it is
  // appended to the array. First-wins dedup by relative-path string preserves
  // ordering (declared first, implicit last).
  for (const kind of SUPPORTED_COMPONENT_KINDS) {
    const seenPaths = new Set<string>();

    const fromEntry = readPathOrArray((entry as Record<string, unknown>)[kind]);
    const fromManifest = readPathOrArray(manifest?.[kind]);

    for (const raw of [...fromEntry, ...fromManifest]) {
      const v = await validateComponentPath(kind, raw, pluginRoot);

      if (v.ok) {
        if (!seenPaths.has(v.relative)) {
          seenPaths.add(v.relative);
          partial.componentPaths[kind].push(v.relative);
        }
      } else {
        partial.notes.push(v.reason);
        dirty = true;
      }
    }

    // Implicit-by-convention: fires whenever the conventional dir exists,
    // regardless of declared inputs (D-07 SUPPLEMENT semantics). Dedup
    // against already-declared paths preserves declared-first ordering.
    const conventionalRel = kind; // "skills" / "commands" / "agents"
    if ((await statKindOf(ctx)(path.join(pluginRoot, conventionalRel))) === "dir") {
      if (!seenPaths.has(conventionalRel)) {
        partial.componentPaths[kind].push(conventionalRel);
        seenPaths.add(conventionalRel);
      }
    }

    if (partial.componentPaths[kind].length > 0) {
      partial.supported.push(kind);
    }
  }

  // Step 8 (MM-5): mcpServers union (entry > manifest > standalone .mcp.json).
  let mcp: unknown = (entry as Record<string, unknown>).mcpServers ?? manifest?.mcpServers;

  if (mcp === undefined) {
    const mcpPath = path.join(pluginRoot, ".mcp.json");

    if ((await statKindOf(ctx)(mcpPath)) === "file") {
      try {
        const raw = await readFileTextOf(ctx)(mcpPath);
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        // MC-2: accept both wrapped and unwrapped forms.
        mcp = "mcpServers" in parsed ? (parsed as { mcpServers: unknown }).mcpServers : parsed;
      } catch (err) {
        partial.notes.push(
          `malformed mcpServers (.mcp.json): ${err instanceof Error ? err.message : String(err)}`,
        );
        dirty = true;
      }
    }
  }

  if (mcp !== undefined) {
    if (MCP_SERVERS_VALIDATOR.Check(mcp)) {
      partial.mcpServers = mcp;
    } else {
      const firstErr = MCP_SERVERS_VALIDATOR.Errors(mcp)[0];
      partial.notes.push(`malformed mcpServers: ${firstErr ? firstErr.message : "shape mismatch"}`);
      dirty = true;
    }
  }

  // Step 9 (PR-3): unsupported components.
  for (const k of UNSUPPORTED_COMPONENT_KINDS) {
    if ((entry as Record<string, unknown>)[k] !== undefined || manifest?.[k] !== undefined) {
      partial.notes.push(`contains ${k}`);
      partial.unsupported.push(k);
      dirty = true;
    }
  }

  // Step 10 (PR-5): dependencies stay installable but get a note.
  if ((entry as Record<string, unknown>).dependencies !== undefined) {
    partial.notes.push(`declares dependencies that must be installed manually`);
  }

  return dirty ? notInstallable(entry.name, partial) : installable(entry.name, pluginRoot, partial);
}

/**
 * MM-6 / MM-7 loose: entry-only; manifest or standalone declarations conflict.
 */
export async function resolveLoose(
  entry: PluginEntry,
  ctx: ResolveContext,
): Promise<ResolvedPlugin> {
  const pre = await preflightStages(entry, ctx);

  if (pre.kind === "notInstallable") {
    return pre.result;
  }

  const { pluginRoot, manifest, partial } = pre;
  let dirty = false;

  // Step 7 (MM-6 entry-only, D-07 array shape): no implicit-by-convention;
  // manifest declarations without a matching entry-level declaration are a
  // conflict. Array shape mirrors strict mode, but with first-wins dedup
  // applied only to entry-declared paths (no convention probing).
  for (const kind of SUPPORTED_COMPONENT_KINDS) {
    const fromEntry = (entry as unknown as Record<string, unknown>)[kind];
    const fromManifest = manifest ? manifest[kind] : undefined;

    if (fromEntry !== undefined) {
      const seenPaths = new Set<string>();

      for (const raw of readPathOrArray(fromEntry)) {
        const v = await validateComponentPath(kind, raw, pluginRoot);

        if (v.ok) {
          if (!seenPaths.has(v.relative)) {
            seenPaths.add(v.relative);
            partial.componentPaths[kind].push(v.relative);
          }
        } else {
          partial.notes.push(v.reason);
          dirty = true;
        }
      }

      if (partial.componentPaths[kind].length > 0) {
        partial.supported.push(kind);
      }
    } else if (fromManifest !== undefined) {
      // MM-6: manifest declared but entry didn't -> conflict.
      partial.notes.push(
        `component declarations conflict: manifest declares "${kind}" but entry does not`,
      );
      dirty = true;
    }
    // No implicit-by-convention in loose mode.
  }

  // Step 8 (MM-7 loose mcpServers).
  const entryMcp = (entry as Record<string, unknown>).mcpServers;

  if (entryMcp !== undefined) {
    if (MCP_SERVERS_VALIDATOR.Check(entryMcp)) {
      partial.mcpServers = entryMcp;
    } else {
      partial.notes.push(`malformed mcpServers`);
      dirty = true;
    }
  } else {
    // MM-7: manifest or standalone .mcp.json without entry-level declaration -> conflict.
    const manifestMcp = manifest?.mcpServers;
    const standaloneExists = (await statKindOf(ctx)(path.join(pluginRoot, ".mcp.json"))) === "file";

    if (manifestMcp !== undefined || standaloneExists) {
      partial.notes.push(
        `component declarations conflict: manifest/standalone mcpServers without entry-level declaration`,
      );
      dirty = true;
    }
  }

  // Step 9 (PR-3): unsupported components -- same as strict.
  for (const k of UNSUPPORTED_COMPONENT_KINDS) {
    if ((entry as Record<string, unknown>)[k] !== undefined || manifest?.[k] !== undefined) {
      partial.notes.push(`contains ${k}`);
      partial.unsupported.push(k);
      dirty = true;
    }
  }

  // Step 10 (PR-5): dependencies stay installable but get a note.
  if ((entry as Record<string, unknown>).dependencies !== undefined) {
    partial.notes.push(`declares dependencies that must be installed manually`);
  }

  return dirty ? notInstallable(entry.name, partial) : installable(entry.name, pluginRoot, partial);
}

/**
 * PR-6: narrow to installable-or-throw. Used by Phase 5 install/update.
 */
export function requireInstallable(
  r: ResolvedPlugin,
  op: "install" | "update" = "install",
): asserts r is ResolvedPluginInstallable {
  if (!r.installable) {
    const verb = op === "update" ? "is no longer installable" : "is not installable";
    throw new Error(`Plugin "${r.name}" ${verb}: ${r.notes.join("; ")}`);
  }
}
