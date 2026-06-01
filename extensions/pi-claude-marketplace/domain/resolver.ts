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

import { PluginShapeError } from "../shared/errors.ts";
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
type StatKind = "file" | "dir" | null;
type StatKindReader = (p: string) => Promise<StatKind>;

// ──────────────────────────────────────────────────────────────────────────
// Context (injectable for tests)
// ──────────────────────────────────────────────────────────────────────────

export interface ResolveContext {
  readonly marketplaceRoot: string;
  readonly readFileText?: (p: string) => Promise<string>;
  readonly statKind?: StatKindReader;
}

async function defaultStatKind(p: string): Promise<StatKind> {
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

function statKindOf(ctx: ResolveContext): StatKindReader {
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
type UnsupportedKind = (typeof UNSUPPORTED_COMPONENT_KINDS)[number];

const UNSUPPORTED_COMPONENT_CONVENTIONS: Partial<
  Record<
    UnsupportedKind,
    readonly { readonly relativePath: string; readonly kind: "file" | "dir" }[]
  >
> = {
  hooks: [{ relativePath: path.join("hooks", "hooks.json"), kind: "file" }],
  lspServers: [{ relativePath: ".lsp.json", kind: "file" }],
  monitors: [{ relativePath: path.join("monitors", "monitors.json"), kind: "file" }],
  themes: [{ relativePath: "themes", kind: "dir" }],
  outputStyles: [{ relativePath: "output-styles", kind: "dir" }],
  bin: [{ relativePath: "bin", kind: "dir" }],
  settings: [{ relativePath: "settings.json", kind: "file" }],
};

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

function nestedExperimentalValue(
  record: Record<string, unknown> | null | undefined,
  key: string,
): unknown {
  const experimental = record?.experimental;
  if (typeof experimental !== "object" || experimental === null) {
    return undefined;
  }

  return (experimental as Record<string, unknown>)[key];
}

function declaresUnsupportedKind(
  kind: UnsupportedKind,
  entry: Record<string, unknown>,
  manifest: Record<string, unknown> | null,
): boolean {
  if (entry[kind] !== undefined || manifest?.[kind] !== undefined) {
    return true;
  }

  // Current Claude Code schema declares these experimental components under
  // `experimental.*`, while older manifests may still use top-level fields.
  if (kind === "themes" || kind === "monitors") {
    return (
      nestedExperimentalValue(entry, kind) !== undefined ||
      nestedExperimentalValue(manifest, kind) !== undefined
    );
  }

  return false;
}

async function hasUnsupportedConvention(
  ctx: ResolveContext,
  pluginRoot: string,
  kind: UnsupportedKind,
): Promise<boolean> {
  for (const convention of UNSUPPORTED_COMPONENT_CONVENTIONS[kind] ?? []) {
    if (
      (await statKindOf(ctx)(path.join(pluginRoot, convention.relativePath))) === convention.kind
    ) {
      return true;
    }
  }

  return false;
}

async function collectUnsupportedKinds(
  entry: Record<string, unknown>,
  manifest: Record<string, unknown> | null,
  pluginRoot: string,
  ctx: ResolveContext,
): Promise<UnsupportedKind[]> {
  const found: UnsupportedKind[] = [];

  for (const kind of UNSUPPORTED_COMPONENT_KINDS) {
    if (declaresUnsupportedKind(kind, entry, manifest)) {
      found.push(kind);
      continue;
    }

    if (await hasUnsupportedConvention(ctx, pluginRoot, kind)) {
      found.push(kind);
    }
  }

  return found;
}

function sourceUnsupportedReason(parsedSource: ParsedSource): string | undefined {
  if (parsedSource.kind === "path") {
    return undefined;
  }

  return parsedSource.kind === "unknown"
    ? `unsupported source kind: unknown (${parsedSource.reason})`
    : `unsupported source kind: ${parsedSource.kind}`;
}

async function sourceEscapeReason(
  ctx: ResolveContext,
  pluginRoot: string,
  rawSource: string,
): Promise<string | undefined> {
  try {
    await assertPathInside(ctx.marketplaceRoot, pluginRoot, `plugin source path "${rawSource}"`);
    return undefined;
  } catch (err) {
    if (err instanceof PathContainmentError) {
      return `source path escapes marketplace root: ${rawSource}`;
    }

    throw err;
  }
}

async function readManifest(
  ctx: ResolveContext,
  pluginRoot: string,
): Promise<{ ok: true; manifest: Record<string, unknown> | null } | { ok: false; reason: string }> {
  const manifestPath = path.join(pluginRoot, ".claude-plugin", "plugin.json");
  if ((await statKindOf(ctx)(manifestPath)) !== "file") {
    return { ok: true, manifest: null };
  }

  try {
    const raw = await readFileTextOf(ctx)(manifestPath);
    const parsed: unknown = JSON.parse(raw);

    if (!PLUGIN_MANIFEST_VALIDATOR.Check(parsed)) {
      const firstErr = PLUGIN_MANIFEST_VALIDATOR.Errors(parsed)[0];
      const detail = firstErr
        ? `${firstErr.instancePath || "(root)"}: ${firstErr.message}`
        : "(no detail)";
      return { ok: false, reason: `malformed plugin.json: ${detail}` };
    }

    return { ok: true, manifest: parsed };
  } catch (err) {
    return {
      ok: false,
      reason: `malformed plugin.json: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
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
  const parsedSource: ParsedSource = parsePluginSource(entry.source);

  // PR-2 case 1: only path sources are installable in V1 (MM-3).
  const unsupportedReason = sourceUnsupportedReason(parsedSource);
  if (unsupportedReason !== undefined) {
    return {
      kind: "notInstallable",
      result: notInstallable(entry.name, partial, [unsupportedReason]),
    };
  }

  // PR-2 case 2: source path escape.
  const pluginRoot = path.resolve(ctx.marketplaceRoot, parsedSource.raw);
  const escapeReason = await sourceEscapeReason(ctx, pluginRoot, parsedSource.raw);

  if (escapeReason !== undefined) {
    return {
      kind: "notInstallable",
      result: notInstallable(entry.name, partial, [escapeReason]),
    };
  }

  // PR-2 case 3: source dir does not exist.
  if ((await statKindOf(ctx)(pluginRoot)) !== "dir") {
    return {
      kind: "notInstallable",
      result: notInstallable(entry.name, partial, [`source dir does not exist: ${pluginRoot}`]),
    };
  }

  // PR-2 case 4: malformed plugin.json (best-effort -- absence is OK).
  const manifestResult = await readManifest(ctx, pluginRoot);
  if (!manifestResult.ok) {
    return {
      kind: "notInstallable",
      result: notInstallable(entry.name, partial, [manifestResult.reason]),
    };
  }

  return { kind: "ok", pluginRoot, manifest: manifestResult.manifest, partial };
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

function addComponentPath(
  partial: PartialResolution,
  kind: SupportedKind,
  seenPaths: Set<string>,
  relative: string,
): void {
  if (seenPaths.has(relative)) {
    return;
  }

  seenPaths.add(relative);
  partial.componentPaths[kind].push(relative);
}

async function addValidatedComponentPath(
  partial: PartialResolution,
  kind: SupportedKind,
  seenPaths: Set<string>,
  raw: unknown,
  pluginRoot: string,
): Promise<boolean> {
  const v = await validateComponentPath(kind, raw, pluginRoot);

  if (v.ok) {
    addComponentPath(partial, kind, seenPaths, v.relative);
    return false;
  }

  partial.notes.push(v.reason);
  return true;
}

async function collectStrictComponentKind(
  entry: PluginEntry,
  manifest: Record<string, unknown> | null,
  partial: PartialResolution,
  pluginRoot: string,
  ctx: ResolveContext,
  kind: SupportedKind,
): Promise<boolean> {
  let dirty = false;
  const seenPaths = new Set<string>();
  const fromEntry = readPathOrArray((entry as Record<string, unknown>)[kind]);
  const fromManifest = readPathOrArray(manifest?.[kind]);

  for (const raw of [...fromEntry, ...fromManifest]) {
    dirty = (await addValidatedComponentPath(partial, kind, seenPaths, raw, pluginRoot)) || dirty;
  }

  if ((await statKindOf(ctx)(path.join(pluginRoot, kind))) === "dir") {
    addComponentPath(partial, kind, seenPaths, kind);
  }

  if (partial.componentPaths[kind].length > 0) {
    partial.supported.push(kind);
  }

  return dirty;
}

async function readStandaloneMcp(
  ctx: ResolveContext,
  pluginRoot: string,
): Promise<{ ok: true; value: unknown } | { ok: false; reason: string }> {
  const mcpPath = path.join(pluginRoot, ".mcp.json");
  if ((await statKindOf(ctx)(mcpPath)) !== "file") {
    return { ok: true, value: undefined };
  }

  try {
    const raw = await readFileTextOf(ctx)(mcpPath);
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return { ok: true, value: "mcpServers" in parsed ? parsed.mcpServers : parsed };
  } catch (err) {
    return {
      ok: false,
      reason: `malformed mcpServers (.mcp.json): ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function applyMcpValue(partial: PartialResolution, mcp: unknown, detail = true): boolean {
  if (mcp === undefined) {
    return false;
  }

  if (MCP_SERVERS_VALIDATOR.Check(mcp)) {
    partial.mcpServers = mcp;
    return false;
  }

  if (detail) {
    const firstErr = MCP_SERVERS_VALIDATOR.Errors(mcp)[0];
    partial.notes.push(`malformed mcpServers: ${firstErr ? firstErr.message : "shape mismatch"}`);
  } else {
    partial.notes.push(`malformed mcpServers`);
  }

  return true;
}

async function applyStrictMcp(
  entry: PluginEntry,
  manifest: Record<string, unknown> | null,
  partial: PartialResolution,
  pluginRoot: string,
  ctx: ResolveContext,
): Promise<boolean> {
  const declaredMcp = (entry as Record<string, unknown>).mcpServers ?? manifest?.mcpServers;
  const mcpResult =
    declaredMcp === undefined ? await readStandaloneMcp(ctx, pluginRoot) : undefined;

  if (mcpResult?.ok === false) {
    partial.notes.push(mcpResult.reason);
    return true;
  }

  return applyMcpValue(partial, declaredMcp ?? mcpResult?.value);
}

async function collectLooseComponentKind(
  entry: PluginEntry,
  manifest: Record<string, unknown> | null,
  partial: PartialResolution,
  pluginRoot: string,
  kind: SupportedKind,
): Promise<boolean> {
  const fromEntry = (entry as Record<string, unknown>)[kind];
  const fromManifest = manifest?.[kind];

  if (fromEntry === undefined) {
    if (fromManifest === undefined) {
      return false;
    }

    partial.notes.push(
      `component declarations conflict: manifest declares "${kind}" but entry does not`,
    );
    return true;
  }

  let dirty = false;
  const seenPaths = new Set<string>();
  for (const raw of readPathOrArray(fromEntry)) {
    dirty = (await addValidatedComponentPath(partial, kind, seenPaths, raw, pluginRoot)) || dirty;
  }

  if (partial.componentPaths[kind].length > 0) {
    partial.supported.push(kind);
  }

  return dirty;
}

async function applyLooseMcp(
  entry: PluginEntry,
  manifest: Record<string, unknown> | null,
  partial: PartialResolution,
  pluginRoot: string,
  ctx: ResolveContext,
): Promise<boolean> {
  const entryMcp = (entry as Record<string, unknown>).mcpServers;

  if (entryMcp === undefined) {
    const manifestMcp = manifest?.mcpServers;
    const standaloneExists = (await statKindOf(ctx)(path.join(pluginRoot, ".mcp.json"))) === "file";

    if (manifestMcp === undefined && !standaloneExists) {
      return false;
    }

    partial.notes.push(
      `component declarations conflict: manifest/standalone mcpServers without entry-level declaration`,
    );
    return true;
  }

  return applyMcpValue(partial, entryMcp, false);
}

async function addUnsupportedKindNotes(
  entry: PluginEntry,
  manifest: Record<string, unknown> | null,
  pluginRoot: string,
  ctx: ResolveContext,
  partial: PartialResolution,
): Promise<boolean> {
  let dirty = false;
  for (const kind of await collectUnsupportedKinds(entry, manifest, pluginRoot, ctx)) {
    partial.notes.push(`contains ${kind}`);
    partial.unsupported.push(kind);
    dirty = true;
  }

  return dirty;
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
    dirty =
      (await collectStrictComponentKind(entry, manifest, partial, pluginRoot, ctx, kind)) || dirty;
  }

  // Step 8 (MM-5): mcpServers union (entry > manifest > standalone .mcp.json).
  dirty = (await applyStrictMcp(entry, manifest, partial, pluginRoot, ctx)) || dirty;

  // Step 9 (PR-3 / PR-4): unsupported components declared explicitly or via
  // Claude Code default locations (.lsp.json, hooks/hooks.json, etc.).
  dirty = (await addUnsupportedKindNotes(entry, manifest, pluginRoot, ctx, partial)) || dirty;

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
    dirty = (await collectLooseComponentKind(entry, manifest, partial, pluginRoot, kind)) || dirty;
    // No implicit-by-convention in loose mode.
  }

  // Step 8 (MM-7 loose mcpServers).
  dirty = (await applyLooseMcp(entry, manifest, partial, pluginRoot, ctx)) || dirty;

  // Step 9 (PR-3 / PR-4): unsupported components -- same as strict.
  dirty = (await addUnsupportedKindNotes(entry, manifest, pluginRoot, ctx, partial)) || dirty;

  // Step 10 (PR-5): dependencies stay installable but get a note.
  if ((entry as Record<string, unknown>).dependencies !== undefined) {
    partial.notes.push(`declares dependencies that must be installed manually`);
  }

  return dirty ? notInstallable(entry.name, partial) : installable(entry.name, pluginRoot, partial);
}

/**
 * PR-6: narrow to installable-or-throw.
 *
 * Throws `PluginShapeError` (typed discriminated carrier) so catch sites
 * dispatch on `instanceof PluginShapeError` + `.kind` rather than
 * substring-matching `.message`. `r.notes` is passed through as the
 * `reasons` array (free-form strings; closed `Reason` narrowing happens
 * at the renderer boundary in `classifyEntityShapeError`).
 */
export function requireInstallable(
  r: ResolvedPlugin,
  op: "install" | "update" = "install",
): asserts r is ResolvedPluginInstallable {
  if (r.installable) {
    return;
  }

  throw new PluginShapeError({
    kind: op === "update" ? "no-longer-installable" : "not-installable",
    plugin: r.name,
    reasons: r.notes,
  });
}
