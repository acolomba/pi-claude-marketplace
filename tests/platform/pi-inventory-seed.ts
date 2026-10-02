/**
 * Pi inventory seeds shared by the soft-dependency probe tests. Each seed
 * returns a fresh value on every call.
 *
 * PIFL-04: Pi 1.0 requires `exposure` on every `ToolInfo`, so the seed sets it
 * once here for every planted tool.
 */
import { Type } from "typebox";

import type { ToolInfo } from "@earendil-works/pi-coding-agent";

export function toolInfo(name: string): ToolInfo {
  return {
    name,
    description: `test tool ${name}`,
    parameters: Type.Object({}),
    exposure: "direct",
    sourceInfo: {
      origin: "top-level",
      path: `/test/tools/${name}.ts`,
      scope: "temporary",
      source: "test",
    },
  } satisfies ToolInfo;
}
