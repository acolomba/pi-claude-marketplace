// domain/plugin-resolver.ts
//
// Plugin compatibility resolver. Returns the discriminated `ResolvedPlugin`
// union locked by NFR-7: TypeScript refuses to compile any code that reads
// `pluginRoot` from the structurally-broken `unavailable` variant.
//
// Strict resolution combines entry, manifest, conventional, and standalone declarations.
//
// The type-only schema retains literal-tagged discriminator variants.
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
// HOOK-01 / WINV-01: `hooks` is admitted alongside `skills` / `commands` /
// `agents` / `workflows` / `mcpServers`. The supported component result is a
// closed set; the path-validation loop iterates a PRIVATE subset
// (`COMPONENT_PATH_KINDS`) because `hooks` carries no per-entry
// component-path semantics -- the
// discovery path is the convention file `<pluginRoot>/hooks/hooks.json`,
// parsed through `parseHooksConfig` (D-57-04: a parse failure is structural
// and resolves `unavailable`).

import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { errorMessage, isErrnoException, PluginShapeError } from "../shared/errors.ts";
import { PathContainmentError, assertPathInside } from "../shared/path-safety.ts";

import { collectStrictComponentPaths, type ComponentPathResolution } from "./component-paths.ts";
import { PLUGIN_MANIFEST_VALIDATOR, type PluginEntry } from "./components/plugin.ts";
import { parseDeclaredDependencies } from "./dependencies.ts";
import { resolveHooks, type HooksResolution } from "./hooks-resolution.ts";
import { MANIFEST_CANDIDATES } from "./manifest-path.ts";
import { resolveStrictMcp, type McpResolution } from "./mcp-resolution.ts";
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
  } catch (err: unknown) {
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
    componentPaths: { skills: [], commands: [], agents: [], workflows: [] },
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

/**
 * The parse failure of an entry's own `dependencies` declaration, or
 * `undefined` when the entry declares none or declares them validly.
 * `domain/manifest.ts::normalizeDependencyEntries` keeps a malformed value on
 * the entry it isolates, so this re-parse is what names the real defect --
 * checked BEFORE source classification runs, so the reported defect names
 * `dependencies`, not `source`.
 */
function malformedDependenciesReason(entry: PluginEntry): string | undefined {
  if (!("dependencies" in entry)) {
    return undefined;
  }

  const dependencies = parseDeclaredDependencies(entry.dependencies);
  return dependencies.ok ? undefined : dependencies.reason;
}

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
  } catch (err: unknown) {
    if (err instanceof PathContainmentError) {
      return `source path escapes marketplace root: ${rawSource}`;
    }

    throw err;
  }
}

/** Distinguishes a missing candidate from a failed filesystem probe. */
async function manifestCandidateIsFile(
  ctx: ResolveContext,
  manifestPath: string,
): Promise<boolean> {
  try {
    return (await statKindOf(ctx)(manifestPath)) === "file";
  } catch (err: unknown) {
    if (isErrnoException(err) && (err.code === "ENOENT" || err.code === "ENOTDIR")) {
      return false;
    }

    // A failed stat is not evidence of absence. The manifest reader lets it
    // propagate, just like a read failure, without trying another file.
    throw err;
  }
}

/**
 * MANF-01 / MANF-02: reads the plugin's own manifest in `MANIFEST_CANDIDATES`
 * order, rejecting unusable candidates rather than trying another file.
 * MANF-05: no manifest at any candidate is a normal outcome, not a failure.
 */
async function readManifest(
  ctx: ResolveContext,
  pluginRoot: string,
): Promise<{ ok: true; manifest: Record<string, unknown> | null } | { ok: false; reason: string }> {
  for (const candidate of MANIFEST_CANDIDATES) {
    const manifestPath = path.join(pluginRoot, candidate);

    // D-01-07: ABSENCE is the only fall-through. The first candidate that
    // exists is this plugin's manifest and its read decides the outcome; a
    // present-but-unusable file never hands off to the next candidate.
    if (!(await manifestCandidateIsFile(ctx, manifestPath))) {
      continue;
    }

    // Stat and read failures (e.g. EACCES) retain their identity for the
    // outer probe classifier -- only the parse and validation below are a
    // real "malformed plugin.json".
    const raw = await readFileTextOf(ctx)(manifestPath);

    try {
      const parsed: unknown = JSON.parse(raw);

      if (!PLUGIN_MANIFEST_VALIDATOR.Check(parsed)) {
        const detail = PLUGIN_MANIFEST_VALIDATOR.Errors(parsed)
          .slice(0, 1)
          .map((error) => `${error.instancePath || "(root)"}: ${error.message}`)
          .join("");
        return { ok: false, reason: `malformed plugin.json: ${detail}` };
      }

      const dependencies = parseDeclaredDependencies(parsed.dependencies);
      if (!dependencies.ok) {
        return { ok: false, reason: `malformed plugin.json: ${dependencies.reason}` };
      }

      return { ok: true, manifest: parsed };
    } catch (err: unknown) {
      // D-01-08: this catch only ever sees a JSON.parse syntax error. Schema
      // rejection and an invalid `dependencies` declaration are direct
      // `return`s above, inside the same `try`, and never land here. All three
      // origins still end up observably identical to the caller: each
      // produces the same `malformed plugin.json: ...` reason on the
      // `unavailable` arm. A rejected stat (manifestCandidateIsFile rethrows
      // anything but ENOENT / ENOTDIR) or an unreadable file never lands here
      // either: both propagate above, so the caller's probe classifier can
      // name the failure class (D-01-09: neither is read as an absence).
      return {
        ok: false,
        reason: `malformed plugin.json: ${errorMessage(err)}`,
      };
    }
  }

  // D-01-13 / MANF-05: absent at every candidate. A plugin declaring no
  // manifest at all still resolves, and still installs.
  return { ok: true, manifest: null };
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
 * D-101-08: preflight reads manifest metadata before component resolution.
 * A manifest-only `defaultEnabled` never makes a plugin unavailable.
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
 * - `path`, pinned (`ctx.resolvePathPluginRoot` AND `ctx.pathPluginPin` both
 *   present, D-07-06): delegate to the callback and switch on its
 *   discriminated result exactly like the git branch below -- `materialized`
 *   carries the pin-anchored pluginRoot (containment is enforced INSIDE the
 *   callback against ITS OWN clone root, not `marketplaceRoot`, because the
 *   root changes for a pinned install); `escapes` / `missing-subdir` carry
 *   their structural detail; `not-cached` reports the plugin is not
 *   installed.
 * - `path`, unpinned (either field absent): resolve under `marketplaceRoot`
 *   and run the NFR-10 escape check VERBATIM (regression-critical -- a
 *   `../escape` path source resolves `unavailable` with the
 *   marketplace-root escape note; also the back-compat path for `list` /
 *   `info`, which construct a `ResolveContext` with neither field).
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
    if (ctx.resolvePathPluginRoot !== undefined && ctx.pathPluginPin !== undefined) {
      const r = await ctx.resolvePathPluginRoot(parsedSource, ctx.pathPluginPin);
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
 * Steps 1-6 validate the source and metadata before strict resolution. Returns
 * either:
 *   - { kind: "ok", pluginRoot, manifest, partial } -- proceed to component resolution
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
      // DFEN-03: resolved here, in the preflight stage before component resolution.
      defaultEnabled: boolean;
    }
  | { kind: "unavailable"; result: ResolvedPluginUnavailable }
> {
  const partial = emptyResolution();
  // Caller bug if name validation throws -- entry came through PLUGIN_ENTRY_VALIDATOR.
  assertSafeName(entry.name);

  // domain/manifest.ts::normalizeDependencyEntries isolates a marketplace
  // entry whose declared `dependencies` failed to parse before this resolver
  // ever sees it. Re-parsed first -- ahead of PR-2's source-kind classification
  // below -- so the reported defect names the field that is actually broken
  // (`dependencies`) rather than an unrecognized source kind.
  const dependencyDefect = malformedDependenciesReason(entry);
  if (dependencyDefect !== undefined) {
    return {
      kind: "unavailable",
      result: unavailable(entry.name, [
        ...partial.notes,
        `malformed marketplace entry: ${dependencyDefect}`,
      ]),
    };
  }

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
  const pre = await preflightStages(entry, ctx);

  if (pre.kind === "unavailable") {
    return pre.result;
  }

  const { pluginRoot, manifest, partial, defaultEnabled } = pre;
  const dirty = await runStructuralStages({ entry, ctx, pluginRoot, manifest, partial });

  // Step 9 (PR-3 / PR-4): unsupported components declared explicitly or via
  // Claude Code default locations (.lsp.json, monitors/monitors.json, etc.).
  // `hooks` is not in UNSUPPORTED_COMPONENT_KINDS -- HOOK-01 admission is
  // owned by step 8b. D-64-07: this signal does NOT feed `dirty` (it is
  // not a structural defect); it is read separately via `partial.unsupported`
  // in the decision below.
  await addUnsupportedKindNotes(entry, manifest, pluginRoot, ctx, partial);

  return decideResolution(entry.name, pluginRoot, partial, dirty, defaultEnabled);
}

/**
 * D-64-07: the STRUCTURAL accumulator (component-path / mcp / hooks defects).
 * The unsupported-component signal lives separately in `partial.unsupported`.
 * Every stage runs -- the flags are collected and folded at the end rather than
 * short-circuited, which is what the original `(await stage()) || dirty` chain
 * did too.
 *
 * Component-path collection owns the closed skills/commands/agents/workflows
 * subset; hooks-config discovery remains the separate shared stage below.
 */
async function runStructuralStages(args: {
  readonly entry: PluginEntry;
  readonly ctx: ResolveContext;
  readonly pluginRoot: string;
  readonly manifest: Record<string, unknown> | null;
  readonly partial: PartialResolution;
}): Promise<boolean> {
  const { entry, ctx, pluginRoot, manifest, partial } = args;
  const flags: boolean[] = [];

  flags.push(
    await collectStrictComponentPaths(
      { entry, manifest, pluginRoot, resolution: partial },
      statKindOf(ctx),
    ),
    await resolveStrictMcp(
      { entry, manifest, pluginRoot, resolution: partial },
      { statKind: statKindOf(ctx), readFileText: readFileTextOf(ctx) },
    ),
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

/**
 * D-64-01 / D-64-07: the three-way resolver decision. Structural
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
