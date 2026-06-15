// domain/resolver.ts
//
// Plugin compatibility resolver. Returns the discriminated `ResolvedPlugin`
// union locked by NFR-7: TypeScript refuses to compile any code that reads
// `pluginRoot` from a non-installable variant.
//
// Per D-04: TWO distinct functions, no shared branching.
//   - resolveStrict (MM-5):   union of entry + manifest + implicit + standalone
//   - resolveLoose  (MM-6/7): entry-only; manifest/standalone declarations conflict
//
// Type.Union([...]) takes NO `discriminator` option in TypeBox 1.x.
// Literal-tagged variants ARE the discriminator -- TypeScript narrowing
// works automatically on `if (r.installable)`.
//
// Per D-05: use boolean-literal `installable: true | false` (PRD §6.4
// verbatim), NOT the string-tag form (e.g. kind discriminator).
//
// HOOK-01: `hooks` is admitted alongside `skills` / `commands` / `agents` /
// `mcpServers`. The supported-kind tuple is the PUBLIC closed set; the
// path-validation loop iterates a PRIVATE subset (`SUPPORTED_COMPONENT_PATH_KINDS`)
// because `hooks` carries no per-entry component-path semantics -- the
// discovery path is the convention file `<pluginRoot>/hooks/hooks.json`,
// parsed through `parseHooksConfig` (D-57-04: parse failure flips
// `installable: false`).

import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import Type from "typebox";

import { PluginShapeError } from "../shared/errors.ts";
import { PathContainmentError, assertPathInside } from "../shared/path-safety.ts";

import { parseHooksConfig, type HooksConfig } from "./components/hooks.ts";
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
// declared `custom/skills` and the conventional `skills` simultaneously.
// This is additive rather than PR-4 short-circuit semantics.
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
  // HOOK-01: relative path of the discovered hooks/hooks.json when the
  // convention-file probe found a parseable file. Undefined when no hooks
  // file exists on disk or when parse failed (the not-installable variant
  // also carries this marker -- see schema below).
  hooksConfigPath: Type.Optional(Type.String()),
});

const ResolvedPluginNotInstallableSchema = Type.Object({
  installable: Type.Literal(false),
  name: Type.String(),
  supported: Type.Array(Type.String()),
  unsupported: Type.Array(Type.String()),
  notes: Type.Array(Type.String()), // PR-3: contains "contains <name>" entries
  componentPaths: ComponentPathsSchema,
  mcpServers: McpServersFieldSchema,
  // HOOK-01: symmetric with the installable variant so downstream
  // consumers can read the marker without narrowing on `installable`.
  hooksConfigPath: Type.Optional(Type.String()),
  // pluginRoot intentionally absent -- NFR-7 enforces non-readability
});

/** Literal-tagged variants ARE the discriminator. NO options arg. */
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

/**
 * HOOK-01: the PUBLIC closed set of supported component kinds. Downstream
 * consumers (surface renderers, OBS/SURF tests) read this tuple as the
 * authoritative supported-kind list. `hooks` is admitted here even though
 * the path-validation loop iterates a narrower subset
 * (`SUPPORTED_COMPONENT_PATH_KINDS`) -- the hooks-config discovery path
 * is a convention file, not a component-path field.
 */
export const SUPPORTED_COMPONENT_KINDS = ["skills", "commands", "agents", "hooks"] as const;
export type SupportedKind = (typeof SUPPORTED_COMPONENT_KINDS)[number];

/**
 * HOOK-01: the PRIVATE subset of supported kinds that carry per-entry
 * component-path semantics (entry/manifest declares a relative dir; the
 * resolver validates each path and adds it to `componentPaths.<kind>`).
 * `hooks` is deliberately excluded -- its discovery path is the
 * convention file `<pluginRoot>/hooks/hooks.json`, parsed by
 * `parseHooksConfig`, NOT a path-bearing field.
 */
const SUPPORTED_COMPONENT_PATH_KINDS = ["skills", "commands", "agents"] as const;
type SupportedPathKind = (typeof SUPPORTED_COMPONENT_PATH_KINDS)[number];

/**
 * PR-3: any of these kinds declared in entry OR manifest disqualifies install
 * with note `contains <kind>`.
 *
 * SECURITY (T-02-25): The list is closed. A new kind upstream that's neither
 * in SUPPORTED_COMPONENT_KINDS nor in this list would be silently ignored.
 * Re-audit when Claude Code adds new component kinds.
 */
export const UNSUPPORTED_COMPONENT_KINDS = [
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
  // HOOK-01: relative path of the discovered hooks/hooks.json when the
  // convention probe found a parseable file. Undefined when no file
  // exists on disk or when parse failed.
  hooksConfigPath?: string;
}

function emptyResolution(): PartialResolution {
  // hooksConfigPath is left absent (not `undefined`) to satisfy
  // exactOptionalPropertyTypes; consumers narrow on
  // `partial.hooksConfigPath !== undefined`.
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
    ...(partial.hooksConfigPath !== undefined && { hooksConfigPath: partial.hooksConfigPath }),
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
    ...(partial.hooksConfigPath !== undefined && { hooksConfigPath: partial.hooksConfigPath }),
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

  // PR-2 case 1: only path sources are installable (MM-3).
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
 * messaging stays consistent with the PR-2 case 7 path.
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
 * D-07 narrowing: the resolver accepts a top-level array of strings as
 * legal input (the schema is `Type.Array(Type.String())`). Callers MUST
 * normalize their raw inputs through `readPathOrArray` BEFORE handing each
 * element to this function. Per-element non-string / nested-array values
 * are rejected here (the schema-level guard does not survive the
 * `as unknown` coercion that the resolver uses to read untrusted entry /
 * manifest fields).
 */
async function validateComponentPath(
  kind: SupportedPathKind,
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
  kind: SupportedPathKind,
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
  kind: SupportedPathKind,
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
  kind: SupportedPathKind,
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

/**
 * HOOK-01 / D-57-04: discover + parse the per-plugin hooks config file.
 *
 * Returns:
 *   - `{ ok: true }` when no `<pluginRoot>/hooks/hooks.json` exists on disk
 *     (the no-op happy path: the plugin neither declares nor provides hooks).
 *   - `{ ok: true, value, relativePath }` when the file exists AND
 *     `parseHooksConfig` succeeds. The caller adds `"hooks"` to
 *     `partial.supported` and records `partial.hooksConfigPath`.
 *   - `{ ok: false, reason }` when the file exists but `parseHooksConfig`
 *     fails (invalid JSON, structural shape mismatch, missing REQUIRED
 *     `command` on a `type: "command"` handler, or TOOL-02 supportability
 *     trip). The reason is prefixed with `malformed hooks.json: ` so
 *     downstream `startsWith`-anchored narrowing in
 *     `shared/probe-classifiers.ts::narrowResolverNotes` (HOOK-04
 *     tightened detection) emits the `unsupported hooks` Reason.
 *
 * WR-02 (D-58 review): a read I/O failure (EACCES / EPERM / etc.) is
 * RE-THROWN unchanged rather than wrapped with the `malformed hooks.json:`
 * prefix. The outer probe-classifier (`narrowProbeError` in
 * `orchestrators/plugin/{list,info}.ts`) then classifies the error by
 * its `.code` and emits the truthful `{permission denied}` /
 * `{unreadable}` Reason -- the previous wrapper silently lumped I/O
 * failures into the `{unsupported hooks}` bucket. Schema / parse /
 * supportability failures still flow through the structured note path so
 * the catalog layer continues to emit `{unsupported hooks}` for them.
 *
 * Disk I/O is routed through the injected `statKind` + `readFileText`
 * readers, mirroring the `readStandaloneMcp` pattern for testability.
 */
async function readStandaloneHooks(
  ctx: ResolveContext,
  pluginRoot: string,
): Promise<
  { ok: true; value?: HooksConfig; relativePath?: string } | { ok: false; reason: string }
> {
  const hooksPath = path.join(pluginRoot, "hooks", "hooks.json");
  if ((await statKindOf(ctx)(hooksPath)) !== "file") {
    return { ok: true };
  }

  // WR-02 (D-58 review): let read errors propagate so the outer
  // `narrowProbeError` ladder classifies them by `.code` rather than
  // lying about the cause class with a generic `malformed hooks.json:`
  // wrapper.
  const raw = await readFileTextOf(ctx)(hooksPath);

  // MATCH-03 / A1 projectRoot fallback: the resolver has no
  // `ExtensionContext` in scope; construct the path-anchor triple from
  // `os.homedir()` + `process.cwd()`. The resolver's outcome is the
  // discriminated `installable` shape -- the `if`-field side-Map is
  // discarded here (only the bridge cache hydrate / install /
  // reinstall / update paths consume it). The `skipIfMap` opt-out
  // short-circuits the handler walk entirely; the `compileIf` callback
  // is still a no-op sentinel for type-system completeness, but is
  // never invoked when `skipIfMap` is set. Domain MUST NOT import the
  // bridge `IfPredicate` union (D-11), and the resolver-emitted map is
  // unreachable from any consumer at this call site.
  const ifCtx = { homedir: homedir(), cwd: process.cwd(), projectRoot: process.cwd() };
  const noopCompileIf = (): null => null;
  const parsed = parseHooksConfig(raw, ifCtx, noopCompileIf, { skipIfMap: true });
  if (!parsed.ok) {
    return { ok: false, reason: `malformed hooks.json: ${parsed.reason}` };
  }

  return { ok: true, value: parsed.value, relativePath: path.join("hooks", "hooks.json") };
}

/**
 * HOOK-01 + D-57-04 wiring helper. Probe `hooks/hooks.json`, update the
 * partial resolution, and report whether the result flips installability.
 * Mode-agnostic: both `resolveStrict` and `resolveLoose` call this
 * unchanged (D-57-04 parse-failure semantics do not depend on
 * entry-vs-manifest declaration mode).
 */
async function applyHooksConfig(
  ctx: ResolveContext,
  pluginRoot: string,
  partial: PartialResolution,
): Promise<boolean> {
  const hooksResult = await readStandaloneHooks(ctx, pluginRoot);
  if (!hooksResult.ok) {
    partial.notes.push(hooksResult.reason);
    return true;
  }

  if (hooksResult.value !== undefined) {
    partial.supported.push("hooks");
    if (hooksResult.relativePath !== undefined) {
      partial.hooksConfigPath = hooksResult.relativePath;
    }
  }

  return false;
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
  kind: SupportedPathKind,
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
  // (entry > manifest order) + implicit-by-convention. Implicit-by-convention
  // is ADDITIVE rather than fallback-only (cf. PR-4) -- if the conventional
  // dir exists on disk and is not already declared, it is appended to the
  // array. First-wins dedup by relative-path string preserves ordering
  // (declared first, implicit last).
  //
  // HOOK-01: iterates SUPPORTED_COMPONENT_PATH_KINDS (skills/commands/agents),
  // NOT the full SUPPORTED_COMPONENT_KINDS tuple, because `hooks` carries no
  // per-entry component-path semantics. The hooks-config probe in step 8b
  // owns the discovery + admission of the `hooks` supported kind.
  for (const kind of SUPPORTED_COMPONENT_PATH_KINDS) {
    dirty =
      (await collectStrictComponentKind(entry, manifest, partial, pluginRoot, ctx, kind)) || dirty;
  }

  // Step 8 (MM-5): mcpServers union (entry > manifest > standalone .mcp.json).
  dirty = (await applyStrictMcp(entry, manifest, partial, pluginRoot, ctx)) || dirty;

  // Step 8b (HOOK-01 / D-57-04): probe `<pluginRoot>/hooks/hooks.json` and
  // either add `hooks` to supported (parse OK) or flip installable=false
  // with the parse-failure detail.
  dirty = (await applyHooksConfig(ctx, pluginRoot, partial)) || dirty;

  // Step 9 (PR-3 / PR-4): unsupported components declared explicitly or via
  // Claude Code default locations (.lsp.json, monitors/monitors.json, etc.).
  // `hooks` is no longer in UNSUPPORTED_COMPONENT_KINDS -- HOOK-01 admission
  // is owned by step 8b.
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
  //
  // HOOK-01: iterates the PATH-kinds subset only (see strict-mode note above).
  for (const kind of SUPPORTED_COMPONENT_PATH_KINDS) {
    dirty = (await collectLooseComponentKind(entry, manifest, partial, pluginRoot, kind)) || dirty;
    // No implicit-by-convention in loose mode.
  }

  // Step 8 (MM-7 loose mcpServers).
  dirty = (await applyLooseMcp(entry, manifest, partial, pluginRoot, ctx)) || dirty;

  // Step 8b (HOOK-01 / D-57-04): the hooks-config probe is mode-agnostic.
  // Entry-vs-manifest hooks-FIELD conflict semantics are deferred to the
  // dispatch milestone; here the convention file is the sole gate.
  dirty = (await applyHooksConfig(ctx, pluginRoot, partial)) || dirty;

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
