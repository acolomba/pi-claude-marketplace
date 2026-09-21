import type { DroppedHook } from "./components/hooks.ts";
import type { GitHubSource, GitSubdirSource, UrlSource } from "./source.ts";
import type Type from "typebox";

type ComponentPathsSchema = Type.TObject<{
  skills: Type.TArray<Type.TString>;
  commands: Type.TArray<Type.TString>;
  agents: Type.TArray<Type.TString>;
  workflows: Type.TArray<Type.TString>;
}>;

type McpServersFieldSchema = ReturnType<typeof Type.Record<Type.TString, Type.TUnknown>>;

type DroppedHookSchema = Type.TUnion<
  [
    Type.TObject<{ kind: Type.TLiteral<"event">; event: Type.TString }>,
    Type.TObject<{
      kind: Type.TLiteral<"group">;
      event: Type.TString;
      matcher: Type.TString;
      cond: Type.TUnion<
        [
          Type.TLiteral<"regex">,
          Type.TLiteral<"unmapped-tool">,
          Type.TLiteral<"no-matcher-support">,
          Type.TLiteral<"closed-set">,
        ]
      >;
    }>,
    Type.TObject<{
      kind: Type.TLiteral<"handler">;
      event: Type.TString;
      matcher: Type.TString;
      handlerType: Type.TString;
    }>,
  ]
>;

type AssertTrue<T extends true> = T;

type DroppedHookDriftCheck = AssertTrue<
  DroppedHook extends Type.Static<DroppedHookSchema>
    ? Type.Static<DroppedHookSchema>["kind"] extends DroppedHook["kind"]
      ? true
      : false
    : false
>;

type DroppedHookArmKeysMatch<K extends DroppedHook["kind"]> = [
  keyof Extract<DroppedHook, { kind: K }>,
] extends [keyof Extract<Type.Static<DroppedHookSchema>, { kind: K }>]
  ? [keyof Extract<Type.Static<DroppedHookSchema>, { kind: K }>] extends [
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

type DroppedHookArmKeysCheck = AssertTrue<[true] extends [DroppedHookArmKeysDrift] ? true : false>;

interface MaterializableFields {
  installable: Type.TLiteral<true>;
  name: Type.TString;
  pluginRoot: Type.TString;
  supported: Type.TArray<Type.TString>;
  unsupported: Type.TArray<Type.TString>;
  notes: Type.TArray<Type.TString>;
  componentPaths: ComponentPathsSchema;
  mcpServers: McpServersFieldSchema;
  hooksConfigPath: Type.TOptional<Type.TString>;
  orphanRewake: Type.TOptional<Type.TBoolean>;
  droppedHooks: Type.TOptional<
    Type.TArray<
      [DroppedHookDriftCheck, DroppedHookArmKeysCheck] extends [true, true]
        ? DroppedHookSchema
        : never
    >
  >;
  defaultEnabled: Type.TBoolean;
}

// TypeBox requires a mapped property record; an interface has no implicit index signature.
type MaterializableProperties = {
  [Field in keyof MaterializableFields]: MaterializableFields[Field];
};

type ResolvedPluginInstallableSchema = Type.TObject<
  { state: Type.TLiteral<"installable"> } & MaterializableProperties
>;

type ResolvedPluginPartiallyAvailableSchema = Type.TObject<
  { state: Type.TLiteral<"partially-available"> } & MaterializableProperties
>;

type ResolvedPluginUnavailableSchema = Type.TObject<{
  state: Type.TLiteral<"unavailable">;
  installable: Type.TLiteral<false>;
  name: Type.TString;
  notes: Type.TArray<Type.TString>;
}>;

/** Type-only schema for the exact three-arm resolver result union. */
type ResolvedPluginSchema = Type.TUnion<
  [
    ResolvedPluginInstallableSchema,
    ResolvedPluginPartiallyAvailableSchema,
    ResolvedPluginUnavailableSchema,
  ]
>;

// fallow-ignore-next-line private-type-leak -- ResolvedPluginSchema is the private TypeBox shape and hook-drift proof behind this public structural contract.
export type ResolvedPlugin = Type.Static<ResolvedPluginSchema>;
export type ResolvedPluginInstallable = Extract<ResolvedPlugin, { state: "installable" }>;
export type ResolvedPluginPartiallyAvailable = Extract<
  ResolvedPlugin,
  { state: "partially-available" }
>;
export type ResolvedPluginUnavailable = Extract<ResolvedPlugin, { state: "unavailable" }>;

/** Resolver results that own a safe materialization root. */
export type MaterializablePlugin = ResolvedPluginInstallable | ResolvedPluginPartiallyAvailable;

/** Filesystem shape read by the resolver. */
export type StatKind = "file" | "dir" | null;

/** Reads the filesystem shape of one path. */
export type StatKindReader = (path: string) => Promise<StatKind>;

/** Result of resolving a Git-backed plugin root. */
export type GitPluginRootResult =
  | {
      readonly kind: "materialized";
      readonly pluginRoot: string;
      readonly resolvedSha: string;
    }
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
