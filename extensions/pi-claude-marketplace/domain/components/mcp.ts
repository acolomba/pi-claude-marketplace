// domain/components/mcp.ts
//
// TypeBox schema for the `mcpServers` map shape (PRD §5.8 MC-1/MC-2).
// The per-server entry shape is opaque here -- the MCP bridge inspects
// each entry's `command`/`args`/`env` fields when it stages servers. This
// schema validates only that mcpServers is a string-keyed object.
//
// D-07: JIT compilation at module load. The import path is `typebox/compile`.

import Type from "typebox";
import { Compile } from "typebox/compile";

export const MCP_SERVERS_SCHEMA = Type.Record(Type.String(), Type.Unknown());

export type MCPServers = Type.Static<typeof MCP_SERVERS_SCHEMA>;

/** JIT-compiled validator (D-07). Use `.Check(value)` or `.Parse(value)`. */
export const MCP_SERVERS_VALIDATOR = Compile(MCP_SERVERS_SCHEMA);
