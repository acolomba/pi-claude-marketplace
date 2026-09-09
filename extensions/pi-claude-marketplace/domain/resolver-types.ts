import Type from "typebox";

import type { DroppedHook } from "./components/hooks.ts";
import type { GitHubSource, GitSubdirSource, UrlSource } from "./source.ts";

const ComponentPathsSchema = Type.Object({
  skills: Type.Array(Type.String()),
  commands: Type.Array(Type.String()),
  agents: Type.Array(Type.String()),
});

const McpServersFieldSchema = Type.Record(Type.String(), Type.Unknown());

const DroppedHookSchema = Type.Union([
  Type.Object({ kind: Type.Literal("event"), event: Type.String() }),
  Type.Object({
    kind: Type.Literal("group"),
    event: Type.String(),
    matcher: Type.String(),
    cond: Type.Union([
      Type.Literal("regex"),
      Type.Literal("unmapped-tool"),
      Type.Literal("no-matcher-support"),
      Type.Literal("closed-set"),
    ]),
  }),
  Type.Object({
    kind: Type.Literal("handler"),
    event: Type.String(),
    matcher: Type.String(),
    handlerType: Type.String(),
  }),
]);

type AssertTrue<T extends true> = T;

// fallow-ignore-next-line unused-type, private-type-leak -- compile-time drift guard; the export exists so noUnusedLocals treats it as consumed, while AssertTrue is an assertion helper with no caller meaning.
export type DroppedHookDriftCheck = AssertTrue<
  DroppedHook extends Type.Static<typeof DroppedHookSchema> ? true : false
>;

type DroppedHookArmKeysMatch<K extends DroppedHook["kind"]> = [
  keyof Extract<DroppedHook, { kind: K }>,
] extends [keyof Extract<Type.Static<typeof DroppedHookSchema>, { kind: K }>]
  ? [keyof Extract<Type.Static<typeof DroppedHookSchema>, { kind: K }>] extends [
      keyof Extract<DroppedHook, { kind: K }>,
    ]
    ? true
    : false
  : false;

type DroppedHookArmKeysDrift =
  DroppedHookArmKeysMatch<"event"> extends true
    ? DroppedHookArmKeysMatch<"group"> extends true
      ? DroppedHookArmKeysMatch<"handler"> extends true
        ? true
        : never
      : never
    : never;

// fallow-ignore-next-line unused-type, private-type-leak -- compile-time key-parity guard; the export exists so noUnusedLocals treats it as consumed, while assertion internals have no caller meaning.
export type DroppedHookArmKeysCheck = AssertTrue<
  // fallow-ignore-next-line private-type-leak -- DroppedHookArmKeysDrift is an internal step of this compile-time key-parity guard.
  [true] extends [DroppedHookArmKeysDrift] ? true : false
>;

const MATERIALIZABLE_FIELDS = {
  installable: Type.Literal(true),
  name: Type.String(),
  pluginRoot: Type.String(),
  supported: Type.Array(Type.String()),
  unsupported: Type.Array(Type.String()),
  notes: Type.Array(Type.String()),
  componentPaths: ComponentPathsSchema,
  mcpServers: McpServersFieldSchema,
  hooksConfigPath: Type.Optional(Type.String()),
  orphanRewake: Type.Optional(Type.Boolean()),
  droppedHooks: Type.Optional(Type.Array(DroppedHookSchema)),
  defaultEnabled: Type.Boolean(),
} as const;

const ResolvedPluginInstallableSchema = Type.Object({
  state: Type.Literal("installable"),
  ...MATERIALIZABLE_FIELDS,
});

const ResolvedPluginPartiallyAvailableSchema = Type.Object({
  state: Type.Literal("partially-available"),
  ...MATERIALIZABLE_FIELDS,
});

const ResolvedPluginUnavailableSchema = Type.Object({
  state: Type.Literal("unavailable"),
  installable: Type.Literal(false),
  name: Type.String(),
  notes: Type.Array(Type.String()),
});

/** Runtime schema for the exact three-arm resolver result union. */
// fallow-ignore-next-line unused-export -- canonical runtime definition of the resolver result union, consumed through Type.Static and its mirrored owner test.
export const ResolvedPluginSchema = Type.Union([
  ResolvedPluginInstallableSchema,
  ResolvedPluginPartiallyAvailableSchema,
  ResolvedPluginUnavailableSchema,
]);

export type ResolvedPluginInstallable = Type.Static<typeof ResolvedPluginInstallableSchema>;
export type ResolvedPluginPartiallyAvailable = Type.Static<
  typeof ResolvedPluginPartiallyAvailableSchema
>;
export type ResolvedPluginUnavailable = Type.Static<typeof ResolvedPluginUnavailableSchema>;
export type ResolvedPlugin = Type.Static<typeof ResolvedPluginSchema>;

/** Resolver results that own a safe materialization root. */
export type MaterializablePlugin = ResolvedPluginInstallable | ResolvedPluginPartiallyAvailable;

/** Filesystem shape read by the resolver. */
export type StatKind = "file" | "dir" | null;

/** Reads the filesystem shape of one path. */
export type StatKindReader = (path: string) => Promise<StatKind>;

/** Result of resolving a Git-backed plugin root. */
export type GitPluginRootResult =
  | { readonly kind: "materialized"; readonly pluginRoot: string; readonly resolvedSha: string }
  | { readonly kind: "not-cached" }
  | { readonly kind: "escapes"; readonly detail: string }
  | { readonly kind: "missing-subdir"; readonly detail: string };

/** Injectable collaborators and root required by plugin resolution. */
export interface ResolveContext {
  readonly marketplaceRoot: string;
  readonly readFileText?: (path: string) => Promise<string>;
  readonly statKind?: StatKindReader;
  readonly resolveGitPluginRoot?: (
    source: UrlSource | GitSubdirSource | GitHubSource,
  ) => Promise<GitPluginRootResult>;
}
