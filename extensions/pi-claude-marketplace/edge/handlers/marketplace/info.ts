// edge/handlers/marketplace/info.ts
//
// Thin-shim handler factory for
// `/claude:plugin marketplace info <name> [--scope user|project]`.
// Argument-parsing failures route through `notifyUsageError`; the
// orchestrator handles per-scope projection, fan-out, and the
// `{marketplace not added}` carve-out. This shim validates the positional/scope
// shape and delegates.

import { getMarketplaceInfo } from "../../../orchestrators/marketplace/info.ts";

import { makeSingleNameMarketplaceHandler } from "./shared.ts";

import type { SubcommandHandler } from "../../router.ts";

const USAGE = "Usage: /claude:plugin marketplace info <name> [--scope user|project]";

export function makeMarketplaceInfoHandler(): SubcommandHandler {
  return makeSingleNameMarketplaceHandler(USAGE, getMarketplaceInfo);
}
