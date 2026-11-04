/**
 * @fileoverview The hook that tells the world which scenarios choose their own
 * MCP implementation (DUAL-01).
 *
 * An `@own-implementation` scenario chooses its implementation itself, such as
 * none at all or a switch from one to the other. The world then removes the
 * harness onboarding seed before a profile Pi that loads pi-mcp-adapter
 * starts, so the adapter's real first-run write happens.
 */

import { Before } from "@cucumber/cucumber";

import type { ScenarioWorld } from "./world.ts";

Before({ tags: "@own-implementation" }, function (this: ScenarioWorld): void {
  this.ownImplementation = true;
});
