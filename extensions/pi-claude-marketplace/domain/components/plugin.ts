// domain/components/plugin.ts
//
// TypeBox schemas for plugin entries (inside `marketplace.json` `plugins[]`)
// and standalone plugin.json files. Per MM-2, all unsupported-component
// declarations are accepted as opaque `Type.Unknown()` -- the resolver
// classifies and disqualifies them. Per MM-3 the resolver also runs the
// source field through parsePluginSource; the schema layer accepts `source`
// as Unknown.
//
// TypeBox `Type.Optional` produces `T | undefined` in Static<>, not `T?`.
// Use `=== undefined` checks downstream, not `in`.

import Type from "typebox";
import { Compile } from "typebox/compile";

import { MCP_SERVERS_SCHEMA } from "./mcp.ts";

const PLUGIN_METADATA_FIELDS = {
  description: Type.Optional(Type.String()),
  version: Type.Optional(Type.String()),
};

const SUPPORTED_COMPONENT_PATH_FIELDS = {
  skills: Type.Optional(Type.Unknown()),
  commands: Type.Optional(Type.Unknown()),
  agents: Type.Optional(Type.Unknown()),
};

const UNSUPPORTED_COMPONENT_FIELDS = {
  hooks: Type.Optional(Type.Unknown()),
  lspServers: Type.Optional(Type.Unknown()),
  monitors: Type.Optional(Type.Unknown()),
  themes: Type.Optional(Type.Unknown()),
  outputStyles: Type.Optional(Type.Unknown()),
  channels: Type.Optional(Type.Unknown()),
  userConfig: Type.Optional(Type.Unknown()),
  bin: Type.Optional(Type.Unknown()),
  settings: Type.Optional(Type.Unknown()),
};

/**
 * MM-2: plugin entry inside `marketplace.json` `plugins[]`. Required
 * fields are `name` (safe-name validation runs separately at the resolver
 * via assertSafeName from domain/name.ts) and `source` (the resolver runs
 * parsePluginSource on it). All component-path fields are optional;
 * unsupported components (hooks, lspServers, etc.) are declared opaquely
 * and disqualify install per PR-3 (resolver).
 */
export const PLUGIN_ENTRY_SCHEMA = Type.Object({
  // required
  name: Type.String(),
  source: Type.Unknown(), // MM-3 -- classified by parsePluginSource; not validated here

  // optional metadata (MM-2)
  ...PLUGIN_METADATA_FIELDS,

  // optional supported component-path fields (MM-2: string form preferred;
  // array form is rejected by the resolver per PR-2)
  ...SUPPORTED_COMPONENT_PATH_FIELDS,

  // optional opaque "unsupported component" declarations (MM-2 / PR-3)
  ...UNSUPPORTED_COMPONENT_FIELDS,

  // optional mcpServers map (MM-2 / MC-1)
  mcpServers: Type.Optional(MCP_SERVERS_SCHEMA),

  // optional dependencies (MM-2 / PI-13: opaque, surfaces as warning)
  dependencies: Type.Optional(Type.Unknown()),
});

export type PluginEntry = Type.Static<typeof PLUGIN_ENTRY_SCHEMA>;

/** JIT-compiled validator (D-07). */
export const PLUGIN_ENTRY_VALIDATOR = Compile(PLUGIN_ENTRY_SCHEMA);

/**
 * Standalone plugin.json shape. Same as PLUGIN_ENTRY_SCHEMA but `name` is
 * optional (manifest may omit it; the entry name from marketplace.json
 * wins) and `source` is absent (a plugin.json describes itself).
 */
export const PLUGIN_MANIFEST_SCHEMA = Type.Object({
  name: Type.Optional(Type.String()),

  ...PLUGIN_METADATA_FIELDS,
  ...SUPPORTED_COMPONENT_PATH_FIELDS,
  ...UNSUPPORTED_COMPONENT_FIELDS,

  mcpServers: Type.Optional(MCP_SERVERS_SCHEMA),
  dependencies: Type.Optional(Type.Unknown()),
});

export type PluginManifest = Type.Static<typeof PLUGIN_MANIFEST_SCHEMA>;

/** JIT-compiled validator (D-07). */
export const PLUGIN_MANIFEST_VALIDATOR = Compile(PLUGIN_MANIFEST_SCHEMA);
