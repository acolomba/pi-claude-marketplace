// orchestrators/plugin/info.ts
//
// Read-only info surface for `info <plugin>@<marketplace>`. MUST NOT
// touch the network (NFR-5) -- no `platform/git`, no `DEFAULT_GIT_OPS`,
// no `refreshGitHubClone`. The grep-gate test in
// `tests/orchestrators/plugin/info.test.ts` enforces this structurally
// (it strips comments before searching). IL-2: exactly one `notify()`
// call per invocation.
//
// INFO-05 source-kind gate: `"path"` sources are locally resolvable.
// `npm` / `unknown` sources stay unresolved (`componentsResolved: false`).
// The gate excludes non-resolvable SOURCES, not the not-installable
// verdict: a path-source plugin whose resolver returned
// `installable: false` (e.g. unsupported hooks, persistence-vs-disk
// disagreement) still enumerates components from disk via
// `composeResolvedComponents` on the not-installable variant -- both
// variants carry symmetric `componentPaths` / `mcpServers` /
// `hooksConfigPath`.
//
// RSTA-01 / RSTA-04 / RSTA-05 / RSTA-06 / D-80-04: a git source (url /
// git-subdir / github) is classified from its fs-only clone/mirror
// presence via `makePresenceProbe`. A COLD clone renders `(remote)` +
// `components: not resolved`; a WARM one resolves fs-only via the
// three-way resolver against the on-disk tree (available /
// partially-available / unavailable) and enumerates components from
// that warm `pluginRoot`. Reading the warm clone is fs-only -- never a
// fetch -- so NFR-5 holds.

import { readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import {
  BUCKET_A_EVENTS,
  TOOL_EVENTS,
  type ToolEvent,
} from "../../domain/components/hook-events.ts";
import {
  parseHooksConfig,
  type DroppedHook,
  type HooksConfig,
} from "../../domain/components/hooks.ts";
import { loadMarketplaceManifest, type MarketplaceManifest } from "../../domain/manifest.ts";
import {
  resolveStrict,
  type GitPluginRootResult,
  type ResolveContext,
  type ResolvedPluginUnavailable,
  type ResolvedPluginPartiallyAvailable,
} from "../../domain/resolver.ts";
import { parsePluginSource, type GitBackedSource, type ParsedSource } from "../../domain/source.ts";
import { loadMergedScopeConfig } from "../../persistence/config-merge.ts";
import { locationsFor, type ScopedLocations } from "../../persistence/locations.ts";
import { loadState, type ExtensionState } from "../../persistence/state-io.ts";
import { assertNever } from "../../shared/errors.ts";
import { classifyGitTransportFailure } from "../../shared/git-failure-classifiers.ts";
import {
  notifyWithContext,
  type MarketplaceRows,
  type Plural,
} from "../../shared/notify-context.ts";
import { notify } from "../../shared/notify.ts";
import { assertPathInside } from "../../shared/path-safety.ts";
import {
  narrowProbeError,
  narrowResolverNotes,
  narrowUnsupportedKinds,
} from "../../shared/probe-classifiers.ts";
import { DEFAULT_CREDENTIAL_OPS, buildAuthForHost, hostFromCloneUrl } from "../auth-host.ts";
import { isRecordedButDisabled } from "../reconcile/plan.ts";

import {
  canonicalCloneUrl,
  materializeOrRefreshPluginMirror,
  materializePluginClone,
  resolveGitSubdirRoot,
  resolvePluginPin,
} from "./clone-cache.ts";
import { makePresenceProbe } from "./git-source-probe.ts";
import { PLUGIN_INFO_CONTEXT, type PluginInfoCascadeMsg } from "./info.messaging.ts";

import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type { ClaudeHookEvent, HookSummaryEntry } from "../../shared/concerns/hooks.ts";
import type {
  ContentReason,
  NotificationMessage,
  PluginInfoMessage,
  PluginInfoRow,
} from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";
import type { AuthAttemptResult, CredentialOps, DeviceFlowHttp } from "../auth-host.ts";

// SURF-01: TOOL_EVENTS is a string[] tuple; rewrap as a Set
// for O(1) membership tests in the HookSummaryEntry projector. Module-
// scope so the Set is allocated once across all info.ts call sites.
const TOOL_EVENT_SET: ReadonlySet<string> = new Set<string>(TOOL_EVENTS);

// INFO-05: BUCKET_A_EVENTS is a string[] tuple; rewrap as a Set for O(1)
// membership tests in `readLenientHookSummary`'s per-event supported flag.
// Module-scope so the Set is allocated once across all info.ts call sites.
const BUCKET_A_EVENTS_SET: ReadonlySet<string> = new Set<string>(BUCKET_A_EVENTS);

export interface GetPluginInfoOptions {
  readonly ctx: ExtensionContext;
  /**
   * Required by `notify(ctx, pi, message)` for the soft-dep probe (info
   * surfaces do not emit soft-dep markers, but the probe argument is
   * threaded for signature parity with the cascade arm).
   */
  readonly pi: ExtensionAPI;
  readonly marketplace: string;
  readonly plugin: string;
  /** When omitted, fan-out across BOTH scopes (project-first per INFO-03). */
  readonly scope?: Scope;
  /** Project-scope cwd (ignored for user scope). */
  readonly cwd: string;
  /**
   * FTCH-03 / D-81-04: fetch the git-source clone/mirror THEN resolve and list
   * components in one step. Network on cache miss (pinned) or on the mirror
   * refresh (unpinned) (D-81-05, MIRR-02); a fetch failure degrades to the
   * existing `components: not resolved` arm with an existing closed-set reason
   * and NEVER fails info. Omitted / false keeps info network-free (bare info
   * behaves exactly as before).
   */
  readonly fetch?: boolean;
  /**
   * Test-only clone-cache seam override. When undefined (production), the
   * git-source fetch flows through the real `resolvePluginPin` /
   * `materializePluginClone` / `materializeOrRefreshPluginMirror` imports; tests
   * inject mock-backed versions so `info --fetch` runs without the network.
   */
  readonly cloneCacheSeam?: InfoCloneCacheSeam;
  /** FTCH-06 credential seam (install parity); tests inject a mock. */
  readonly credentialOps?: CredentialOps;
  /** FTCH-06 Device Flow HTTP seam (install parity); tests inject a mock. */
  readonly deviceFlowHttp?: DeviceFlowHttp;
  /** FTCH-06 / D-79-02 once-per-host auth memo. */
  readonly authMemo?: Map<string, AuthAttemptResult>;
}

/**
 * FTCH-04 / NFR-5: injected clone-cache seam for the `info --fetch` hook. info.ts
 * is a FORBIDDEN_TARGET for the git surface (no-orchestrator-network gate), so
 * the fetch-materialize flows through the sibling `clone-cache.ts` seam by name
 * -- info NEVER references the git ops directly. Mirrors
 * `install.ts::InstallCloneCacheSeam`. Production leaves it undefined and info
 * uses the real imports (which default to the real git backend internally).
 */
export interface InfoCloneCacheSeam {
  readonly resolvePluginPin: typeof resolvePluginPin;
  readonly materializePluginClone: typeof materializePluginClone;
  readonly materializeOrRefreshPluginMirror: typeof materializeOrRefreshPluginMirror;
}

/**
 * FTCH-03 / D-81-05: derive the per-command fetch context from the caller
 * options. Returns undefined unless `--fetch` was passed (so every row builder
 * stays fs-only for bare info). Production defaults to the real clone-cache
 * imports + `DEFAULT_CREDENTIAL_OPS`; tests inject mock-backed seams. The
 * command-scope auth memo caps a Device Flow at once per host (D-79-02).
 */
function buildInfoFetchContext(opts: GetPluginInfoOptions): InfoFetchContext | undefined {
  if (opts.fetch !== true) {
    return undefined;
  }

  return {
    ctx: opts.ctx,
    seam: opts.cloneCacheSeam ?? {
      resolvePluginPin,
      materializePluginClone,
      materializeOrRefreshPluginMirror,
    },
    credentialOps: opts.credentialOps ?? DEFAULT_CREDENTIAL_OPS,
    ...(opts.deviceFlowHttp !== undefined && { deviceFlowHttp: opts.deviceFlowHttp }),
    authMemo: opts.authMemo ?? new Map<string, AuthAttemptResult>(),
  };
}

type MarketplaceRecord = ExtensionState["marketplaces"][string];

/**
 * A `"path"` source (relative to the marketplace root) is locally
 * resolvable; every other kind lives at an unsynced external location
 * the orchestrator MUST NOT fetch (NFR-5). Exhaustive `switch (src.kind)`
 * over `ParsedSource` with `assertNever` so a future source kind is a
 * compile-time error here.
 */
function isLocallyResolvable(src: ParsedSource): boolean {
  switch (src.kind) {
    case "path":
      return true;
    case "github":
    case "url":
    case "git-subdir":
    case "npm":
    case "unknown":
      return false;
    default:
      assertNever(src);
      return false;
  }
}

/**
 * RSTA-01 / RSTA-06: a git-clonable source (url / git-subdir / github). These
 * three kinds materialize from a remote clone at install time. Offline, a
 * not-installed git entry is classified from its fs-only clone/mirror presence
 * (D-80-04): a COLD clone renders `(remote)`; a WARM one resolves fs-only via
 * the three-way resolver. `npm` / `unknown` are NOT git sources (they stay on
 * the structural `(unavailable)` path), and `path` is the locally-resolvable
 * kind handled by its own arm. Narrows to the git-source union so callers can
 * feed the presence probe (whose input is exactly these three kinds).
 */
function isGitSource(src: ParsedSource): src is GitBackedSource {
  return src.kind === "url" || src.kind === "git-subdir" || src.kind === "github";
}

/**
 * Re-derive `pluginRoot` for a path-source plugin so the info surface
 * can call `composeResolvedComponents` against the resolver's
 * NOT-installable variant (NFR-7 keeps `pluginRoot` off that variant).
 * Mirrors `preflightStages`'s derivation -- same `path.resolve` against
 * `marketplaceRoot` + the raw user input -- AND re-asserts NFR-10
 * containment via `assertPathInside`. The resolver's `sourceEscapeReason`
 * accepted these paths at install time, but the marketplace clone can
 * mutate between install and info-render (manifest edit, symlink swap),
 * so a fresh check here prevents `composeResolvedComponents` from
 * walking a directory outside the marketplace root. A containment
 * failure throws `PathContainmentError`. This throw is raised BEFORE
 * `buildNotInstallablePathRowFields`'s inner try (which wraps
 * `composeResolvedComponents` only), so it propagates past that helper to
 * the ROW builder. Both row callers -- `buildInstalledRow` and
 * `buildNotInstalledRow` (WR-02) -- wrap their `buildNonInstallableRowFields`
 * call in an outer try/catch, so the error surfaces via `narrowProbeError`'s
 * generic-Error arm (`unreadable`) rather than escaping `getPluginInfo`.
 * The programmer-bug `throw new Error(...)` on the non-path source kind
 * likewise propagates to and is classified by those same outer catches.
 */
async function derivePluginRootForInfo(
  marketplaceRoot: string,
  source: ParsedSource,
): Promise<string> {
  // Caller must gate on `source.kind === "path"`; narrowing here keeps
  // the helper's input type aligned with the discriminated union.
  if (source.kind !== "path") {
    throw new Error(`derivePluginRootForInfo requires a path source (got ${source.kind})`);
  }

  const pluginRoot = path.resolve(marketplaceRoot, source.raw);
  await assertPathInside(marketplaceRoot, pluginRoot, `plugin source for "${source.raw}"`);
  return pluginRoot;
}

/**
 * Walk one or more component-kind DIRECTORIES (relative to the plugin
 * root) and accumulate the per-kind component NAMES.
 *
 * For each declared directory:
 *   - skills:   directory entries -> directory NAMES (each skill is a
 *               subdirectory; `isSkillDir` filtering is bridge-layer
 *               only -- info surfaces authoring intent).
 *   - commands: file entries -> basename minus `.md` suffix.
 *   - agents:   file entries -> basename minus `.md` suffix.
 *
 * Read failures of ENOENT/ENOTDIR yield an empty bucket (declared dir
 * doesn't exist yet -- legitimate "no components" state). Every other
 * failure propagates so the row builder can classify via
 * `narrowProbeError` and surface a `{permission denied}` / `{unreadable}`
 * reason rather than silently rendering as "no components". The
 * renderer requires PRE-SORTED arrays; this helper sorts before
 * returning.
 */
/** Extract the displayable name from a single directory entry per `kind`,
 *  or `undefined` if the entry does not qualify. */
function nameFromEntry(
  entry: { name: string; isDirectory(): boolean; isFile(): boolean },
  kind: "skills" | "commands" | "agents",
): string | undefined {
  if (kind === "skills") {
    return entry.isDirectory() ? entry.name : undefined;
  }

  // commands + agents: `.md` files; strip the suffix for display.
  return entry.isFile() && entry.name.endsWith(".md") ? entry.name.slice(0, -3) : undefined;
}

/**
 * Read directory entries. ENOENT / ENOTDIR yield an empty array
 * (declared dir doesn't exist yet -- a legitimate "no components in
 * this kind" state). Every other failure (EACCES, EPERM, EIO, ...)
 * PROPAGATES so the row builder can classify via `narrowProbeError`
 * and surface a `{permission denied}` / `{unreadable}` reason rather
 * than silently rendering as "no components declared".
 */
async function readEntriesOrEmpty(
  abs: string,
): Promise<readonly { name: string; isDirectory(): boolean; isFile(): boolean }[]> {
  try {
    return await readdir(abs, { withFileTypes: true });
  } catch (err) {
    if (err instanceof Error) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT" || code === "ENOTDIR") {
        return [];
      }
    }

    throw err;
  }
}

async function discoverComponentNames(
  pluginRoot: string,
  componentDirs: readonly string[],
  kind: "skills" | "commands" | "agents",
): Promise<readonly string[]> {
  const names = new Set<string>();
  for (const rel of componentDirs) {
    const abs = path.isAbsolute(rel) ? rel : path.join(pluginRoot, rel);
    const entries = await readEntriesOrEmpty(abs);
    for (const entry of entries) {
      const name = nameFromEntry(entry, kind);
      if (name !== undefined) {
        names.add(name);
      }
    }
  }

  return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

/**
 * Resolve a manifest entry's `dependencies` field into a sorted
 * `readonly string[]` for the renderer. The schema keeps this field
 * opaque (`Type.Unknown()`); the renderer surfaces dependencies as
 * `<plugin>@<marketplace>` strings when the manifest provides them in
 * that form. When the field is an array of strings, sort
 * alphabetically (deterministic byte form across manifest authoring
 * orders); any other shape returns `undefined` so the renderer omits
 * the `dependencies:` line.
 */
function normalizeDependencies(raw: unknown): readonly string[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }

  const strings = raw.filter((d): d is string => typeof d === "string");
  if (strings.length === 0) {
    return undefined;
  }

  return [...strings].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

/**
 * SURF-01 / D-63-04 / D-63-06: project a parsed `HooksConfig` to the
 * `HookSummaryEntry[]` shape the renderer consumes. One entry per
 * (event, group) tuple in declaration order from the parsed file --
 * `Object.entries` and `Array` iteration both preserve insertion order
 * for plain objects (the JSON.parse output `parseHooksConfig` returns),
 * so the rendered order matches the on-disk authoring order.
 *
 * Tool events (`PreToolUse` / `PostToolUse` / `PostToolUseFailure`)
 * carry the group's `matcher` (defaulting to the empty string when the
 * group's `matcher` is absent -- match-all per MATCH-01); non-tool
 * events do not carry one. Granularity is per-GROUP, not per-handler:
 * the renderer surfaces `event(matcher)` once per group regardless of
 * how many handlers the group declares.
 *
 * Pure and total: never throws. The supportability gate in
 * `checkMatcherSupportability` has already accepted every event key as
 * a `BucketAEvent`, so the tool-event discriminator is a closed-set
 * membership check against `TOOL_EVENTS`.
 */
function projectHookSummaryEntries(parsed: HooksConfig): readonly HookSummaryEntry[] {
  const entries: HookSummaryEntry[] = [];
  for (const [eventName, groups] of Object.entries(parsed)) {
    for (const group of groups) {
      if (TOOL_EVENT_SET.has(eventName)) {
        entries.push({
          event: eventName as ToolEvent,
          matcher: group.matcher ?? "",
        });
      } else {
        // Cast: the assertion is upheld by the supportability gate's
        // bucket-A admission check (every event key surviving
        // `parseHooksConfig.ok = true` is a `ClaudeHookEvent`, and the
        // tool-event guard above excludes the `ToolEvent` subset).
        entries.push({
          event: eventName as Exclude<ClaudeHookEvent, ToolEvent>,
        });
      }
    }
  }

  return entries;
}

/**
 * PHOOK-05 / D-71-05: project the partition's `dropped` enumeration to
 * lenient `HookSummaryEntry` rows so a partially-available plugin enumerates
 * the handlers the install path WILL drop. A `kind:"event"` drop (a whole
 * non-bucket-A event, P1) renders bare `<event> (unsupported)`; a
 * `kind:"group"` (P2-P5) or `kind:"handler"` (P6) drop renders at
 * matcher-group granularity `<event>(<matcher>) (unsupported)`. Multiple
 * handler drops sharing one matcher group collapse to a single line
 * (matcher-group granularity), so the dropped block mirrors the supported
 * block's one-line-per-group convention (FSTAT-07 dropped-component detail).
 */
function projectDroppedHookEntries(dropped: readonly DroppedHook[]): readonly HookSummaryEntry[] {
  const entries: HookSummaryEntry[] = [];
  const seen = new Set<string>();
  for (const drop of dropped) {
    const matcher = drop.kind === "event" ? undefined : drop.matcher;
    const key = `${drop.event} ${matcher ?? ""}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    entries.push({
      kind: "lenient",
      event: drop.event,
      supported: false,
      ...(matcher !== undefined && { matcher }),
    });
  }

  return entries;
}

/**
 * Read & re-parse `<pluginRoot>/<resolved.hooksConfigPath>` from disk
 * and project to `HookSummaryEntry[]`. The resolver discards the parsed
 * value (it only records `hooksConfigPath`), so the info renderer must
 * re-open the file at info-render time. Returns `undefined` when the
 * file has no `hooksConfigPath` (the plugin declares no hooks), or
 * when the re-parse fails (the resolver would then have resolved
 * `unavailable`, which carries no `hooksConfigPath`, so this branch is
 * defensive only -- the file was parseable at resolve time).
 *
 * PHOOK-05 / D-71-05: `parseHooksConfig` returns the FILTERED supported
 * subset as `value` plus the `dropped` enumeration. For a partially-available
 * plugin the row records `hooksConfigPath`, so info routes HERE (the strict
 * reader) rather than the lenient bail reader -- the dropped enumeration
 * must therefore render on THIS path or it vanishes. The supported entries
 * render plain (declaration order); the dropped entries render
 * `(unsupported)`-suffixed afterwards, re-derived from the SAME pure parse
 * (no separate threading -- the partition is deterministic).
 *
 * I/O failures (EACCES / ENOENT after resolve) PROPAGATE so the row
 * builder's outer catch can classify via the existing `narrowProbeError`
 * ladder unchanged. The error never reaches the user as a hooks-specific
 * REASON -- it surfaces as the same `{permission denied}` / `{unreadable}`
 * the other component-kind probes emit.
 */
async function readHookSummaryEntries(
  pluginRoot: string,
  hooksConfigPath: string,
): Promise<readonly HookSummaryEntry[] | undefined> {
  const raw = await readFile(path.join(pluginRoot, hooksConfigPath), "utf8");
  // MATCH-03 / A1 projectRoot fallback: mirrors the resolver's
  // `readStandaloneHooks` call site. The info surface only consumes the
  // installable-verdict + parsed value; the `if`-field side-Map is
  // discarded via `skipIfMap: true`, and the no-op `compileIf` is never
  // invoked.
  const ifCtx = { homedir: homedir(), cwd: process.cwd(), projectRoot: process.cwd() };
  const noopCompileIf = (): null => null;
  const parsed = parseHooksConfig(raw, ifCtx, noopCompileIf, { skipIfMap: true });
  if (!parsed.ok) {
    return undefined;
  }

  const supported = projectHookSummaryEntries(parsed.value);
  const dropped = projectDroppedHookEntries(parsed.dropped);
  return [...supported, ...dropped];
}

/**
 * INFO-05 / HOOK-01: best-effort hooks reader for the info surface ONLY.
 * Runs whenever `resolved.hooksConfigPath === undefined`, which covers
 * two distinct cases: (a) the resolver bailed on supportability (the
 * strict parser flipped `installable: false` because declared events
 * fall outside bucket A, the matcher-supportability gate refused, etc.)
 * and (b) the plugin declares no hooks file at all -- `hooks/hooks.json`
 * does not exist on disk. Case (b) is handled harmlessly by the ENOENT
 * branch below, which returns `undefined` and the row simply omits the
 * `hooks:` block. The strict resolver-side parser
 * (`domain/components/hooks.ts::parseHooksConfig`, HOOK-01) is unchanged
 * -- install correctness is non-negotiable; this helper is a READ-ONLY
 * info-surface augmentation that never feeds the install path.
 *
 * Returns one lenient entry per declared event whose `groups` array is
 * non-empty (entries with an empty / whitespace-only event key are
 * skipped so a malformed `{"hooks": {"": [...]}}` payload cannot render
 * as a blank row), with `supported` set to the bucket-A membership of
 * the event key.
 *
 * Error contract -- parity with `readEntriesOrEmpty` and with the
 * strict sibling `readHookSummaryEntries`: ENOENT / ENOTDIR / SyntaxError
 * / wrong-shape collapse to `undefined`; EACCES / EPERM / EIO and every
 * other programmer-bug throw PROPAGATE to the row builder's outer catch
 * for classification via `narrowProbeError`. NFR-5: reads
 * `<pluginRoot>/hooks/hooks.json` only, no network.
 */
async function readLenientHookSummary(
  pluginRoot: string,
): Promise<readonly HookSummaryEntry[] | undefined> {
  const p = path.join(pluginRoot, "hooks", "hooks.json");
  const raw = await readLenientHooksFile(p);
  if (raw === undefined) {
    return undefined;
  }

  const data = parseLenientHooksJson(raw);
  if (data === undefined) {
    return undefined;
  }

  if (typeof data !== "object" || data === null || !("hooks" in data)) {
    return undefined;
  }

  const hooks = data.hooks;
  if (typeof hooks !== "object" || hooks === null || Array.isArray(hooks)) {
    return undefined;
  }

  const entries: HookSummaryEntry[] = [];
  for (const [eventName, groups] of Object.entries(hooks)) {
    if (eventName.trim().length === 0) {
      continue;
    }

    const groupCount = Array.isArray(groups) ? groups.length : 0;
    if (groupCount === 0) {
      continue;
    }

    entries.push({
      kind: "lenient",
      event: eventName,
      supported: BUCKET_A_EVENTS_SET.has(eventName),
    });
  }

  return entries.length === 0 ? undefined : entries;
}

/**
 * Lenient hooks file read. ENOENT / ENOTDIR collapse to `undefined`
 * (no hooks file, or a parent path component is not a directory --
 * legitimate "no hooks declared" state). Every other failure
 * (EACCES / EPERM / EIO / programmer-bug) PROPAGATES.
 */
async function readLenientHooksFile(absPath: string): Promise<string | undefined> {
  try {
    return await readFile(absPath, "utf8");
  } catch (err) {
    if (err instanceof Error) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT" || code === "ENOTDIR") {
        return undefined;
      }
    }

    throw err;
  }
}

/**
 * Lenient hooks file parse. `SyntaxError` collapses to `undefined`
 * (unparseable JSON -- the row-level `{unsupported hooks}` brace already
 * carries the user-visible signal). Every other throw (programmer-bug
 * `TypeError`, etc.) PROPAGATES.
 */
function parseLenientHooksJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (err) {
    if (err instanceof SyntaxError) {
      return undefined;
    }

    throw err;
  }
}

/**
 * Compose the resolved-components field of a `PluginInfoRow`. Walks
 * `resolved.componentPaths` to discover per-kind component names on
 * disk; for mcpServers, the `resolved.mcpServers` keys ARE the names.
 * For hooks, re-parses `<pluginRoot>/<resolved.hooksConfigPath>` and
 * projects the result to `HookSummaryEntry[]` (the resolver discards
 * the parsed value -- info.ts must re-open the file). Empty per-kind
 * arrays return `undefined` so the renderer omits the line (the
 * renderer assumes pre-sorted input and does not sort defensively).
 *
 * SURF-01: object-literal field placement is documentation
 * only -- the renderer iterates `COMPONENT_KINDS` to enforce the
 * `["agents", "commands", "hooks", "mcp", "skills"]` ordering. Source
 * placement matches the alphabetical order for readability.
 */
async function composeResolvedComponents(
  pluginRoot: string,
  resolved: {
    readonly componentPaths: {
      readonly skills: readonly string[];
      readonly commands: readonly string[];
      readonly agents: readonly string[];
    };
    readonly mcpServers: Record<string, unknown>;
    readonly hooksConfigPath?: string;
  },
): Promise<{
  readonly agents?: readonly string[];
  readonly commands?: readonly string[];
  readonly hooks?: readonly HookSummaryEntry[];
  readonly mcp?: readonly string[];
  readonly skills?: readonly string[];
}> {
  const agents = await discoverComponentNames(pluginRoot, resolved.componentPaths.agents, "agents");
  const commands = await discoverComponentNames(
    pluginRoot,
    resolved.componentPaths.commands,
    "commands",
  );
  const skills = await discoverComponentNames(pluginRoot, resolved.componentPaths.skills, "skills");
  const mcp = Object.keys(resolved.mcpServers).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );

  // SURF-01 / D-63-07: hooks branch. Read-and-project happens ONCE at
  // message-construction time (no string re-derivation at render time).
  // I/O failures propagate to the row-builder catch where
  // `narrowProbeError` classifies via the existing ladder (Open Question
  // 3 in 63-RESEARCH.md: no new REASON, no new code path).
  //
  // INFO-05: when the resolver did NOT record `hooksConfigPath` (the
  // strict parser bailed; row is a path-resolvable
  // `(unavailable) {unsupported hooks}` carrier), fall back to the
  // best-effort `readLenientHookSummary` so the info surface still lists
  // every top-level event the plugin declared, tagging non-bucket-A
  // events as `(unsupported)`.
  const hooks =
    resolved.hooksConfigPath === undefined
      ? await readLenientHookSummary(pluginRoot)
      : await readHookSummaryEntries(pluginRoot, resolved.hooksConfigPath);

  return {
    ...(agents.length > 0 && { agents }),
    ...(commands.length > 0 && { commands }),
    ...(hooks !== undefined && hooks.length > 0 && { hooks }),
    ...(mcp.length > 0 && { mcp }),
    ...(skills.length > 0 && { skills }),
  };
}

/**
 * Build a `PluginInfoMessage` for ONE scope-record pair. Branches:
 *   (a) Manifest read failure -> `(failed) {<reason>}` row, reason
 *       classified via `narrowProbeError`.
 *   (b) Plugin name not in manifest -> `(failed) {not in manifest}`.
 *   (c) Installed -> `(installed)` row + (path source -> resolved
 *       components; other sources -> `components: not resolved`).
 *   (d) Available (resolveStrict installable) -> `(available)` row.
 *   (e) Unavailable (resolveStrict not installable OR threw) ->
 *       `(unavailable)` row with closed-set reasons.
 */
async function buildBlock(
  marketplace: string,
  pluginName: string,
  scope: Scope,
  mpRecord: MarketplaceRecord,
  autoupdate: boolean,
  cwd: string,
  fetchCtx?: InfoFetchContext,
): Promise<PluginInfoMessage> {
  const marketplaceDetails = { autoupdate };

  // RSTA-06 / NFR-5: the per-scope locations feed `makePresenceProbe`'s
  // fs-only clone/mirror presence check so a git-source row resolves warm
  // trees without touching the network. Built once per block.
  const locations = locationsFor(scope, cwd);

  // (a) Manifest read failure -> bare `(failed) {<reason>}` row under
  // the marketplace header. The reason is CLASSIFIED via the same
  // `narrowProbeError` ladder used elsewhere in this file so an
  // EACCES, ENOENT, or SyntaxError on `marketplace.json` produces the
  // same closed-set Reason that `list.ts` would surface for the same
  // failure -- the two read-only surfaces stay in lockstep. The
  // `componentsResolved: true` arm with an EMPTY components map keeps
  // the renderer's switch quiet (no `components: not resolved` marker,
  // no per-kind lines) -- a failure row is its own structural signal;
  // INFO-05's marker is reserved for external-source `(installed)` /
  // `(available)` rows.
  let manifest: MarketplaceManifest;
  try {
    manifest = await loadMarketplaceManifest(mpRecord.manifestPath);
  } catch (err) {
    return {
      kind: "plugin-info",
      marketplaceName: marketplace,
      marketplaceScope: scope,
      marketplaceDetails,
      plugin: {
        status: "failed",
        name: pluginName,
        reasons: [narrowProbeError(err)],
        componentsResolved: true,
        components: {},
      },
    };
  }

  // (b) Plugin name not in manifest -> `(failed) {not in manifest}`.
  // Same `componentsResolved: true` + empty components rationale as
  // (a) above.
  const entry = manifest.plugins.find((p) => p.name === pluginName);
  if (entry === undefined) {
    return {
      kind: "plugin-info",
      marketplaceName: marketplace,
      marketplaceScope: scope,
      marketplaceDetails,
      plugin: {
        status: "failed",
        name: pluginName,
        reasons: ["not in manifest"],
        componentsResolved: true,
        components: {},
      },
    };
  }

  const installed = mpRecord.plugins[pluginName];
  const installedVersion = installed?.version;
  const manifestVersion = entry.version;
  const description = entry.description;
  const dependencies = normalizeDependencies((entry as Record<string, unknown>).dependencies);

  // INFO-05 source-kind gate. `parsedSource` is threaded into both row
  // builders so the not-installable arms can enumerate components from
  // disk against the resolver's not-installable variant when the source
  // is path-resolvable; non-path sources still emit
  // `componentsResolved: false`.
  const parsedSource = parsePluginSource((entry as Record<string, unknown>).source);

  // (c) Installed bucket.
  if (installed !== undefined) {
    const row = await buildInstalledRow({
      pluginName,
      version: installedVersion ?? manifestVersion,
      description,
      dependencies,
      entry,
      mpRecord,
      installedRecord: installed,
      parsedSource,
      locations,
      ...(fetchCtx !== undefined && { fetchCtx }),
    });
    return wrapBlock(marketplace, scope, marketplaceDetails, row);
  }

  // (d) / (e) Not installed -> resolve to classify remote / available /
  // partially-available / unavailable.
  const row = await buildNotInstalledRow({
    pluginName,
    version: manifestVersion,
    description,
    dependencies,
    entry,
    mpRecord,
    parsedSource,
    locations,
    ...(fetchCtx !== undefined && { fetchCtx }),
  });
  return wrapBlock(marketplace, scope, marketplaceDetails, row);
}

function wrapBlock(
  marketplace: string,
  scope: Scope,
  marketplaceDetails: { readonly autoupdate: boolean },
  plugin: PluginInfoRow,
): PluginInfoMessage {
  return {
    kind: "plugin-info",
    marketplaceName: marketplace,
    marketplaceScope: scope,
    marketplaceDetails,
    plugin,
  };
}

/**
 * Build the `componentsResolved` arm for a path-source plugin whose
 * resolver returned the not-installable variant. NFR-7 keeps
 * `pluginRoot` off that variant, so it is re-derived locally; the
 * not-installable variant carries the same `componentPaths` /
 * `mcpServers` / `hooksConfigPath` shape `composeResolvedComponents`
 * consumes. A discovery throw (EACCES on a component dir, etc.) falls
 * back to `componentsResolved: false` with `narrowProbeError(err)`
 * appended to the resolver reasons.
 *
 * Called from two arms:
 *   - `buildInstalledRow` when the state record says installed but
 *     `resolveStrict` returned the not-installable variant
 *     (persistence-vs-disk disagreement -- the marketplace clone
 *     changed, or the manifest now declares an unsupported field).
 *   - `buildNotInstalledRow` when the plugin is not installed and
 *     `resolveStrict` returned the not-installable variant (path
 *     source with unsupported manifest fields / unsupported hooks).
 */
async function buildNotInstallablePathRowFields(
  resolved: Parameters<typeof composeResolvedComponents>[1],
  resolverReasons: readonly ContentReason[],
  marketplaceRoot: string,
  parsedSource: ParsedSource,
): Promise<
  | {
      readonly reasons?: readonly ContentReason[];
      readonly componentsResolved: true;
      readonly components: Awaited<ReturnType<typeof composeResolvedComponents>>;
    }
  | {
      readonly reasons: readonly ContentReason[];
      readonly componentsResolved: false;
    }
> {
  const pluginRoot = await derivePluginRootForInfo(marketplaceRoot, parsedSource);
  // NFR-7 / INFO-05: only `composeResolvedComponents` failures
  // (component-dir EACCES, hooks-file EACCES/EIO, malformed JSON the
  // lenient reader propagates) fall into the `narrowProbeError(err)`
  // arm here. `derivePluginRootForInfo`'s own throws -- the
  // programmer-bug `Error` for a non-path source AND the
  // `PathContainmentError` from `assertPathInside` -- propagate
  // unmasked to the caller; classifying them as IO probe failures
  // would mis-route a path-escape as a transient disk error.
  try {
    const components = await composeResolvedComponents(pluginRoot, resolved);
    return {
      ...(resolverReasons.length > 0 && { reasons: resolverReasons }),
      componentsResolved: true,
      components,
    };
  } catch (err) {
    return {
      reasons: [...resolverReasons, narrowProbeError(err)],
      componentsResolved: false,
    };
  }
}

/**
 * D-64-05: re-derive the component-path map for the MINIMAL `unavailable`
 * arm, which (unlike `installable` / `partially-available`) does not carry
 * `componentPaths`. The info surface re-resolves independently from the
 * marketplace entry's declared component paths plus the conventional
 * `<pluginRoot>/{skills,commands,agents}` locations; `composeResolvedComponents`
 * tolerates missing directories (ENOENT -> empty), so a declared-but-absent
 * or convention-absent directory contributes nothing. This keeps the
 * `(unavailable)`/`(installed)` path-source rows enumerating on-disk
 * components without reading the arm's stripped fields (NFR-7).
 */
function deriveLenientComponentPaths(entry: MarketplaceManifest["plugins"][number]): {
  skills: string[];
  commands: string[];
  agents: string[];
} {
  const out = {
    skills: ["skills"],
    commands: ["commands"],
    agents: ["agents"],
  };
  for (const kind of ["skills", "commands", "agents"] as const) {
    for (const d of asDeclaredList((entry as Record<string, unknown>)[kind])) {
      if (typeof d === "string" && !out[kind].includes(d)) {
        out[kind].push(d);
      }
    }
  }

  return out;
}

/** Normalize a raw entry component field to a flat list (undefined/null -> []). */
function asDeclaredList(raw: unknown): readonly unknown[] {
  if (Array.isArray(raw)) {
    return raw;
  }

  if (raw === undefined || raw === null) {
    return [];
  }

  return [raw];
}

/**
 * Build the not-installable row fields for either non-installable arm.
 * `partially-available` carries the full component payload (read directly);
 * `unavailable` is minimal, so its component paths are re-derived
 * independently via `deriveLenientComponentPaths` (D-64-05).
 *
 * D-64-02 / RSTATE-05: the per-kind unsupported markers for the `partially-available`
 * arm derive from the typed `unsupported[]` component-kind list via the shared
 * render helper; the structural `unavailable` arm's reasons stay on the `notes`
 * path via `narrowResolverNotes`.
 */
function buildNonInstallableRowFields(
  resolved: ResolvedPluginPartiallyAvailable | ResolvedPluginUnavailable,
  entry: MarketplaceManifest["plugins"][number],
  marketplaceRoot: string,
  parsedSource: ParsedSource,
): ReturnType<typeof buildNotInstallablePathRowFields> {
  // WR-03: discriminate the union with an exhaustive `switch (resolved.state)`
  // + `assertNever` so a future fourth `ResolvedPlugin` arm becomes a
  // compile-time error here rather than silently falling through to the
  // `unavailable`/`notes` path.
  switch (resolved.state) {
    case "partially-available":
      return buildNotInstallablePathRowFields(
        resolved,
        narrowUnsupportedKinds(resolved.unsupported),
        marketplaceRoot,
        parsedSource,
      );
    case "unavailable":
      return buildNotInstallablePathRowFields(
        {
          componentPaths: deriveLenientComponentPaths(entry),
          mcpServers: {},
        },
        narrowResolverNotes(resolved.notes),
        marketplaceRoot,
        parsedSource,
      );
    default:
      return assertNever(resolved);
  }
}

/**
 * WR-02 / D-66-01: build the `(installed)` / `(partially-installed)` row for a
 * NON-PATH source (github / npm / url / git-subdir). INFO-05 defers LIVE
 * component resolution for these sources to preserve NFR-5 (never fetch), so
 * `componentsResolved: false` is always emitted. The install-time
 * `compatibility.unsupported` record, however, was persisted AT INSTALL and is
 * read OFFLINE here -- the SAME single deriver `list` reads (list.ts
 * partially-installed branch). A recorded-installed non-path plugin whose install
 * dropped one or more components therefore reports `(partially-installed)` here too,
 * so `info` and `list` never diverge on the derived partial state for non-path
 * sources.
 */
function buildNonPathInstalledRow(
  pluginName: string,
  version: string | undefined,
  description: string | undefined,
  installedRecord: MarketplaceRecord["plugins"][string],
): PluginInfoRow {
  const status =
    installedRecord.compatibility.unsupported.length > 0 ? "partially-installed" : "installed";
  return {
    status,
    name: pluginName,
    ...(version !== undefined && { version }),
    ...(description !== undefined && { description }),
    ...(status === "partially-installed" && {
      reasons: narrowUnsupportedKinds(installedRecord.compatibility.unsupported),
    }),
    componentsResolved: false,
  };
}

/**
 * FTCH-06 / D-81-05: the per-command auth + seam context for the `info --fetch`
 * hook. Built once in `getPluginInfo` when `opts.fetch === true`, threaded down
 * to the git-source row builders. `locations` are supplied per-block by the
 * caller. Mirrors the install clone-probe's auth bundle wiring; info reaches the
 * git surface ONLY through the `clone-cache.ts` seam + `auth-host.ts`
 * re-exports (no-orchestrator-network gate, NFR-5).
 */
interface InfoFetchContext {
  readonly ctx: ExtensionContext;
  readonly seam: InfoCloneCacheSeam;
  readonly credentialOps: CredentialOps;
  readonly deviceFlowHttp?: DeviceFlowHttp;
  readonly authMemo?: Map<string, AuthAttemptResult>;
}

/**
 * A git-source presence/materialize probe: maps a git source to its on-disk
 * `pluginRoot` (fs-only for bare info, materializing for `info --fetch`). Both
 * arms return the same `GitPluginRootResult` shape so the row builders classify
 * warm/cold identically regardless of which probe ran.
 */
type GitProbe = (source: GitBackedSource) => Promise<GitPluginRootResult>;

/**
 * FTCH-06 / T-81-08: build the host-keyed auth bundle for a resolved cloneUrl at
 * install parity (PROV-02/03/04): a registered provider host authenticates, a
 * no-provider / public host clones authless. `buildAuthForHost` never
 * interpolates credentials into any surfaced string (AUTH-09). Mirrors
 * `install.ts::buildProbeAuth`.
 */
function buildFetchAuth(
  cloneUrl: string,
  kind: "url" | "git-subdir" | "github",
  fetchCtx: InfoFetchContext,
) {
  const host = hostFromCloneUrl(cloneUrl, kind);
  return buildAuthForHost({
    host,
    credentialOps: fetchCtx.credentialOps,
    ctx: fetchCtx.ctx,
    ...(fetchCtx.deviceFlowHttp !== undefined && { deviceFlowHttp: fetchCtx.deviceFlowHttp }),
    ...(fetchCtx.authMemo !== undefined && { authMemo: fetchCtx.authMemo }),
  });
}

/**
 * PURL-03 / NFR-10: apply the git-subdir containment tail to a materialized
 * clone/mirror root and stamp the resolved sha. A git-subdir source resolves the
 * pluginRoot under the clone root (escapes / missing-subdir arms propagate);
 * other kinds materialize at the clone root itself. Mirrors
 * `install.ts::resolveGitPluginRootWithSubdir`.
 */
async function resolveFetchedPluginRoot(
  gitSource: GitBackedSource,
  cloneRoot: string,
  resolvedSha: string,
): Promise<GitPluginRootResult> {
  if (gitSource.kind === "git-subdir") {
    const subdirResult = await resolveGitSubdirRoot(cloneRoot, gitSource.path);
    if (subdirResult.kind !== "materialized") {
      return subdirResult;
    }

    return { kind: "materialized", pluginRoot: subdirResult.pluginRoot, resolvedSha };
  }

  return { kind: "materialized", pluginRoot: cloneRoot, resolvedSha };
}

/**
 * FTCH-03 / FTCH-04 / D-81-05: build the MATERIALIZING git probe for the
 * `info --fetch` hook. A pinned source (manifest sha) clones once into the
 * per-sha immutable cache (network on cache miss); an unpinned source refreshes
 * the single mutable URL-keyed mirror even when warm (MIRR-02 refresh-on-warm --
 * the mirror refresh IS the consented fetch, so it hits the network on every
 * run). A materialize throw PROPAGATES so the row builder's existing
 * try/catch degrades to `components: not resolved` (D-81-04). Mirrors
 * `install.ts::makeInstallCloneProbe`; the pinned/unpinned fork lives inside the
 * callback so info still names no git surface (it reaches the seam only by name).
 */
function makeFetchProbe(locations: ScopedLocations, fetchCtx: InfoFetchContext): GitProbe {
  const probeUnpinned = async (gitSource: GitBackedSource): Promise<GitPluginRootResult> => {
    const cloneUrl = canonicalCloneUrl(gitSource);
    const authBundle = buildFetchAuth(cloneUrl, gitSource.kind, fetchCtx);
    const { pluginRoot: mirrorRoot, resolvedSha } =
      await fetchCtx.seam.materializeOrRefreshPluginMirror({
        locations,
        cloneUrl,
        ...(gitSource.ref !== undefined && { ref: gitSource.ref }),
        ...(authBundle !== undefined && { auth: authBundle }),
      });
    return resolveFetchedPluginRoot(gitSource, mirrorRoot, resolvedSha);
  };

  const probePinned = async (gitSource: GitBackedSource): Promise<GitPluginRootResult> => {
    const { cloneUrl, pin, ref } = await fetchCtx.seam.resolvePluginPin({ source: gitSource });
    const authBundle = buildFetchAuth(cloneUrl, gitSource.kind, fetchCtx);
    const cloneRoot = await fetchCtx.seam.materializePluginClone({
      locations,
      cloneUrl,
      pin,
      ...(ref !== undefined && { ref }),
      ...(authBundle !== undefined && { auth: authBundle }),
    });
    return resolveFetchedPluginRoot(gitSource, cloneRoot, pin);
  };

  return (gitSource) =>
    gitSource.sha === undefined ? probeUnpinned(gitSource) : probePinned(gitSource);
}

/**
 * FTCH-04 / D-81-04 / T-81-08: fold a git-source fetch/read throw to a
 * closed-set reason. An `info --fetch` materialize failure narrows through the
 * shared `classifyGitTransportFailure` ladder (HttpError 401/403 and a
 * denied/expired Device Flow's `UserCanceledError` -> `authentication
 * required`, network errnos -> `network unreachable` -- fetch parity with
 * install/update); any other throw (warm-tree disk error, etc.) falls through
 * to the existing `narrowProbeError` ladder. Never returns a new REASONS
 * member.
 */
function foldFetchOrProbeError(err: unknown): ContentReason {
  return classifyGitTransportFailure(err) ?? narrowProbeError(err);
}

/**
 * RSTA-04 / D-78-04 / INFO-05 / NFR-5: build the `(installed)` /
 * `(partially-installed)` row for an installed git source (url / git-subdir /
 * github) by resolving its WARM clone fs-only. `makePresenceProbe(locations)`
 * returns `materialized` for a WARM clone/mirror, whose `pluginRoot` is the
 * on-disk tree; `resolveStrict` (probe injected) then enumerates components:
 *   - `installable` -> `(installed)` with components resolved fs-only from the
 *     warm `pluginRoot`.
 *   - non-installable -> the recorded `buildNonPathInstalledRow` marker (the
 *     install itself succeeded; a live resolver defect does not un-install it).
 * A COLD/missing clone (`not-cached`) OR a `resolveStrict` /
 * `composeResolvedComponents` throw preserves the D-78-04 degrade -- the
 * recorded `(installed)` / `(partially-installed)` status holds, NEVER `(remote)`
 * (that derives only on the not-installed path) nor `(unavailable)`. No network.
 */
async function buildInstalledGitRow(opts: {
  pluginName: string;
  version: string | undefined;
  description: string | undefined;
  dependencies: readonly string[] | undefined;
  entry: MarketplaceManifest["plugins"][number];
  mpRecord: MarketplaceRecord;
  installedRecord: MarketplaceRecord["plugins"][string];
  gitSource: GitBackedSource;
  locations: ScopedLocations;
  fetchCtx?: InfoFetchContext;
}): Promise<PluginInfoRow> {
  const {
    pluginName,
    version,
    description,
    dependencies,
    entry,
    mpRecord,
    installedRecord,
    gitSource,
    locations,
    fetchCtx,
  } = opts;
  // FTCH-03: `info --fetch` materializes the clone/mirror (network on cache
  // miss when pinned, on the mirror refresh when unpinned -- D-81-05, MIRR-02)
  // via the fetch probe; bare info uses the fs-only presence probe. A fetch
  // throw is caught below and preserves the recorded status (D-78-04).
  const probe =
    fetchCtx !== undefined ? makeFetchProbe(locations, fetchCtx) : makePresenceProbe(locations);
  try {
    const presence = await probe(gitSource);
    if (presence.kind === "materialized") {
      const resolved = await resolveStrict(entry, {
        marketplaceRoot: mpRecord.marketplaceRoot,
        resolveGitPluginRoot: probe,
      });
      if (resolved.state === "installable") {
        return {
          status: "installed",
          name: pluginName,
          ...(version !== undefined && { version }),
          ...(description !== undefined && { description }),
          componentsResolved: true,
          components: await composeResolvedComponents(presence.pluginRoot, resolved),
          ...(dependencies !== undefined && { dependencies }),
        };
      }
    }
  } catch (err) {
    // D-78-04: a warm-tree resolve/read failure OR a fetch failure never
    // un-installs the plugin; the recorded status holds either way. Bare info
    // degrades silently (the fs-only probe carries no fetch consent), but
    // `info --fetch` surfaces the consented fetch/read failure as an existing
    // closed-set reason on the recorded row (D-81-04 parity with the
    // not-installed arm) -- otherwise a failed `--fetch` would render
    // byte-identical to bare info.
    if (fetchCtx !== undefined) {
      const base = buildNonPathInstalledRow(pluginName, version, description, installedRecord);
      return { ...base, reasons: [...(base.reasons ?? []), foldFetchOrProbeError(err)] };
    }
  }

  // COLD / missing clone, non-installable warm resolve, or a probe/read throw:
  // preserve the recorded install status (D-78-04) with `components: not resolved`.
  return buildNonPathInstalledRow(pluginName, version, description, installedRecord);
}

/**
 * Build an `(installed)` row. When the source kind is `"path"` (the
 * only locally resolvable kind), run `resolveStrict` to compute the
 * per-kind component arrays + sort them. For all other source kinds,
 * emit `componentsResolved: false` (INFO-05 marker) via
 * `buildNonPathInstalledRow`. When `resolveStrict` returns the
 * not-installable variant for a path source,
 * `buildNotInstallablePathRowFields` still enumerates components from
 * disk so the row exposes the `{<reason>}` brace alongside the per-kind
 * component lines instead of `not resolved`.
 */
async function buildInstalledRow(opts: {
  pluginName: string;
  version: string | undefined;
  description: string | undefined;
  dependencies: readonly string[] | undefined;
  entry: MarketplaceManifest["plugins"][number];
  mpRecord: MarketplaceRecord;
  installedRecord: MarketplaceRecord["plugins"][string];
  parsedSource: ParsedSource;
  locations: ScopedLocations;
  fetchCtx?: InfoFetchContext;
}): Promise<PluginInfoRow> {
  const {
    pluginName,
    version,
    description,
    dependencies,
    entry,
    mpRecord,
    installedRecord,
    parsedSource,
    locations,
    fetchCtx,
  } = opts;
  if (!isLocallyResolvable(parsedSource)) {
    // RSTA-04 / D-78-04: a git source with a WARM clone resolves its components
    // fs-only (amends INFO-05); a COLD/missing clone keeps the recorded
    // `(installed)` / `(partially-installed)` marker via `buildNonPathInstalledRow`
    // -- it NEVER regresses to `(remote)` (that derives only on the not-installed
    // path) nor to `(unavailable)`.
    if (isGitSource(parsedSource)) {
      return buildInstalledGitRow({
        pluginName,
        version,
        description,
        dependencies,
        entry,
        mpRecord,
        installedRecord,
        gitSource: parsedSource,
        locations,
        ...(fetchCtx !== undefined && { fetchCtx }),
      });
    }

    return buildNonPathInstalledRow(pluginName, version, description, installedRecord);
  }

  try {
    const resolved = await resolveStrict(entry, { marketplaceRoot: mpRecord.marketplaceRoot });
    if (resolved.state === "installable") {
      return {
        status: "installed",
        name: pluginName,
        ...(version !== undefined && { version }),
        ...(description !== undefined && { description }),
        componentsResolved: true,
        components: await composeResolvedComponents(resolved.pluginRoot, resolved),
        ...(dependencies !== undefined && { dependencies }),
      };
    }

    // resolveStrict returned a non-installable arm but the state record says
    // installed -- the marketplace clone changed, OR the manifest now
    // declares an unsupported field (`lspServers`) or a structural defect
    // (malformed hooks/manifest). FSTAT-07 / D-66-04: a `partially-available`
    // re-resolve of a recorded-installed plugin is the derived
    // `partially-installed` state -- the install was partially completed with one or
    // more components dropped, so it reports `(partially-installed)` with the
    // dropped-component detail. `unavailable` keeps `(installed)` (D-64-05:
    // only `partially-available` maps to partially-installed); info never emits
    // `partially-upgradable` (that is a list-inventory-only concept).
    // `partially-available` reads its component payload directly; `unavailable`
    // re-derives independently (D-64-05).
    const fields = await buildNonInstallableRowFields(
      resolved,
      entry,
      mpRecord.marketplaceRoot,
      parsedSource,
    );
    return {
      status: resolved.state === "partially-available" ? "partially-installed" : "installed",
      name: pluginName,
      ...(version !== undefined && { version }),
      ...(description !== undefined && { description }),
      ...fields,
    };
  } catch (err) {
    // Probe failure on disk -- classify the underlying failure via
    // `narrowProbeError`. Status stays `installed` (state record
    // confirms the install); the `{reason}` brace makes the
    // persistence-vs-disk disagreement explicit and prevents byte-
    // identical render with a deliberate external-source defer.
    const reasons: readonly ContentReason[] = [narrowProbeError(err)];
    return {
      status: "installed",
      name: pluginName,
      ...(version !== undefined && { version }),
      ...(description !== undefined && { description }),
      reasons,
      componentsResolved: false,
    };
  }
}

/**
 * Build the not-installed row for a PATH source whose resolver returned a
 * non-installable arm (`partially-available` / `unavailable`). Enumerates components
 * from disk via `buildNonInstallableRowFields`.
 *
 * USTAT-01 / D-64-01: de-collapse the row status by resolver STATE -- a
 * partially-available plugin renders the distinct `(partially-available)` /
 * `⊖` token (byte-consistent with the list surface), while a structural
 * `unavailable` keeps `(unavailable)` / `⊘`. Severity is unchanged (token
 * rename only).
 *
 * WR-02: `buildNonInstallableRowFields` -> `derivePluginRootForInfo` can throw
 * `PathContainmentError` (NFR-10) for a not-installed path source whose `source`
 * escapes the marketplace root -- BEFORE the inner try that wraps
 * `composeResolvedComponents` only. Mirror `buildInstalledRow`'s outer catch so
 * the unreadable case renders an `(unavailable)` row via `narrowProbeError`
 * instead of throwing uncaught out of `getPluginInfo`.
 */
async function buildNotInstalledPathRow(
  resolved: ResolvedPluginPartiallyAvailable | ResolvedPluginUnavailable,
  opts: {
    pluginName: string;
    version: string | undefined;
    description: string | undefined;
    entry: MarketplaceManifest["plugins"][number];
    mpRecord: MarketplaceRecord;
    parsedSource: ParsedSource;
  },
): Promise<PluginInfoRow> {
  const { pluginName, version, description, entry, mpRecord, parsedSource } = opts;
  try {
    const fields = await buildNonInstallableRowFields(
      resolved,
      entry,
      mpRecord.marketplaceRoot,
      parsedSource,
    );
    return {
      status: resolved.state === "partially-available" ? "partially-available" : "unavailable",
      name: pluginName,
      ...(version !== undefined && { version }),
      ...(description !== undefined && { description }),
      ...fields,
    };
  } catch (err) {
    // The probe-error catch arm stays `unavailable` (structural).
    const reasons: readonly ContentReason[] = [narrowProbeError(err)];
    return {
      status: "unavailable",
      name: pluginName,
      ...(version !== undefined && { version }),
      ...(description !== undefined && { description }),
      reasons,
      componentsResolved: false,
    };
  }
}

/**
 * RSTA-01 / D-80-04 / NFR-5: the `(remote)` not-installed row for a git source
 * (url / git-subdir / github) whose clone/mirror is COLD (nothing materialized
 * locally). There is no local tree to resolve, so components stay unresolved --
 * `componentsResolved: false` renders the existing `components: not resolved`
 * marker (D-80-04 preserves that wording). The entry is still a valid install
 * target (install performs the fetch); `(remote)` replaces the manifest-only
 * `(available)` over-claim.
 */
function buildRemoteNotInstalledRow(
  pluginName: string,
  version: string | undefined,
  description: string | undefined,
  dependencies: readonly string[] | undefined,
): PluginInfoRow {
  return {
    status: "remote",
    name: pluginName,
    ...(version !== undefined && { version }),
    ...(description !== undefined && { description }),
    componentsResolved: false,
    ...(dependencies !== undefined && { dependencies }),
  };
}

/**
 * RSTA-04 / RSTA-05 / RSTA-06 / NFR-5: resolve a not-installed git-source plugin
 * against its WARM clone/mirror, fs-only. `makePresenceProbe(locations)` returns
 * `not-cached` for a COLD clone (-> `(remote)` row) or `materialized` for a WARM
 * one, whose `pluginRoot` is the on-disk tree. On warm, `resolveStrict` runs the
 * three-way verdict (the presence probe injected as `resolveGitPluginRoot`):
 *   - `installable` -> `(available)` row with components enumerated fs-only from
 *     the warm `pluginRoot` via `composeResolvedComponents`.
 *   - `partially-available` / `unavailable` -> the SAME reason-brace arm a path
 *     source gets (`buildNotInstalledPathRow`), with components enumerated from
 *     the warm `pluginRoot`.
 * A `resolveStrict` / `composeResolvedComponents` throw folds to
 * `componentsResolved: false` + `narrowProbeError` (never a throw). No network.
 */
async function buildGitNotInstalledRow(opts: {
  pluginName: string;
  version: string | undefined;
  description: string | undefined;
  dependencies: readonly string[] | undefined;
  entry: MarketplaceManifest["plugins"][number];
  mpRecord: MarketplaceRecord;
  gitSource: GitBackedSource;
  locations: ScopedLocations;
  fetchCtx?: InfoFetchContext;
}): Promise<PluginInfoRow> {
  const { pluginName, version, description, dependencies, entry, mpRecord, gitSource, locations } =
    opts;
  const fetchCtx = opts.fetchCtx;
  // FTCH-03: `info --fetch` materializes the clone/mirror (network on cache
  // miss when pinned, on the mirror refresh when unpinned -- D-81-05, MIRR-02)
  // via the fetch probe; bare info uses the fs-only presence probe.
  const probe =
    fetchCtx !== undefined ? makeFetchProbe(locations, fetchCtx) : makePresenceProbe(locations);

  let presence: GitPluginRootResult;
  try {
    presence = await probe(gitSource);
  } catch (err) {
    // D-81-04: a fetch materialize throw NEVER fails info -- degrade to the
    // existing `components: not resolved` arm with an existing closed-set reason
    // (network unreachable / authentication required, else the probe-error
    // ladder). The `(remote)` token is the not-installed git surface.
    return {
      status: "remote",
      name: pluginName,
      ...(version !== undefined && { version }),
      ...(description !== undefined && { description }),
      reasons: [foldFetchOrProbeError(err)],
      componentsResolved: false,
    };
  }

  if (presence.kind !== "materialized") {
    return buildRemoteNotInstalledRow(pluginName, version, description, dependencies);
  }

  const pluginRoot = presence.pluginRoot;
  const ctx: ResolveContext = {
    marketplaceRoot: mpRecord.marketplaceRoot,
    resolveGitPluginRoot: probe,
  };
  try {
    const resolved = await resolveStrict(entry, ctx);
    if (resolved.state !== "installable") {
      // `return await` so a `composeResolvedComponents` throw inside the helper
      // is caught by THIS try/catch and folds to the unreadable arm below.
      return await buildWarmGitNonInstallableRow(resolved, {
        pluginName,
        version,
        description,
        pluginRoot,
      });
    }

    return await buildAvailableRow({
      pluginName,
      version,
      description,
      dependencies,
      pluginRoot,
      resolvedForComponents: resolved,
    });
  } catch (err) {
    // Warm-tree disk error -> fold to `componentsResolved: false` on the
    // `(remote)` token (the clone is present but unreadable); never a throw.
    return {
      status: "remote",
      name: pluginName,
      ...(version !== undefined && { version }),
      ...(description !== undefined && { description }),
      reasons: [narrowProbeError(err)],
      componentsResolved: false,
    };
  }
}

/**
 * RSTA-04 / RSTA-05: render the not-installable arm of a WARM git-source
 * resolution. Enumerates components fs-only from the warm `pluginRoot` and
 * routes reasons through the same closed-set arms a path source uses --
 * `partially-available` -> `(partially-available)`, `unavailable` ->
 * `(unavailable)` -- so the reason braces match the path-plugin path. A
 * `composeResolvedComponents` throw folds to `componentsResolved: false`.
 */
async function buildWarmGitNonInstallableRow(
  resolved: ResolvedPluginPartiallyAvailable | ResolvedPluginUnavailable,
  opts: {
    pluginName: string;
    version: string | undefined;
    description: string | undefined;
    pluginRoot: string;
  },
): Promise<PluginInfoRow> {
  const { pluginName, version, description, pluginRoot } = opts;
  const status = resolved.state === "partially-available" ? "partially-available" : "unavailable";
  const resolverReasons =
    resolved.state === "partially-available"
      ? narrowUnsupportedKinds(resolved.unsupported)
      : narrowResolverNotes(resolved.notes);
  // The `unavailable` arm carries no `componentPaths` (NFR-7); enumerate from
  // the conventional `<pluginRoot>/{skills,commands,agents}` locations so the
  // warm tree still lists on-disk components (mirrors `deriveLenientComponentPaths`).
  const forComponents =
    resolved.state === "partially-available"
      ? resolved
      : {
          componentPaths: { skills: ["skills"], commands: ["commands"], agents: ["agents"] },
          mcpServers: {},
        };
  try {
    const components = await composeResolvedComponents(pluginRoot, forComponents);
    return {
      status,
      name: pluginName,
      ...(version !== undefined && { version }),
      ...(description !== undefined && { description }),
      ...(resolverReasons.length > 0 && { reasons: resolverReasons }),
      componentsResolved: true,
      components,
    };
  } catch (err) {
    return {
      status,
      name: pluginName,
      ...(version !== undefined && { version }),
      ...(description !== undefined && { description }),
      reasons: [...resolverReasons, narrowProbeError(err)],
      componentsResolved: false,
    };
  }
}

/**
 * Build the row for a plugin that is NOT in the state's installed
 * bucket. `resolveStrict` decides between `(available)`, `(partially-available)`, and
 * `(unavailable)`; the per-kind component arrays follow the same
 * INFO-05 source-kind gate as the installed row.
 */
async function buildNotInstalledRow(opts: {
  pluginName: string;
  version: string | undefined;
  description: string | undefined;
  dependencies: readonly string[] | undefined;
  entry: MarketplaceManifest["plugins"][number];
  mpRecord: MarketplaceRecord;
  parsedSource: ParsedSource;
  locations: ScopedLocations;
  fetchCtx?: InfoFetchContext;
}): Promise<PluginInfoRow> {
  const { pluginName, version, description, dependencies, entry, mpRecord, parsedSource } = opts;
  const { locations, fetchCtx } = opts;
  // RSTA-01 / RSTA-05 / D-80-04: a NOT-installed git-source entry (url /
  // git-subdir / github) is classified from its clone/mirror presence. Bare info
  // reads it fs-only: a COLD clone renders `(remote)` + `components: not
  // resolved`; a WARM one resolves fs-only via the three-way resolver.
  // FTCH-03: `info --fetch` materializes the clone/mirror first (network on
  // cache miss when pinned, on the mirror refresh when unpinned -- D-81-05,
  // MIRR-02), then resolves the now-warm tree; a fetch throw degrades in-place
  // (D-81-04). Branch BEFORE the path `resolveStrict` below (whose git arm maps
  // the absent clone to `unavailable{not installed}`).
  if (isGitSource(parsedSource)) {
    return buildGitNotInstalledRow({
      pluginName,
      version,
      description,
      dependencies,
      entry,
      mpRecord,
      gitSource: parsedSource,
      locations,
      ...(fetchCtx !== undefined && { fetchCtx }),
    });
  }

  let resolved;
  try {
    resolved = await resolveStrict(entry, { marketplaceRoot: mpRecord.marketplaceRoot });
  } catch (err) {
    // Probe throw -> classify the underlying failure via the same
    // `narrowProbeError` ladder used by `list.ts`. Hardcoding
    // `"unreadable"` here would diverge from the list surface for the
    // same `EACCES` / `ENOENT` failures. No `resolved` value exists, so
    // there are no `componentPaths` to enumerate.
    const reasons: readonly ContentReason[] = [narrowProbeError(err)];
    return {
      status: "unavailable",
      name: pluginName,
      ...(version !== undefined && { version }),
      ...(description !== undefined && { description }),
      reasons,
      componentsResolved: false,
    };
  }

  if (resolved.state !== "installable") {
    return buildNotInstalledNonInstallableRow(resolved, {
      pluginName,
      version,
      description,
      entry,
      mpRecord,
      parsedSource,
    });
  }

  // Non-path sources reach the `(unavailable)` arm above because
  // `resolveStrict` returns a structural `unavailable` for them -- so by the
  // time control gets here the source is path-resolvable and
  // `composeResolvedComponents` is safe to call without an external-
  // source short-circuit.
  return buildAvailableRow({
    pluginName,
    version,
    description,
    dependencies,
    pluginRoot: resolved.pluginRoot,
    resolvedForComponents: resolved,
  });
}

/**
 * Build the not-installed row for a plugin whose `resolveStrict` returned a
 * non-installable arm (`partially-available` / `unavailable`). Non-path sources
 * (npm / unknown -- git sources short-circuit to `(available)` upstream) render
 * the resolver token + reasons without enumerating components; a path source
 * enumerates its on-disk components via `buildNotInstalledPathRow`.
 */
function buildNotInstalledNonInstallableRow(
  resolved: ResolvedPluginPartiallyAvailable | ResolvedPluginUnavailable,
  opts: {
    pluginName: string;
    version: string | undefined;
    description: string | undefined;
    entry: MarketplaceManifest["plugins"][number];
    mpRecord: MarketplaceRecord;
    parsedSource: ParsedSource;
  },
): Promise<PluginInfoRow> | PluginInfoRow {
  const { pluginName, version, description, entry, mpRecord, parsedSource } = opts;
  if (!isLocallyResolvable(parsedSource)) {
    // XSURF-02 / IN-01: derive the token AND its reason source from
    // `resolved.state`, mirroring the path-source arm and the list surface,
    // instead of hardcoding `unavailable`. The `resolved.state !==
    // "installable"` guard at the caller narrows to `partially-available |
    // unavailable`, so `resolved.unsupported` is reachable on the
    // `partially-available` arm. Today non-path sources never resolve
    // `partially-available` (no-network), so this is latent-divergence repair --
    // existing non-path `unavailable` rows stay byte-unchanged.
    const reasons =
      resolved.state === "partially-available"
        ? narrowUnsupportedKinds(resolved.unsupported)
        : narrowResolverNotes(resolved.notes);
    return {
      status: resolved.state === "partially-available" ? "partially-available" : "unavailable",
      name: pluginName,
      ...(version !== undefined && { version }),
      ...(description !== undefined && { description }),
      ...(reasons.length > 0 && { reasons }),
      componentsResolved: false,
    };
  }

  // Path source whose resolver returned a non-installable arm: enumerate
  // components from disk. `partially-available` reads its component payload
  // directly; `unavailable` re-derives independently (D-64-05).
  return buildNotInstalledPathRow(resolved, {
    pluginName,
    version,
    description,
    entry,
    mpRecord,
    parsedSource,
  });
}

/**
 * `(available)` row constructor for a path-source plugin (the only
 * locally-resolvable kind). Walks `composeResolvedComponents` to gather
 * per-kind names; a non-ENOENT readdir failure during component
 * discovery propagates here and is classified via `narrowProbeError`
 * so a permission-denied directory cannot silently render as
 * "no components".
 */
async function buildAvailableRow(opts: {
  readonly pluginName: string;
  readonly version: string | undefined;
  readonly description: string | undefined;
  readonly dependencies: readonly string[] | undefined;
  readonly pluginRoot: string;
  readonly resolvedForComponents: Parameters<typeof composeResolvedComponents>[1];
}): Promise<PluginInfoRow> {
  const { pluginName, version, description, dependencies } = opts;

  try {
    const components = await composeResolvedComponents(opts.pluginRoot, opts.resolvedForComponents);
    return {
      status: "available",
      name: pluginName,
      ...(version !== undefined && { version }),
      ...(description !== undefined && { description }),
      componentsResolved: true,
      components,
      ...(dependencies !== undefined && { dependencies }),
    };
  } catch (err) {
    const reasons: readonly ContentReason[] = [narrowProbeError(err)];
    return {
      status: "available",
      name: pluginName,
      ...(version !== undefined && { version }),
      ...(description !== undefined && { description }),
      reasons,
      componentsResolved: false,
    };
  }
}

/**
 * D-54-01 / ENBL-04: list-arm cascade block for a recorded-but-disabled
 * plugin. The info surface conveys the disabled state via the SAME
 * `(disabled)` inventory token as the list surface (catalog
 * `disabled-inventory` state) -- list-arm marketplace header +
 * `PluginDisabledMessage` row -- rather than the `PluginInfoMessage`
 * standalone variant: a disabled plugin has no materialized artefacts
 * (ENBL-02), so the per-kind component/dependencies block would be
 * misleading.
 */
function buildDisabledInventoryBlock(
  marketplace: string,
  pluginName: string,
  scope: Scope,
  installed: MarketplaceRecord["plugins"][string],
  autoupdate: boolean,
): MarketplaceRows<PluginInfoCascadeMsg> {
  // Mirror the list surface's `<autoupdate>` marker composition (details is
  // emitted ONLY when the flag is true; `lastUpdatedAt` never on this
  // surface).
  const detailsField: { readonly details?: { autoupdate: boolean } } = autoupdate
    ? { details: { autoupdate: true } }
    : {};
  return {
    name: marketplace,
    scope,
    ...detailsField,
    plugins: [
      {
        // D-03/D-06: a disabled INVENTORY row (info surface) is steady state,
        // not a realized transition -> info, never reloads.
        status: "disabled",
        name: pluginName,
        version: installed.version,
        severity: "info",
        needsReload: false,
      },
    ],
  };
}

/**
 * D-54-01 / ENBL-04: split the found (scope, record) tuples into the
 * disabled-inventory blocks (recorded-but-disabled marker present) and the
 * info-surface tuples that proceed through `buildBlock`. Extracted from
 * `getPluginInfo` to keep its cognitive complexity within the lint budget.
 */
function partitionDisabledScopes(
  opts: GetPluginInfoOptions,
  found: readonly { scope: Scope; record: MarketplaceRecord; autoupdate: boolean }[],
): {
  disabledBlocks: MarketplaceRows<PluginInfoCascadeMsg>[];
  infoFound: { scope: Scope; record: MarketplaceRecord; autoupdate: boolean }[];
} {
  const disabledBlocks: MarketplaceRows<PluginInfoCascadeMsg>[] = [];
  const infoFound: { scope: Scope; record: MarketplaceRecord; autoupdate: boolean }[] = [];
  for (const f of found) {
    const installed = f.record.plugins[opts.plugin];
    if (installed !== undefined && isRecordedButDisabled(installed)) {
      disabledBlocks.push(
        buildDisabledInventoryBlock(
          opts.marketplace,
          opts.plugin,
          f.scope,
          installed,
          f.autoupdate,
        ),
      );
    } else {
      infoFound.push(f);
    }
  }

  return { disabledBlocks, infoFound };
}

export async function getPluginInfo(opts: GetPluginInfoOptions): Promise<void> {
  // INFO-03 iteration order: project-first per MSG-GR-3 when both
  // scopes are searched; otherwise the explicit scope only.
  const scopes: readonly Scope[] = opts.scope === undefined ? ["project", "user"] : [opts.scope];

  // FTCH-03 / D-81-05: build the fetch context ONCE when `--fetch` is passed so
  // the git-source row builders materialize the clone/mirror (network on cache
  // miss when pinned, on the mirror refresh when unpinned -- MIRR-02) before
  // resolving. Omitted `fetch` leaves it undefined -> every row builder stays
  // on the fs-only presence probe (bare info is network-free).
  const fetchCtx = buildInfoFetchContext(opts);

  // Collect (scope, record) tuples so the fan-out renderer preserves
  // the outer-loop iteration order. Each scope's state is loaded
  // read-only via `loadState` (NFR-5 preserved -- NO network).
  //
  // SPLIT-01 rewire: autoupdate lives in claude-plugins.json (config),
  // not state. Load the merged config alongside state per scope so each
  // (scope, record) tuple carries the per-scope autoupdate truth.
  const found: { scope: Scope; record: MarketplaceRecord; autoupdate: boolean }[] = [];
  for (const scope of scopes) {
    const locations = locationsFor(scope, opts.cwd);
    const state = await loadState(locations.extensionRoot);
    const record = state.marketplaces[opts.marketplace];
    if (record !== undefined) {
      const { merged } = await loadMergedScopeConfig(locations);
      const autoupdate = merged.marketplaces[opts.marketplace]?.entry.autoupdate ?? false;
      found.push({ scope, record, autoupdate });
    }
  }

  // Branch on the collected marketplaces (a) / (b) / (c) per the file
  // header.
  if (found.length === 0) {
    // The marketplace is absent -> the dedicated `MarketplaceNotAddedMessage`
    // variant (TYPE-01 / D-46-01). `name` carries the MARKETPLACE name -- the
    // user-facing failure is "the marketplace is not added", not "the plugin
    // doesn't exist". `scope` is set when a `--scope` was requested (renders
    // `[user]` / `[project]`); OMITTED when `--scope` was undefined and BOTH
    // scopes missed (the bracket suppresses). `renderMarketplaceNotAdded`
    // emits the bare column-0 row `⊘ <name> [scope?] (failed) {not added}`.
    const message: NotificationMessage = {
      kind: "marketplace-not-added",
      name: opts.marketplace,
      ...(opts.scope !== undefined && { scope: opts.scope }),
    };
    notify(opts.ctx, opts.pi, message);
    return;
  }

  // D-54-01 / ENBL-04: partition recorded-but-disabled scopes from the
  // info-surface scopes BEFORE block building. A disabled record renders the
  // list-arm `(disabled)` inventory cascade (see buildDisabledInventoryBlock)
  // instead of the standalone `PluginInfoMessage` shape.
  const { disabledBlocks, infoFound } = partitionDisabledScopes(opts, found);

  // Every found scope holds the disabled marker: a single list-arm cascade
  // (one block per scope) preserves IL-2 on this all-disabled path. OUT-07 /
  // D-12: a per-scope bulk of disabled inventory rows -> `Plural<Row>`.
  if (infoFound.length === 0) {
    const rows: Plural<MarketplaceRows<PluginInfoCascadeMsg>> = disabledBlocks;
    notifyWithContext(opts.ctx, opts.pi, PLUGIN_INFO_CONTEXT, rows);
    return;
  }

  // Destructure to make the branch choice unambiguous and avoid the
  // silent fall-through hazard `if (found.length === 1) / if (sole !==
  // undefined)` has under `noUncheckedIndexedAccess`.
  const [sole, ...rest] = infoFound;
  if (sole !== undefined && rest.length === 0 && disabledBlocks.length === 0) {
    const block = await buildBlock(
      opts.marketplace,
      opts.plugin,
      sole.scope,
      sole.record,
      sole.autoupdate,
      opts.cwd,
      fetchCtx,
    );
    notify(opts.ctx, opts.pi, block);
    return;
  }

  // (c) Two marketplaces found (BOTH scopes hold the marketplace).
  // Build a block per scope, then SEPARATE `(failed)` blocks (e.g.
  // `{not in manifest}` / `{unreadable}`) from the read-only info blocks
  // before composing the fan-out. The `plugin-info-cascade` wrapper routes to
  // info severity with NO summary line, so a `(failed)` block buried inside it
  // would render summary-less -- exactly the standalone-vs-cascade divergence
  // this surface closes (GRAM-04): the same not-in-manifest failure is LOUD on
  // the single-scope `plugin-info` arm but would be SILENT here. Mirror
  // `getMarketplaceInfo`'s failure separation -- each failed scope is surfaced
  // as its own standalone `plugin-info` notify (which routes to `error` + the
  // `A plugin operation has failed.` summary via the single arm), and only the info
  // blocks form the cascade. This intentionally breaks IL-2's single-notify
  // rule on the partial-failure path so a failure in one scope cannot hide
  // behind a healthy other-scope render; callers wanting strict IL-2 must pass
  // `--scope`. Block order follows the project-first scope iteration (MSG-GR-3).
  const blocks = await Promise.all(
    infoFound.map((f) =>
      buildBlock(
        opts.marketplace,
        opts.plugin,
        f.scope,
        f.record,
        f.autoupdate,
        opts.cwd,
        fetchCtx,
      ),
    ),
  );
  const infoBlocks = blocks.filter((b) => b.plugin.status !== "failed");
  const failedBlocks = blocks.filter((b) => b.plugin.status === "failed");

  // Info blocks: a single survivor renders as the bare single-scope shape
  // (no cascade wrapping); two render as the fan-out cascade. The destructure
  // proves the non-empty tuple shape the cascade type requires.
  const [firstInfo, ...remainingInfo] = infoBlocks;
  if (firstInfo !== undefined && remainingInfo.length === 0) {
    notify(opts.ctx, opts.pi, firstInfo);
  } else if (firstInfo !== undefined) {
    notify(opts.ctx, opts.pi, {
      kind: "plugin-info-cascade",
      blocks: [firstInfo, ...remainingInfo],
    });
  }

  // D-54-01 / ENBL-04: surface the disabled-inventory scopes through the
  // list-arm cascade. Mixed disabled+info renders break IL-2's single-notify
  // rule the same way the GRAM-04 failure separation below does -- the two
  // surfaces have incompatible message kinds, and hiding one behind the
  // other would silently drop a scope's state.
  if (disabledBlocks.length > 0) {
    const rows: Plural<MarketplaceRows<PluginInfoCascadeMsg>> = disabledBlocks;
    notifyWithContext(opts.ctx, opts.pi, PLUGIN_INFO_CONTEXT, rows);
  }

  // Surface each failed scope as its own `error`-severity notify (GRAM-04).
  for (const failure of failedBlocks) {
    notify(opts.ctx, opts.pi, failure);
  }
}

// Test-only re-export of the shared classifier so callers exercising
// this orchestrator's behavior can verify the closed-set ladder without
// reaching into `shared/probe-classifiers.ts` directly.
export { narrowProbeError as __test_narrowProbeError };
