// edge/handlers/marketplace/info.ts
//
// Thin-shim handler factory for `marketplace info`; its usage line comes
// from `marketplaceUsage("info")`.
// Argument-parsing failures route through `notifyUsageError`; the
// orchestrator handles per-scope projection, fan-out, and the
// `{marketplace not added}` carve-out. This shim validates the positional/scope
// shape and delegates.

import { getMarketplaceInfo } from "../../../orchestrators/marketplace/info.ts";
import { marketplaceUsage } from "../../router.ts";

import { makeSingleNameMarketplaceHandler } from "./shared.ts";

import type { SubcommandHandler } from "../../router.ts";

const USAGE = marketplaceUsage("info");

export function makeMarketplaceInfoHandler(): SubcommandHandler {
  return makeSingleNameMarketplaceHandler(USAGE, getMarketplaceInfo);
}
