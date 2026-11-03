// domain/components/mcp.ts
//
// TypeBox schemas for MCP server declarations (PRD §5.8 MC-2, D-CF6-01).
// A server map is a string-keyed object whose per-server entries stay opaque
// here: `domain/mcp-server-features.ts` classifies each one. A declared
// `mcpServers` value is a server map or an array of reference strings and
// server maps, read in order, as Claude Code's manifest schema allows. The
// plugin schemas add the single reference string beside it.
//
// D-07: JIT compilation at module load. The import path is `typebox/compile`.

import Type from "typebox";
import { Compile } from "typebox/compile";

const MCP_SERVER_MAP_SCHEMA = Type.Record(Type.String(), Type.Unknown());

export const MCP_SERVERS_SCHEMA = Type.Union([
  MCP_SERVER_MAP_SCHEMA,
  Type.Array(Type.Union([Type.String(), MCP_SERVER_MAP_SCHEMA])),
]);

/** JIT-compiled server-map validator (D-07). Use `.Check(value)` or `.Errors(value)`. */
export const MCP_SERVER_MAP_VALIDATOR = Compile(MCP_SERVER_MAP_SCHEMA);
