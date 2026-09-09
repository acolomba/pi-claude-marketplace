// domain/resolver.ts
//
// Plugin compatibility resolver. Returns the discriminated `ResolvedPlugin`
// union locked by NFR-7: TypeScript refuses to compile any code that reads
// `pluginRoot` from the structurally-broken `unavailable` variant.
//
// Per D-04: TWO distinct functions, no shared branching.
//   - resolveStrict (MM-5):   union of entry + manifest + implicit + standalone
//   - resolveLoose  (MM-6/7): entry-only for COMPONENT declarations;
//                             manifest/standalone declarations conflict.
//                             D-101-08: METADATA (description, version,
//                             defaultEnabled) is outside that rule and is never
//                             conflict material -- see `resolveLoose`'s own doc.
//
// Type.Union([...]) takes NO `discriminator` option in TypeBox 1.x.
// Literal-tagged variants ARE the discriminator -- TypeScript narrowing
// works automatically on `switch (r.state)` / `if (r.state === ...)`.
//
// RES-01: `installable: true | false` is the primary materializability
// discriminator. The three-way `state` field keeps the secondary
// `"installable" | "partially-available" | "unavailable"` detail. Both true
// arms carry `pluginRoot` + component lists (D-64-06); the false `unavailable`
// arm is the minimal structural-defect arm and never carries `pluginRoot`
// (D-64-05, NFR-7). Structural precedence
// (D-64-07): a plugin that is both structurally broken AND declares
// unsupported component kinds resolves `unavailable`.
//
// HOOK-01: `hooks` is admitted alongside `skills` / `commands` / `agents` /
// `mcpServers`. The supported-kind tuple is the PUBLIC closed set; the
// path-validation loop iterates a PRIVATE subset (`SUPPORTED_COMPONENT_PATH_KINDS`)
// because `hooks` carries no per-entry component-path semantics -- the
// discovery path is the convention file `<pluginRoot>/hooks/hooks.json`,
// parsed through `parseHooksConfig` (D-57-04: a parse failure is structural
// and resolves `unavailable`).

import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import { PluginShapeError } from "../shared/errors.ts";
import { PathContainmentError, assertPathInside } from "../shared/path-safety.ts";

import {
  collectLooseComponentPaths,
  collectStrictComponentPaths,
  type ComponentPathResolution,
} from "./component-paths.ts";
import { parseHooksConfig, type DroppedHook, type HooksConfig } from "./components/hooks.ts";
import { MCP_SERVERS_VALIDATOR } from "./components/mcp.ts";
import { PLUGIN_MANIFEST_VALIDATOR, type PluginEntry } from "./components/plugin.ts";
import { assertSafeName } from "./name.ts";
import {
  parsePluginSource,
  type GitHubSource,
  type GitSubdirSource,
  type PathSource,
  type ParsedSource,
  type UrlSource,
} from "./source.ts";
import { collectUnsupportedKinds } from "./unsupported-components.ts";

import type {
  ResolveContext,
  ResolvedPlugin,
  ResolvedPluginInstallable,
  ResolvedPluginPartiallyAvailable,
  ResolvedPluginUnavailable,
  StatKind,
  StatKindReader,
} from "./resolver-types.ts";

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

interface PartialResolution extends ComponentPathResolution {
  supported: string[];
  unsupported: string[];
  notes: string[];
  componentPaths: { skills: string[]; commands: string[]; agents: string[] };
  mcpServers: Record<string, unknown>;
  // HOOK-01: relative path of the discovered hooks/hooks.json when the
  // convention probe found a parseable file. Undefined when no file
  // exists on disk or when parse failed.
  hooksConfigPath?: string;
  // SURF-05 / D-63-08: set ONLY on the parseHooksConfig success branch by
  // `detectOrphanRewake`. Absent when no hooks.json exists, parse failed,
  // or no handler is orphaned. The cascade-wiring path reads this on the
  // installable variant.
  orphanRewake?: boolean;
  // D-71-03 / PHOOK-02: set by `applyHooksConfig` on a successful parse whose
  // partition dropped at least one unsupportable event / matcher group /
  // handler. Routed alongside the `"hooks"` push into `partial.unsupported`,
  // so a partial-hook plugin resolves `partially-available` while
  // its supported handlers still materialize. Absent when no hooks.json
  // exists, the parse failed structurally, or nothing dropped.
  droppedHooks?: DroppedHook[];
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

// D-64-05: the minimal structural-defect arm. Takes only the structural
// notes; never spreads `pluginRoot` / component lists / `componentPaths` /
// `mcpServers` so NFR-7 holds by construction.
function unavailable(name: string, notes: string[]): ResolvedPluginUnavailable {
  return {
    state: "unavailable",
    installable: false,
    name,
    notes,
  };
}

// The non-discriminant payload shared by the two materializable arms.
// Because `ResolvedPluginInstallable` and `ResolvedPluginPartiallyAvailable` differ
// only in `state`, `Omit<..., "state">` is the same structural type for both.
// Each constructor re-adds its own `state` literal and keeps its precise
// discriminated-union return type with no cast.
function materializableFields(
  name: string,
  pluginRoot: string,
  partial: PartialResolution,
  defaultEnabled: boolean,
): Omit<ResolvedPluginInstallable, "state"> {
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
    ...(partial.orphanRewake !== undefined && { orphanRewake: partial.orphanRewake }),
    ...(partial.droppedHooks !== undefined && { droppedHooks: partial.droppedHooks }),
    defaultEnabled,
  };
}

function installable(
  name: string,
  pluginRoot: string,
  partial: PartialResolution,
  defaultEnabled: boolean,
): ResolvedPluginInstallable {
  return {
    state: "installable",
    ...materializableFields(name, pluginRoot, partial, defaultEnabled),
  };
}

// D-64-06: the partially-available arm. Identical payload to `installable`
// (including `pluginRoot`); only the `state` tag differs.
function partiallyAvailable(
  name: string,
  pluginRoot: string,
  partial: PartialResolution,
  defaultEnabled: boolean,
): ResolvedPluginPartiallyAvailable {
  return {
    state: "partially-available",
    ...materializableFields(name, pluginRoot, partial, defaultEnabled),
  };
}

// PURL-01 / D-77-01: the four installable source kinds return undefined. `path`
// derives its pluginRoot from marketplaceRoot; `url` / `git-subdir` / `github`
// derive theirs from the injected `resolveGitPluginRoot` callback. `npm` stays
// out of scope, and `unknown` is the NFR-12 forward-compat tail. The exhaustive
// switch keeps this sound: a future ParsedSource kind fails the compile.
type SupportedParsedSource = PathSource | GitHubSource | UrlSource | GitSubdirSource;

type SourceSupport =
  | { readonly kind: "supported"; readonly source: SupportedParsedSource }
  | { readonly kind: "rejected"; readonly reason: string };

function classifySourceSupport(parsedSource: ParsedSource): SourceSupport {
  switch (parsedSource.kind) {
    case "path":
    case "github":
    case "url":
    case "git-subdir":
      return { kind: "supported", source: parsedSource };
    case "npm":
      return { kind: "rejected", reason: `unsupported source kind: npm` };
    case "unknown":
      return {
        kind: "rejected",
        reason: `unsupported source kind: unknown (${parsedSource.reason})`,
      };
  }
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
      const detail = PLUGIN_MANIFEST_VALIDATOR.Errors(parsed)
        .slice(0, 1)
        .map((error) => `${error.instancePath || "(root)"}: ${error.message}`)
        .join("");
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
 * DFEN-02: decide the declared install-time enablement. The marketplace ENTRY
 * value wins over the `plugin.json` value in BOTH directions -- an entry `true`
 * beats a manifest `false` just as an entry `false` beats a manifest `true`.
 * Absent at both sites (including a plugin with no `plugin.json` at all, where
 * `manifest` is null) is `true`.
 *
 * DFEN-03: this is the only evaluation of the rule. Callers read the resolved
 * boolean off the materializable arm and never re-derive it.
 *
 * D-101-08: it runs from the shared `preflightStages`, so BOTH modes read
 * `plugin.json` for it. That is deliberate and is the one place loose mode
 * honors a manifest declaration a silent entry did not mirror: MM-6 / MM-7
 * conflict semantics govern component declarations and `mcpServers`, not
 * metadata. A manifest-only `defaultEnabled` must never push a plugin to
 * `unavailable`.
 *
 * Both `typeof` narrows are defense-in-depth, not validation: the entry has
 * already passed PLUGIN_ENTRY_VALIDATOR and the manifest PLUGIN_MANIFEST_VALIDATOR,
 * so only `boolean | undefined` can arrive. They are value tests rather than
 * key-presence tests because an explicitly-`undefined` property satisfies
 * `Type.Optional` and must fall through to the next source, and because the
 * manifest side is typed `unknown` and needs the narrow to type-check at all.
 * A non-boolean smuggled past a validator degrades to the default; there is
 * deliberately no error path here.
 */
function resolveDefaultEnabled(
  entry: PluginEntry,
  manifest: Record<string, unknown> | null,
): boolean {
  if (typeof entry.defaultEnabled === "boolean") {
    return entry.defaultEnabled;
  }

  if (typeof manifest?.defaultEnabled === "boolean") {
    return manifest.defaultEnabled;
  }

  return true;
}

/**
 * PURL-01 / PURL-03: derive the pluginRoot for an already-supported source kind.
 *
 * - `path`: resolve under `marketplaceRoot` and run the NFR-10 escape check
 *   VERBATIM (regression-critical -- a `../escape` path source resolves
 *   `unavailable` with the marketplace-root escape note).
 * - `url` / `git-subdir` / `github`: delegate to `ctx.resolveGitPluginRoot`.
 *   Absent callback => `unavailable` (path-only back-compat). Otherwise switch
 *   on the discriminated result: `materialized` carries the clone-anchored
 *   pluginRoot (D-77-03: git-subdir containment is enforced INSIDE the callback,
 *   surfacing here as `escapes`); `escapes` / `missing-subdir` carry their
 *   structural detail; `not-cached` reports the plugin is not installed.
 *
 * `parsedSource` is pre-narrowed by the caller's `sourceUnsupportedReason` gate,
 * so `npm` / `unknown` never reach here.
 */
async function deriveSourcePluginRoot(
  entry: PluginEntry,
  ctx: ResolveContext,
  parsedSource: SupportedParsedSource,
  partial: PartialResolution,
): Promise<
  { kind: "ok"; pluginRoot: string } | { kind: "unavailable"; result: ResolvedPluginUnavailable }
> {
  if (parsedSource.kind === "path") {
    const pluginRoot = path.resolve(ctx.marketplaceRoot, parsedSource.raw);
    const escapeReason = await sourceEscapeReason(ctx, pluginRoot, parsedSource.raw);
    if (escapeReason !== undefined) {
      return {
        kind: "unavailable",
        result: unavailable(entry.name, [...partial.notes, escapeReason]),
      };
    }

    return { kind: "ok", pluginRoot };
  }

  // url | git-subdir | github -- the injected policy owns clone-vs-probe and,
  // for git-subdir, the clone-root-anchored containment (NFR-10 / PURL-03).
  if (ctx.resolveGitPluginRoot === undefined) {
    return {
      kind: "unavailable",
      result: unavailable(entry.name, [
        ...partial.notes,
        `git source requires a clone-cache resolver`,
      ]),
    };
  }

  const r = await ctx.resolveGitPluginRoot(parsedSource);
  switch (r.kind) {
    case "materialized":
      return { kind: "ok", pluginRoot: r.pluginRoot };
    case "escapes":
    case "missing-subdir":
      return {
        kind: "unavailable",
        result: unavailable(entry.name, [...partial.notes, r.detail]),
      };
    case "not-cached":
      return {
        kind: "unavailable",
        result: unavailable(entry.name, [...partial.notes, `not installed`]),
      };
  }
}

/**
 * Steps 1-6 are shared between resolveStrict and resolveLoose. Returns
 * either:
 *   - { kind: "ok", pluginRoot, manifest, partial } -- proceed to mode-specific steps
 *   - { kind: "unavailable", result }               -- structural short-circuit
 *
 * D-64-07: every preflight short-circuit (bad source kind, path escape,
 * missing dir, malformed plugin.json) is a STRUCTURAL defect and resolves
 * `unavailable`.
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
      // DFEN-03: resolved here, in the one stage both resolution modes enter
      // first, so the evaluation order is mode-independent by construction.
      defaultEnabled: boolean;
    }
  | { kind: "unavailable"; result: ResolvedPluginUnavailable }
> {
  const partial = emptyResolution();
  // Caller bug if name validation throws -- entry came through PLUGIN_ENTRY_VALIDATOR.
  assertSafeName(entry.name);

  // Classify source. PluginEntry.source is Type.Unknown() per MM-3.
  const parsedSource: ParsedSource = parsePluginSource(entry.source);

  // PR-2 case 1 / PURL-01: url / git-subdir / github / path are installable;
  // npm and unknown reject here.
  const sourceSupport = classifySourceSupport(parsedSource);
  if (sourceSupport.kind === "rejected") {
    return {
      kind: "unavailable",
      result: unavailable(entry.name, [...partial.notes, sourceSupport.reason]),
    };
  }

  // PR-2 case 2 / PURL-01 / PURL-03: derive the pluginRoot. Path sources resolve
  // it under marketplaceRoot with the NFR-10 escape check (unchanged); git
  // sources delegate to the injected `resolveGitPluginRoot` callback, whose
  // discriminated result already carries the clone-root-anchored containment
  // outcome (D-77-03: git-subdir containment is the callback's responsibility,
  // never a marketplaceRoot-anchored check).
  const rooted = await deriveSourcePluginRoot(entry, ctx, sourceSupport.source, partial);
  if (rooted.kind === "unavailable") {
    return rooted;
  }

  const pluginRoot = rooted.pluginRoot;

  // PR-2 case 3: source dir does not exist.
  if ((await statKindOf(ctx)(pluginRoot)) !== "dir") {
    return {
      kind: "unavailable",
      result: unavailable(entry.name, [
        ...partial.notes,
        `source dir does not exist: ${pluginRoot}`,
      ]),
    };
  }

  // PR-2 case 4: malformed plugin.json (best-effort -- absence is OK).
  const manifestResult = await readManifest(ctx, pluginRoot);
  if (!manifestResult.ok) {
    return {
      kind: "unavailable",
      result: unavailable(entry.name, [...partial.notes, manifestResult.reason]),
    };
  }

  return {
    kind: "ok",
    pluginRoot,
    manifest: manifestResult.manifest,
    partial,
    defaultEnabled: resolveDefaultEnabled(entry, manifestResult.manifest),
  };
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
 * MCPR-01 / MCPR-04 / D-01: validate a string `mcpServers` reference path.
 * Mirrors the `validateComponentPath` reject-absolute + resolve +
 * `assertPathInside` pattern, but returns the ABSOLUTE candidate (needed to
 * read the file) and carries no `SupportedPathKind`. `assertPathInside` runs
 * BEFORE any read, so "never reads outside pluginRoot" holds by construction;
 * the D-14 all-symlink refusal lives inside it. All failure reasons use the
 * collision-proof `malformed mcp reference:` prefix so they do not overlap the
 * inline `malformed mcpServers` note.
 */
async function validateReferencePath(
  raw: string,
  pluginRoot: string,
): Promise<{ ok: true; absPath: string } | { ok: false; reason: string }> {
  if (path.isAbsolute(raw)) {
    return {
      ok: false,
      reason: `malformed mcp reference: must be relative (got absolute "${raw}")`,
    };
  }

  const candidate = path.resolve(pluginRoot, raw);

  try {
    await assertPathInside(pluginRoot, candidate, "mcpServers reference");
  } catch (err) {
    if (err instanceof PathContainmentError) {
      return { ok: false, reason: `malformed mcp reference: escapes plugin root: "${raw}"` };
    }

    throw err;
  }

  return { ok: true, absPath: candidate };
}

/**
 * MCPR-01 / MCPR-03 / D-04: WRAPPED-ONLY reader for a string `mcpServers`
 * reference. Distinct from the tolerant `readStandaloneMcp` (which accepts an
 * unwrapped superset for the conventional `<pluginRoot>/.mcp.json`): a string
 * reference MUST point at a wrapped `{ "mcpServers": {...} }` file. A missing
 * file / invalid JSON / missing top-level `mcpServers` wrapper / out-of-root
 * escape each degrades the plugin with a `malformed mcp reference:` note.
 */
async function readReferencedMcp(
  ctx: ResolveContext,
  pluginRoot: string,
  raw: string,
): Promise<{ ok: true; value: unknown } | { ok: false; reason: string }> {
  const v = await validateReferencePath(raw, pluginRoot);
  if (!v.ok) {
    return v;
  }

  if ((await statKindOf(ctx)(v.absPath)) !== "file") {
    return { ok: false, reason: `malformed mcp reference: file not found: "${raw}"` };
  }

  // WR-03: read the file OUTSIDE the try so a real I/O failure on an
  // existing-but-unreadable file (EACCES / EPERM) propagates to the outer
  // probe classifier, which keys on `.code` -> `{permission denied}` /
  // `{unreadable}`. Only JSON.parse + the wrapper-shape check stay inside the
  // try labeled with the malformed-reference reason. Mirrors the
  // `readStandaloneHooks` house pattern; the stat guard above already ruled
  // out ENOENT, so the malformed-reference file-not-found reason is unchanged.
  const text = await readFileTextOf(ctx)(v.absPath);
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (!("mcpServers" in parsed)) {
      return {
        ok: false,
        reason: `malformed mcp reference: missing top-level "mcpServers": "${raw}"`,
      };
    }

    return { ok: true, value: parsed.mcpServers };
  } catch (err) {
    return {
      ok: false,
      reason: `malformed mcp reference: invalid JSON in "${raw}": ${(err as SyntaxError).message}`,
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
  | { ok: true; value?: HooksConfig; relativePath?: string; dropped?: readonly DroppedHook[] }
  | { ok: false; reason: string }
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
  const noopCompileIf = JSON.parse.bind(JSON, "null") as () => null;
  const parsed = parseHooksConfig(raw, ifCtx, noopCompileIf, { skipIfMap: true });
  if (!parsed.ok) {
    return { ok: false, reason: `malformed hooks.json: ${parsed.reason}` };
  }

  // D-71-03 / PHOOK-02: forward `parsed.dropped` so `applyHooksConfig` can
  // route supportability drops to `partial.unsupported` + `partial.droppedHooks`.
  // `parsed.value` is the FILTERED supported subset (possibly `{}` for the
  // Q2 empty-subset edge); the caller decides whether to materialize it.
  return {
    ok: true,
    value: parsed.value,
    relativePath: path.join("hooks", "hooks.json"),
    dropped: parsed.dropped,
  };
}

/**
 * SURF-05 / D-63-08: scan an already-parsed hooks config for orphan-rewake
 * companion fields. Returns `true` on the first handler whose
 * `rewakeMessage` OR `rewakeSummary` is non-undefined AND whose
 * `asyncRewake` is not `=== true` (the upstream Command-hook-fields
 * orphan-subordinate case). One-per-plugin invariant -- the resolver
 * records a single flag, install row composition emits a single
 * `(installed) {orphan rewake}` reason regardless of N orphan handlers.
 *
 * Plugins where every orphan-bearing handler ALSO declares
 * `asyncRewake: true` return `false`: the companion fields have their
 * required parent, so the install is silent. Handlers with neither
 * companion field never participate.
 */
function detectOrphanRewake(parsed: HooksConfig): boolean {
  for (const groups of Object.values(parsed)) {
    for (const group of groups) {
      for (const handler of group.hooks) {
        const hasRewakeField =
          handler.rewakeMessage !== undefined || handler.rewakeSummary !== undefined;
        const asyncRewakeTrue = handler.asyncRewake === true;
        if (hasRewakeField && !asyncRewakeTrue) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * HOOK-01 + D-57-04 wiring helper. Probe `hooks/hooks.json`, update the
 * partial resolution, and report whether the result feeds the STRUCTURAL
 * dirty accumulator. Mode-agnostic: both `resolveStrict` and `resolveLoose`
 * call this unchanged (parse-failure semantics do not depend on
 * entry-vs-manifest declaration mode).
 *
 * D-71-03 / PHOOK-02 / PHOOK-03: the verdict is now THREE-way, not two.
 *   - STRUCTURAL failure (invalid JSON S1, schema mismatch S2, or the X1
 *     table-desync programmer bug) -> push the reason note and return `true`
 *     so `decideResolution` resolves `unavailable` (structural precedence,
 *     D-64-07). UNCHANGED arm.
 *   - SUPPORTABILITY drops on an otherwise-parseable config -> route the
 *     dropped signal to `partial.unsupported` (kind "hooks") +
 *     `partial.droppedHooks`, NEVER the structural dirty accumulator, so the
 *     plugin resolves `partially-available`.
 *   - The KEPT handlers (the filtered non-empty subset) still materialize:
 *     push "hooks" to `partial.supported` + record `hooksConfigPath`.
 *
 * SURF-05 / D-63-08: on the materialized-subset branch only, writes
 * `partial.orphanRewake` from `detectOrphanRewake` over the FILTERED subset,
 * so a dropped handler's orphan-rewake field cannot raise a false marker.
 */
async function applyHooksConfig(
  ctx: ResolveContext,
  pluginRoot: string,
  partial: PartialResolution,
): Promise<boolean> {
  const hooksResult = await readStandaloneHooks(ctx, pluginRoot);
  // D-57-04 / D-64-07: a STRUCTURAL parse failure feeds the structural dirty
  // accumulator and resolves `unavailable` (structural precedence). Unchanged.
  if (!hooksResult.ok) {
    partial.notes.push(hooksResult.reason);
    return true;
  }

  // D-71-03 / PHOOK-02: a successful parse may still carry supportability
  // drops. Route that signal to `partial.unsupported` (kind "hooks") +
  // `partial.droppedHooks` so `decideResolution` returns `partially-available`. This
  // mirrors `addUnsupportedKindNotes`, which pushes to `partial.unsupported`;
  // the dropped-hooks signal NEVER increments the structural dirty accumulator.
  if (hooksResult.dropped !== undefined && hooksResult.dropped.length > 0) {
    partial.unsupported.push("hooks");
    partial.droppedHooks = [...hooksResult.dropped];
  }

  // D-71-03 / Q2: materialize the KEPT handlers only when the filtered subset
  // is non-empty. A Stop-only config (every handler dropped) filters to `{}`
  // -> stage nothing, set no hooksConfigPath, run no orphan probe; the
  // `droppedHooks` push above still routes it `partially-available`.
  if (hooksResult.value !== undefined && Object.keys(hooksResult.value).length > 0) {
    partial.supported.push("hooks");
    if (hooksResult.relativePath !== undefined) {
      partial.hooksConfigPath = hooksResult.relativePath;
    }

    // SURF-05 / D-63-08: `detectOrphanRewake` runs over the FILTERED
    // subset only. Only SET the flag when true (mirror hooksConfigPath
    // discipline). Absent-vs-false is intentional: a config with no orphan
    // handler leaves `partial.orphanRewake` undefined, the constructor spread
    // omits the field, and consumers read `r.orphanRewake === true`.
    if (detectOrphanRewake(hooksResult.value)) {
      partial.orphanRewake = true;
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
    const errorDetail = MCP_SERVERS_VALIDATOR.Errors(mcp)
      .slice(0, 1)
      .map((error) => error.message)
      .join("");
    partial.notes.push(`malformed mcpServers: ${errorDetail}`);
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

  // MCPR-01 / MCPR-02 / MCPR-04: a string mcpServers is a relative reference
  // (to pluginRoot) to a wrapped .mcp.json. Read + unwrap it, then hand the map
  // to the unchanged `applyMcpValue` for inline parity. A reference-resolution
  // failure (missing / bad JSON / no wrapper / escapes root / absolute) degrades
  // this plugin with a `malformed mcp reference:` note -> `{malformed mcp}`; a
  // valid wrapper whose inner map is shape-invalid degrades via applyMcpValue's
  // `malformed mcpServers` note exactly as an inline map would -> `{unsupported
  // source}` (dirty-accumulator route either way).
  if (typeof declaredMcp === "string") {
    const ref = await readReferencedMcp(ctx, pluginRoot, declaredMcp);
    if (!ref.ok) {
      partial.notes.push(ref.reason);
      return true;
    }

    return applyMcpValue(partial, ref.value);
  }

  const mcpResult =
    declaredMcp === undefined ? await readStandaloneMcp(ctx, pluginRoot) : undefined;

  if (mcpResult?.ok === false) {
    partial.notes.push(mcpResult.reason);
    return true;
  }

  return applyMcpValue(partial, declaredMcp ?? mcpResult?.value);
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

  // D-03: string `mcpServers` references are a strict-mode feature (MCPR-01);
  // loose mode does not resolve them (it has no wired production caller). Degrade
  // this plugin honestly rather than fall through to `applyMcpValue`, which would
  // mislabel the string as a `malformed mcpServers` inline map. The note carries
  // no `malformed mcp reference` prefix, so it classifies to `{unsupported
  // source}` exactly as the pre-existing fall-through did.
  if (typeof entryMcp === "string") {
    partial.notes.push(`unsupported mcpServers string reference in loose mode: "${entryMcp}"`);
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
  for (const kind of await collectUnsupportedKinds(entry, manifest, pluginRoot, statKindOf(ctx))) {
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
  return resolveWithMode(entry, ctx, {
    // Step 7 (MM-5 + D-07/COMP-01): component paths are the UNION of declared
    // (entry > manifest order) + implicit-by-convention. Implicit-by-convention
    // is ADDITIVE rather than fallback-only (cf. PR-4) -- if the conventional
    // dir exists on disk and is not already declared, it is appended to the
    // array. First-wins dedup by relative-path string preserves ordering
    // (declared first, implicit last).
    collectComponentPaths: (args) =>
      collectStrictComponentPaths(
        {
          entry: args.entry,
          manifest: args.manifest,
          pluginRoot: args.pluginRoot,
          resolution: args.partial,
        },
        statKindOf(args.ctx),
      ),
    // Step 8 (MM-5): mcpServers union (entry > manifest > standalone .mcp.json).
    applyMcp: (args) =>
      applyStrictMcp(args.entry, args.manifest, args.partial, args.pluginRoot, args.ctx),
  });
}

/**
 * The stage pipeline both resolution modes run, with the two mode-specific
 * stages injected. Steps 8b, 9 and 10 and the final decision are mode-agnostic
 * and were byte-identical in both callers, which is what made a shared driver
 * the honest shape rather than a coincidence worth restating twice.
 */
interface ResolveMode {
  readonly collectComponentPaths: (args: {
    readonly entry: PluginEntry;
    readonly manifest: Record<string, unknown> | null;
    readonly partial: PartialResolution;
    readonly pluginRoot: string;
    readonly ctx: ResolveContext;
  }) => Promise<boolean>;
  readonly applyMcp: (args: {
    readonly entry: PluginEntry;
    readonly manifest: Record<string, unknown> | null;
    readonly partial: PartialResolution;
    readonly pluginRoot: string;
    readonly ctx: ResolveContext;
  }) => Promise<boolean>;
}

async function resolveWithMode(
  entry: PluginEntry,
  ctx: ResolveContext,
  mode: ResolveMode,
): Promise<ResolvedPlugin> {
  const pre = await preflightStages(entry, ctx);

  if (pre.kind === "unavailable") {
    return pre.result;
  }

  const { pluginRoot, manifest, partial, defaultEnabled } = pre;
  const dirty = await runStructuralStages({ entry, ctx, pluginRoot, manifest, partial, mode });

  // Step 9 (PR-3 / PR-4): unsupported components declared explicitly or via
  // Claude Code default locations (.lsp.json, monitors/monitors.json, etc.).
  // `hooks` is not in UNSUPPORTED_COMPONENT_KINDS -- HOOK-01 admission is
  // owned by step 8b. D-64-07: this signal does NOT feed `dirty` (it is
  // not a structural defect); it is read separately via `partial.unsupported`
  // in the decision below.
  await addUnsupportedKindNotes(entry, manifest, pluginRoot, ctx, partial);
  noteDeclaredDependencies(entry, partial);

  return decideResolution(entry.name, pluginRoot, partial, dirty, defaultEnabled);
}

/**
 * D-64-07: the STRUCTURAL accumulator (component-path / mcp / hooks defects).
 * The unsupported-component signal lives separately in `partial.unsupported`.
 * Every stage runs -- the flags are collected and folded at the end rather than
 * short-circuited, which is what the original `(await stage()) || dirty` chain
 * did too.
 *
 * Component-path collection owns the closed skills/commands/agents subset;
 * hooks-config discovery remains the separate mode-agnostic stage below.
 */
async function runStructuralStages(args: {
  readonly entry: PluginEntry;
  readonly ctx: ResolveContext;
  readonly pluginRoot: string;
  readonly manifest: Record<string, unknown> | null;
  readonly partial: PartialResolution;
  readonly mode: ResolveMode;
}): Promise<boolean> {
  const { entry, ctx, pluginRoot, manifest, partial, mode } = args;
  const flags: boolean[] = [];

  flags.push(
    await mode.collectComponentPaths({ entry, manifest, partial, pluginRoot, ctx }),
    await mode.applyMcp({ entry, manifest, partial, pluginRoot, ctx }),
    // Step 8b (HOOK-01 / D-57-04): probe `<pluginRoot>/hooks/hooks.json` and
    // either add `hooks` to supported (parse OK) or flip installable=false with
    // the parse-failure detail. Mode-agnostic: entry-vs-manifest hooks-FIELD
    // conflict semantics are deferred, so the convention file is the sole gate.
    await applyHooksConfig(ctx, pluginRoot, partial),
  );

  return flags.includes(true);
}

/** Step 10 (PR-5): dependencies stay installable but get a note. */
function noteDeclaredDependencies(entry: PluginEntry, partial: PartialResolution): void {
  if ((entry as Record<string, unknown>).dependencies !== undefined) {
    partial.notes.push(`declares dependencies that must be installed manually`);
  }
}

/**
 * D-64-01 / D-64-07: the three-way decision shared by both modes. Structural
 * precedence -- a structural defect (`structuralDirty`) wins over any
 * unsupported-component signal, so a both-defects plugin resolves
 * `unavailable` and never leaks `pluginRoot` through the `partially-available` arm.
 */
function decideResolution(
  name: string,
  pluginRoot: string,
  partial: PartialResolution,
  structuralDirty: boolean,
  defaultEnabled: boolean,
): ResolvedPlugin {
  if (structuralDirty) {
    return unavailable(name, partial.notes);
  }

  if (partial.unsupported.length > 0) {
    return partiallyAvailable(name, pluginRoot, partial, defaultEnabled);
  }

  return installable(name, pluginRoot, partial, defaultEnabled);
}

/**
 * MM-6 / MM-7 loose: entry-only for COMPONENT declarations -- a manifest or
 * standalone declaration of a component kind (or of `mcpServers`) with a silent
 * entry is a conflict and resolves `unavailable`.
 *
 * D-101-08: METADATA is outside that rule. `description`, `version` and
 * `defaultEnabled` are never conflict material, so a manifest-only
 * `defaultEnabled` with a silent entry is honored here rather than rejected --
 * it is resolved once in `preflightStages` and reads `plugin.json` in loose mode
 * exactly as it does in strict mode. The conflict machinery is closed-set by
 * construction (the component-path owner iterates its closed tuple plus `mcpServers` here),
 * which is what keeps the two classes of field apart.
 */
export async function resolveLoose(
  entry: PluginEntry,
  ctx: ResolveContext,
): Promise<ResolvedPlugin> {
  return resolveWithMode(entry, ctx, {
    // Step 7 (MM-6 entry-only, D-07 array shape): no implicit-by-convention;
    // manifest declarations without a matching entry-level declaration are a
    // conflict. Array shape mirrors strict mode, but with first-wins dedup
    // applied only to entry-declared paths (no convention probing). The loose
    // collector takes no `ctx` precisely because it never probes disk.
    collectComponentPaths: (args) =>
      collectLooseComponentPaths({
        entry: args.entry,
        manifest: args.manifest,
        pluginRoot: args.pluginRoot,
        resolution: args.partial,
      }),
    // Step 8 (MM-7 loose mcpServers).
    applyMcp: (args) =>
      applyLooseMcp(args.entry, args.manifest, args.partial, args.pluginRoot, args.ctx),
  });
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
  if (!r.installable) {
    throw new PluginShapeError({
      kind: op === "update" ? "no-longer-installable" : "not-installable",
      plugin: r.name,
      reasons: r.notes,
      partialable: false,
      unsupportedKinds: [],
    });
  }

  if (r.state === "installable") {
    return;
  }

  throw new PluginShapeError({
    kind: op === "update" ? "no-longer-installable" : "not-installable",
    plugin: r.name,
    reasons: r.notes,
    // SEV-02 / D-69-03: `partially-available` is partially-available; `unavailable` is
    // a structural defect `--partial` cannot help -- carry the distinction the
    // render row uses to condition the `--partial` hint.
    partialable: true,
    // IN-02 / RSTATE-05: thread the typed unsupported-kind list so the
    // failure-row composer renders per-kind markers (e.g. `unsupported hooks`)
    // via the same `narrowUnsupportedKinds` path `list`/`info` use. Only the
    // `partially-available` arm carries the field; `unavailable` keeps an empty list so
    // its structural reasons stay sourced from `notes` (unchanged).
    unsupportedKinds: r.unsupported,
  });
}

/**
 * D-64-04 (RSTATE-04): the `--partial` narrowing gate. Admits both
 * `installable` and `partially-available` (`--partial` can degrade past the
 * unsupported parts)
 * but still rejects `unavailable` (structural defect -- `--partial` cannot help,
 * NFR-7). Throw shape mirrors `requireInstallable`; `r.notes` exists on all
 * three arms so `reasons` compiles.
 *
 * BFILL-01: the reinstall primitive (orchestrators/plugin/reinstall.ts) resolves
 * through this gate so it can re-materialize a partially-installed (`partially-available`)
 * plugin in place. The `--partial` install/update flag plumbing lands in a
 * later phase.
 */
export function requirePartialInstallable(
  r: ResolvedPlugin,
  op: "install" | "update" = "install",
): asserts r is ResolvedPluginInstallable | ResolvedPluginPartiallyAvailable {
  if (r.installable) {
    return;
  }

  throw new PluginShapeError({
    kind: op === "update" ? "no-longer-installable" : "not-installable",
    plugin: r.name,
    reasons: r.notes,
    // SEV-02 / D-69-03: this gate only ever throws for `unavailable`
    // (`installable`/`partially-available` return above), which `--partial` cannot help --
    // never partialable.
    partialable: false,
  });
}
