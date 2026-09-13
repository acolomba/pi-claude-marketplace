// domain/plugin-resolver.ts
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
import path from "node:path";

import { PluginShapeError } from "../shared/errors.ts";
import { PathContainmentError, assertPathInside } from "../shared/path-safety.ts";

import {
  collectLooseComponentPaths,
  collectStrictComponentPaths,
  type ComponentPathResolution,
} from "./component-paths.ts";
import { PLUGIN_MANIFEST_VALIDATOR, type PluginEntry } from "./components/plugin.ts";
import { resolveHooks, type HooksResolution } from "./hooks-resolution.ts";
import { resolveLooseMcp, resolveStrictMcp, type McpResolution } from "./mcp-resolution.ts";
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

interface PartialResolution extends ComponentPathResolution, McpResolution, HooksResolution {}

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
      resolveStrictMcp(
        {
          entry: args.entry,
          manifest: args.manifest,
          pluginRoot: args.pluginRoot,
          resolution: args.partial,
        },
        { statKind: statKindOf(args.ctx), readFileText: readFileTextOf(args.ctx) },
      ),
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
    await resolveHooks(
      { pluginRoot, resolution: partial },
      { statKind: statKindOf(ctx), readFileText: readFileTextOf(ctx) },
    ),
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
      resolveLooseMcp(
        {
          entry: args.entry,
          manifest: args.manifest,
          pluginRoot: args.pluginRoot,
          resolution: args.partial,
        },
        statKindOf(args.ctx),
      ),
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
 * BFILL-01: the reinstall flow and its direct clone probe
 * (orchestrators/plugin/reinstall-clone-probe.ts) resolve through this gate so
 * they can re-materialize a partially-installed (`partially-available`)
 * plugin in place. The `--partial` install/update flag plumbing lands later.
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
