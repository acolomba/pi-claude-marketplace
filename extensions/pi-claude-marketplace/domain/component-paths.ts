import path from "node:path";

import { PathContainmentError, assertPathInside } from "../shared/path-safety.ts";
import { discoveryWarning } from "../shared/staging-warnings.ts";

import type { PluginEntry } from "./components/plugin.ts";
import type { CommandMapEntry, StatKindReader } from "./resolver-types.ts";
import type { DiscoveryWarning } from "../shared/staging-warnings.ts";

const COMPONENT_PATH_KINDS = ["skills", "commands", "agents", "workflows"] as const;
export type ComponentPathKind = (typeof COMPONENT_PATH_KINDS)[number];

/** Resolves a relative component path after enforcing root containment. */
export async function resolveContainedComponentPath(
  pluginRoot: string,
  raw: string,
  label: string,
): Promise<
  | { readonly ok: true; readonly absolutePath: string }
  | { readonly ok: false; readonly cause: "absolute" | "escape" }
> {
  if (path.isAbsolute(raw)) {
    return { ok: false, cause: "absolute" };
  }

  const absolutePath = path.resolve(pluginRoot, raw);

  try {
    await assertPathInside(pluginRoot, absolutePath, label);
  } catch (error: unknown) {
    if (error instanceof PathContainmentError) {
      return { ok: false, cause: "escape" };
    }

    throw error;
  }

  return { ok: true, absolutePath };
}

/** Mutable resolver fields owned by component-path collection. */
export interface ComponentPathResolution {
  supported: string[];
  notes: string[];
  componentPaths: {
    skills: string[];
    commands: string[];
    agents: string[];
    workflows: string[];
    /** D-CF3-03: the entries of an object-map `commands` declaration, in declared order. */
    commandMap?: CommandMapEntry[];
  };
  /** D-CF1-06: kinds whose existing conventional folder a declaration leaves unread. */
  shadowedFolders?: ComponentPathKind[];
}

/**
 * D-CF1-06: the warning for a conventional folder a declaration leaves
 * unread, in Claude Code's user-facing wording.
 */
function shadowedFolderWarning(kind: ComponentPathKind): string {
  return `Default ${kind}/ folder is ignored because the manifest sets "${kind}"`;
}

/**
 * D-CF1-06: one discovery warning for each conventional folder a declaration
 * leaves unread, so install, update, and reinstall name it.
 */
export function shadowedFolderDiscoveryWarnings(
  shadowedFolders: readonly ComponentPathKind[] | undefined,
): readonly DiscoveryWarning[] {
  return (shadowedFolders ?? []).map((kind) => discoveryWarning(shadowedFolderWarning(kind)));
}

// An empty string declares nothing, as `null` does: Claude Code 2.1.316 loads
// a declared path only when the field is truthy (D-CF1-06).
function readPathOrArray(value: unknown): readonly unknown[] {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  return [value];
}

/**
 * The outcome of validating one declared path. A refusal's `cause` tells a
 * traversal, an absolute path or one that escapes the plugin root, from a
 * value that is not a string (D-PG4-01).
 */
type ComponentPathValidation =
  | { readonly ok: true; readonly relative: string }
  | { readonly ok: false; readonly reason: string; readonly cause: "traversal" | "type" };

/**
 * Validates one declared path of `kind`. `subject` opens each refusal note;
 * a command map entry's source names its key there (D-CF3-03).
 */
async function validateComponentPath(
  kind: ComponentPathKind,
  raw: unknown,
  pluginRoot: string,
  subject = `component path for "${kind}"`,
): Promise<ComponentPathValidation> {
  if (Array.isArray(raw)) {
    return {
      ok: false,
      reason: `${subject} contains nested array element; must be a string`,
      cause: "type",
    };
  }

  if (typeof raw !== "string") {
    return {
      ok: false,
      reason: `${subject} is not a string (got ${typeof raw})`,
      cause: "type",
    };
  }

  const contained = await resolveContainedComponentPath(
    pluginRoot,
    raw,
    `component path "${kind}"`,
  );
  if (!contained.ok && contained.cause === "absolute") {
    return {
      ok: false,
      reason: `${subject} must be relative (got absolute "${raw}")`,
      cause: "traversal",
    };
  }

  if (!contained.ok) {
    return { ok: false, reason: `${subject} escapes plugin root: "${raw}"`, cause: "traversal" };
  }

  // Deduplicate equivalent spellings only after enforcing containment.
  const relative = path.relative(pluginRoot, contained.absolutePath);
  return { ok: true, relative: relative === "" ? "." : relative };
}

function addComponentPath(
  resolution: ComponentPathResolution,
  kind: ComponentPathKind,
  seenPaths: Set<string>,
  relative: string,
): void {
  if (seenPaths.has(relative)) {
    return;
  }

  seenPaths.add(relative);
  resolution.componentPaths[kind].push(relative);
}

async function addValidatedComponentPath(
  resolution: ComponentPathResolution,
  kind: ComponentPathKind,
  seenPaths: Set<string>,
  raw: unknown,
  pluginRoot: string,
): Promise<boolean> {
  const validated = await validateComponentPath(kind, raw, pluginRoot);

  if (validated.ok) {
    addComponentPath(resolution, kind, seenPaths, validated.relative);
    return false;
  }

  resolution.notes.push(validated.reason);
  return true;
}

/**
 * Validates and adds each declared path in order. Returns whether any path
 * was refused with a note.
 */
async function addValidatedComponentPaths(
  resolution: ComponentPathResolution,
  kind: ComponentPathKind,
  seenPaths: Set<string>,
  raws: readonly unknown[],
  pluginRoot: string,
): Promise<boolean> {
  let dirty = false;
  for (const raw of raws) {
    dirty =
      // eslint-disable-next-line no-await-in-loop -- first-declared path wins the shared `seenPaths` set
      (await addValidatedComponentPath(resolution, kind, seenPaths, raw, pluginRoot)) || dirty;
  }

  return dirty;
}

/**
 * D-CF1-06: records the existing conventional folder of `kind` as unread,
 * unless a collected declared path reaches it. `declared` defaults to the
 * kind's collected paths; commands add their map sources (D-CF3-03).
 */
function recordShadowedFolder(
  resolution: ComponentPathResolution,
  kind: ComponentPathKind,
  declared: readonly string[] = resolution.componentPaths[kind],
): void {
  const recorded = resolution.shadowedFolders ?? [];
  if (!declaredPathReachesFolder(declared, kind) && !recorded.includes(kind)) {
    resolution.shadowedFolders = [...recorded, kind];
  }
}

function markSupportedWhenCollected(
  resolution: ComponentPathResolution,
  kind: ComponentPathKind,
): void {
  if (resolution.componentPaths[kind].length > 0) {
    resolution.supported.push(kind);
  }
}

function isPlainObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * D-CF3-03: whether a `commands` value is an object map, by Claude Code
 * 2.1.316's `IKn` rule: an object whose FIRST value is an object holding
 * `source` or `content`. Any other object stays a path declaration, which
 * the path checks refuse as not a string.
 */
function isCommandMap(value: unknown): value is Readonly<Record<string, unknown>> {
  if (!isPlainObject(value)) {
    return false;
  }

  const first = Object.values(value)[0];
  return (
    isPlainObject(first) && (Object.hasOwn(first, "source") || Object.hasOwn(first, "content"))
  );
}

/** A `commands` declaration split into its paths and its object map. */
interface CommandsDeclaration {
  readonly paths: readonly unknown[];
  readonly map: Readonly<Record<string, unknown>> | undefined;
}

function readCommandsDeclaration(value: unknown): CommandsDeclaration {
  return isCommandMap(value)
    ? { paths: [], map: value }
    : { paths: readPathOrArray(value), map: undefined };
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

/**
 * D-CF3-03: the manifest fields an entry writes over its command file's
 * frontmatter. An empty string overrides nothing, as Claude Code 2.1.316's
 * merge skips a falsy field.
 */
function commandMapOverrides(
  raw: Readonly<Record<string, unknown>>,
): Pick<CommandMapEntry, "description" | "argumentHint" | "model"> {
  const { description, argumentHint, model } = raw;
  return {
    ...(nonEmptyString(description) && { description }),
    ...(nonEmptyString(argumentHint) && { argumentHint }),
    ...(nonEmptyString(model) && { model }),
  };
}

/** The JSON type name of a value, for a refusal note. */
function jsonTypeOf(value: unknown): string {
  if (value === null) {
    return "null";
  }

  return Array.isArray(value) ? "array" : typeof value;
}

const COMMAND_MAP_STRING_FIELDS = [
  "source",
  "content",
  "description",
  "argumentHint",
  "model",
] as const;

function isToolList(value: unknown): boolean {
  return (
    typeof value === "string" ||
    (Array.isArray(value) && value.every((tool) => typeof tool === "string"))
  );
}

/**
 * D-CF3-03: why an entry's fields do not have Claude Code 2.1.316's types,
 * or `undefined` when they do. `allowedTools` is checked and then ignored.
 */
function commandMapFieldRefusal(value: Readonly<Record<string, unknown>>): string | undefined {
  const field = COMMAND_MAP_STRING_FIELDS.find(
    (name) => value[name] !== undefined && typeof value[name] !== "string",
  );
  if (field !== undefined) {
    return `field "${field}" is not a string (got ${jsonTypeOf(value[field])})`;
  }

  if (value.allowedTools !== undefined && !isToolList(value.allowedTools)) {
    return 'field "allowedTools" is not a string or a list of strings';
  }

  return undefined;
}

/**
 * D-CF3-03: an entry sets exactly one of `source` and `content`, as Claude
 * Code 2.1.316's refine requires; an empty string sets nothing.
 */
function commandMapBodyRefusal(value: Readonly<Record<string, unknown>>): string | undefined {
  const setsSource = nonEmptyString(value.source);
  const setsContent = nonEmptyString(value.content);
  if (setsSource && setsContent) {
    return 'sets both "source" and "content"; it must set exactly one';
  }

  if (!setsSource && !setsContent) {
    return 'sets neither "source" nor "content"; it must set exactly one';
  }

  return undefined;
}

/**
 * D-CF3-03: one map entry as the commands bridge reads it, or the note that
 * refuses it. Claude Code 2.1.316 refuses the whole manifest for a malformed
 * entry, so every refusal makes the plugin unavailable. A `source` passes the
 * same containment check as a declared path, so an absolute path, an escape,
 * and a link are refused; its key names it in the note.
 */
async function validateCommandMapEntry(
  key: string,
  raw: unknown,
  origin: CommandMapEntry["origin"],
  pluginRoot: string,
): Promise<{ ok: true; entry: CommandMapEntry } | { ok: false; reason: string }> {
  const subject = `command map entry "${key}"`;
  if (!isPlainObject(raw)) {
    return { ok: false, reason: `${subject} is not an object (got ${jsonTypeOf(raw)})` };
  }

  const refusal = commandMapFieldRefusal(raw) ?? commandMapBodyRefusal(raw);
  if (refusal !== undefined) {
    return { ok: false, reason: `${subject} ${refusal}` };
  }

  const overrides = commandMapOverrides(raw);
  if (nonEmptyString(raw.content)) {
    return { ok: true, entry: { key, content: raw.content, origin, ...overrides } };
  }

  const validated = await validateComponentPath(
    "commands",
    raw.source,
    pluginRoot,
    `source of ${subject}`,
  );
  if (!validated.ok) {
    return { ok: false, reason: validated.reason };
  }

  return { ok: true, entry: { key, source: validated.relative, origin, ...overrides } };
}

/**
 * D-CF3-03: appends the validated entries of one object map to
 * `componentPaths.commandMap`, which exists only once a map is declared.
 * Returns whether any entry was refused with a note.
 */
async function collectCommandMap(
  resolution: ComponentPathResolution,
  map: Readonly<Record<string, unknown>> | undefined,
  origin: CommandMapEntry["origin"],
  pluginRoot: string,
): Promise<boolean> {
  if (map === undefined) {
    return false;
  }

  const entries = resolution.componentPaths.commandMap ?? [];
  resolution.componentPaths.commandMap = entries;
  let dirty = false;
  for (const [key, raw] of Object.entries(map)) {
    // eslint-disable-next-line no-await-in-loop -- the entries keep their declared order
    const validated = await validateCommandMapEntry(key, raw, origin, pluginRoot);
    if (validated.ok) {
      entries.push(validated.entry);
    } else {
      resolution.notes.push(validated.reason);
      dirty = true;
    }
  }

  return dirty;
}

/** D-CF3-03: the `source` paths of the collected map entries, in order. */
function commandMapSources(commandMap: readonly CommandMapEntry[] | undefined): string[] {
  return (commandMap ?? []).flatMap((mapEntry) => ("source" in mapEntry ? [mapEntry.source] : []));
}

/**
 * D-CF3-04 (E4): the commands kind's own collection. Claude Code 2.1.316
 * reads `commands/` unless `plugin.json` declares `commands` (a truthy
 * declaration, `[]` included). A marketplace entry's `commands` adds to the
 * folder and never leaves it unread. The order is the folder, then the
 * `plugin.json` paths, then the entry paths; it decides only which file wins
 * when two name the same command. The folder is reported unread only when
 * `plugin.json` declares, the folder exists, and no collected path reaches it.
 *
 * D-CF3-03: an object map is a declaration too, in either place. Its entries
 * go to `componentPaths.commandMap` rather than to the paths, the
 * `plugin.json` map's first, and a plugin whose only commands come from a
 * map still supports `commands`. A map source inside `commands/` reaches the
 * folder, as a declared path does.
 */
async function collectStrictCommandPaths(
  entry: PluginEntry,
  manifest: Record<string, unknown> | null,
  pluginRoot: string,
  resolution: ComponentPathResolution,
  statKind: StatKindReader,
): Promise<boolean> {
  const seenPaths = new Set<string>();
  const manifestRaw = manifest?.commands;
  const manifestDeclares = Boolean(manifestRaw);
  const manifestDeclared = readCommandsDeclaration(manifestRaw);
  const entryDeclared = readCommandsDeclaration(entry.commands);
  const folderExists = (await statKind(path.join(pluginRoot, "commands"))) === "dir";
  if (folderExists && !manifestDeclares) {
    addComponentPath(resolution, "commands", seenPaths, "commands");
  }

  const pathsDirty = await addValidatedComponentPaths(
    resolution,
    "commands",
    seenPaths,
    [...manifestDeclared.paths, ...entryDeclared.paths],
    pluginRoot,
  );
  const manifestMapDirty = await collectCommandMap(
    resolution,
    manifestDeclared.map,
    "manifest",
    pluginRoot,
  );
  const entryMapDirty = await collectCommandMap(resolution, entryDeclared.map, "entry", pluginRoot);

  if (folderExists && manifestDeclares) {
    recordShadowedFolder(resolution, "commands", [
      ...resolution.componentPaths.commands,
      ...commandMapSources(resolution.componentPaths.commandMap),
    ]);
  }

  if (resolution.componentPaths.commandMap !== undefined) {
    resolution.supported.push("commands");
  } else {
    markSupportedWhenCollected(resolution, "commands");
  }

  return pathsDirty || manifestMapDirty || entryMapDirty;
}

/**
 * D-CF1-06: whether the conventional `<kind>/` folder joins the declared
 * paths. Claude Code 2.1.316 always reads `skills/`, and reads `agents/` and
 * `workflows/` only when the kind's declaration is falsy (absent, `null`, or
 * `""`), so a declared `[]` also leaves the folder unread. `commands/` follows
 * its own rule (D-CF3-04) in `collectStrictCommandPaths` and never reaches
 * this function, and so does `skills/` for a root-source entry that lists
 * skills (D-PG4-01), in `collectRootSourceSkillPaths`.
 */
function conventionalFolderApplies(
  kind: ComponentPathKind,
  entryRaw: unknown,
  manifestRaw: unknown,
): boolean {
  return kind === "skills" || (!entryRaw && !manifestRaw);
}

/**
 * D-CF1-06: whether a collected declared path is the conventional folder or
 * lies inside it, which Claude Code 2.1.316 counts as reading the folder.
 */
function declaredPathReachesFolder(declared: readonly string[], kind: ComponentPathKind): boolean {
  return declared.some(
    (relative) => relative === kind || relative.startsWith(`${kind}${path.sep}`),
  );
}

/**
 * D-PG4-01: whether a marketplace entry's `source` names the marketplace
 * root, as Claude Code 2.1.323 tests it: a string whose segments, split on
 * `/` or `\`, are all empty or `.`, such as `./` or `.`. An object-form
 * source never does.
 */
export function isMarketplaceRootSource(source: unknown): boolean {
  return (
    typeof source === "string" &&
    source.split(/[\\/]/u).every((segment) => segment === "" || segment === ".")
  );
}

/**
 * D-PG4-01: the `skills` paths a root-source entry lists, or none when the
 * entry's source is not the marketplace root. An absent, `null`, or empty
 * declaration lists none, as `readPathOrArray` reads it.
 */
function rootSourceListedSkills(entry: PluginEntry, kind: ComponentPathKind): readonly unknown[] {
  return kind === "skills" && isMarketplaceRootSource(entry.source)
    ? readPathOrArray(entry.skills)
    : [];
}

/** Validates each path in order and records the note of each refused one. */
async function validateComponentPaths(
  resolution: ComponentPathResolution,
  kind: ComponentPathKind,
  raws: readonly unknown[],
  pluginRoot: string,
): Promise<readonly ComponentPathValidation[]> {
  const validations = await Promise.all(
    raws.map((raw) => validateComponentPath(kind, raw, pluginRoot)),
  );
  for (const validated of validations) {
    if (!validated.ok) {
      resolution.notes.push(validated.reason);
    }
  }

  return validations;
}

/**
 * D-PG4-01: the listed paths that survive, as in Claude Code 2.1.323: the
 * path is contained and names an existing directory. Only a contained path
 * is statted.
 */
async function survivingListedPaths(
  listed: readonly ComponentPathValidation[],
  pluginRoot: string,
  statKind: StatKindReader,
): Promise<readonly string[]> {
  const accepted = listed.flatMap((validated) => (validated.ok ? [validated.relative] : []));
  const kinds = await Promise.all(
    accepted.map((relative) => statKind(path.join(pluginRoot, relative))),
  );
  return accepted.filter((_relative, index) => kinds[index] === "dir");
}

/**
 * D-PG4-01: collects the surviving listed paths in listed order. The
 * conventional `skills/` folder follows only when the plugin root is listed;
 * a listed `skills/` is already a survivor and collects once.
 */
async function addListedSkillPaths(
  resolution: ComponentPathResolution,
  survivors: readonly string[],
  pluginRoot: string,
  statKind: StatKindReader,
): Promise<void> {
  const seenPaths = new Set<string>();
  for (const relative of survivors) {
    addComponentPath(resolution, "skills", seenPaths, relative);
  }

  if (survivors.includes(".") && (await statKind(path.join(pluginRoot, "skills"))) === "dir") {
    addComponentPath(resolution, "skills", seenPaths, "skills");
  }
}

/**
 * D-CF1-06 over paths already validated: the accepted declared paths in
 * order, then the `skills/` folder when it exists.
 */
async function addDeclaredSkillPaths(
  resolution: ComponentPathResolution,
  declared: readonly ComponentPathValidation[],
  pluginRoot: string,
  statKind: StatKindReader,
): Promise<void> {
  const seenPaths = new Set<string>();
  for (const validated of declared) {
    if (validated.ok) {
      addComponentPath(resolution, "skills", seenPaths, validated.relative);
    }
  }

  if ((await statKind(path.join(pluginRoot, "skills"))) === "dir") {
    addComponentPath(resolution, "skills", seenPaths, "skills");
  }
}

/**
 * D-PG4-01, as in Claude Code 2.1.323: a root-source entry that lists skills
 * gets the listed folders that survive, in place of both the `skills/` folder
 * and the `plugin.json` paths, and no folder is reported unread. When none
 * survives, a listed path refused as a traversal leaves the plugin with no
 * skill path; otherwise the D-CF1-06 rule applies. Every declared path is
 * validated once, so the notes and the returned refusal flag match the
 * D-CF1-06 rule's.
 */
async function collectRootSourceSkillPaths(
  listedRaws: readonly unknown[],
  manifest: Record<string, unknown> | null,
  pluginRoot: string,
  resolution: ComponentPathResolution,
  statKind: StatKindReader,
): Promise<boolean> {
  const listed = await validateComponentPaths(resolution, "skills", listedRaws, pluginRoot);
  const declared = await validateComponentPaths(
    resolution,
    "skills",
    readPathOrArray(manifest?.skills),
    pluginRoot,
  );
  const survivors = await survivingListedPaths(listed, pluginRoot, statKind);
  if (survivors.length > 0) {
    await addListedSkillPaths(resolution, survivors, pluginRoot, statKind);
  } else if (!listed.some((validated) => !validated.ok && validated.cause === "traversal")) {
    await addDeclaredSkillPaths(resolution, [...listed, ...declared], pluginRoot, statKind);
  }

  markSupportedWhenCollected(resolution, "skills");
  return [...listed, ...declared].some((validated) => !validated.ok);
}

async function collectStrictComponentKind(
  entry: PluginEntry,
  manifest: Record<string, unknown> | null,
  pluginRoot: string,
  resolution: ComponentPathResolution,
  statKind: StatKindReader,
  kind: ComponentPathKind,
): Promise<boolean> {
  if (kind === "commands") {
    return await collectStrictCommandPaths(entry, manifest, pluginRoot, resolution, statKind);
  }

  const rootSourceSkills = rootSourceListedSkills(entry, kind);
  if (rootSourceSkills.length > 0) {
    return await collectRootSourceSkillPaths(
      rootSourceSkills,
      manifest,
      pluginRoot,
      resolution,
      statKind,
    );
  }

  const seenPaths = new Set<string>();
  const entryRaw = (entry as Record<string, unknown>)[kind];
  const manifestRaw = manifest?.[kind];
  const dirty = await addValidatedComponentPaths(
    resolution,
    kind,
    seenPaths,
    [...readPathOrArray(entryRaw), ...readPathOrArray(manifestRaw)],
    pluginRoot,
  );

  if ((await statKind(path.join(pluginRoot, kind))) === "dir") {
    if (conventionalFolderApplies(kind, entryRaw, manifestRaw)) {
      addComponentPath(resolution, kind, seenPaths, kind);
    } else {
      recordShadowedFolder(resolution, kind);
    }
  }

  markSupportedWhenCollected(resolution, kind);
  return dirty;
}

/**
 * Collects strict entry, manifest, and conventional component paths with
 * first-wins deduplication. Per D-CF1-06, as in Claude Code 2.1.316, entry
 * paths come first, a declared `skills` path adds to the conventional
 * `skills/` folder, and a declared `agents` or `workflows` path replaces its
 * conventional folder, which is read only for an undeclared kind. Commands
 * are one exception (D-CF3-04, E4): `commands/` comes first and is read
 * unless `plugin.json` declares `commands`, then the `plugin.json` paths,
 * then the marketplace entry's paths, which add to the folder. A root-source
 * entry that lists skills is the other (D-PG4-01, Claude Code 2.1.323): its
 * surviving listed folders replace `skills/` and the `plugin.json` paths.
 */
export async function collectStrictComponentPaths(
  input: {
    readonly entry: PluginEntry;
    readonly manifest: Record<string, unknown> | null;
    readonly pluginRoot: string;
    readonly resolution: ComponentPathResolution;
  },
  statKind: StatKindReader,
): Promise<boolean> {
  const flags: boolean[] = [];

  for (const kind of COMPONENT_PATH_KINDS) {
    flags.push(
      // eslint-disable-next-line no-await-in-loop -- each kind appends to the shared resolution in kind order
      await collectStrictComponentKind(
        input.entry,
        input.manifest,
        input.pluginRoot,
        input.resolution,
        statKind,
        kind,
      ),
    );
  }

  return flags.includes(true);
}
