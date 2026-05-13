// domain/components/mcp.ts
//
// TypeBox schema for the `mcpServers` map shape (PRD §5.8 MC-1/MC-2).
// The per-server entry shape is opaque from Phase 2's perspective -- the
// Phase 3 MCP bridge inspects each entry's `command`/`args`/`env` fields
// when it stages servers. Phase 2 validates only that mcpServers is a
// string-keyed object.
//
// CONTEXT.md D-07 + RESEARCH.md Pattern 2: JIT compilation at module load.
// RESEARCH.md Pitfall 3: import path is `typebox/compile` in 1.x.

import Type from "typebox";
import { Compile } from "typebox/compile";

export const MCP_SERVERS_SCHEMA = Type.Record(Type.String(), Type.Unknown());

export type MCPServers = Type.Static<typeof MCP_SERVERS_SCHEMA>;

/** JIT-compiled validator (D-07). Use `.Check(value)` or `.Parse(value)`. */
export const MCP_SERVERS_VALIDATOR = Compile(MCP_SERVERS_SCHEMA);
