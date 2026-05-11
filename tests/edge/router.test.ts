/* eslint-disable @typescript-eslint/no-empty-function --
 * Wave 0 skipped stubs (`test.skip(name, () => {})`) deliberately have empty
 * bodies; the bodies are filled in as the corresponding production modules
 * land in Wave 1+. See `.planning/phases/06-edge-layer-tab-completion/06-01-test-scaffolding-PLAN.md`. */

import { test } from "node:test";

// @ts-expect-error -- module created in Wave 1 (06-02-PLAN). Type-only so
// runtime ESM resolution does not fail before the module exists; when Wave 1+
// lands, executors REMOVE the @ts-expect-error directive, change this to
// `import * as _target ...`, and unskip the relevant tests.
import type * as _target from "../../extensions/claude-marketplace/edge/router.ts";

// Reference the namespace so noUnusedLocals is satisfied; type-only export
// is erased at runtime and never exposes a value.
export type _TargetShape = typeof _target;

test.skip("AP-3 :: empty input emits TOP_LEVEL_USAGE at error severity", () => {});
test.skip("AP-3 :: unknown subcommand emits Unknown subcommand: + TOP_LEVEL_USAGE at error severity", () => {});
test.skip("AP-3 :: marketplace with empty rest emits MARKETPLACE_USAGE at error severity", () => {});
test.skip("AP-3 :: marketplace with unknown verb emits Unknown subcommand: + MARKETPLACE_USAGE", () => {});
test.skip("routeClaudePlugin :: dispatches install to handlers.install", () => {});
test.skip("routeClaudePlugin :: dispatches uninstall to handlers.uninstall", () => {});
test.skip("routeClaudePlugin :: dispatches update to handlers.update", () => {});
test.skip("routeClaudePlugin :: dispatches list to handlers.list", () => {});
test.skip("routeMarketplace :: dispatches add to handlers.marketplaceAdd", () => {});
test.skip("routeMarketplace :: dispatches remove to handlers.marketplaceRemove", () => {});
test.skip("routeMarketplace :: dispatches rm alias to handlers.marketplaceRemove (TC-2 surface, alias accepted)", () => {});
test.skip("routeMarketplace :: dispatches list to handlers.marketplaceList", () => {});
test.skip("routeMarketplace :: dispatches update to handlers.marketplaceUpdate", () => {});
test.skip("routeMarketplace :: dispatches autoupdate to handlers.marketplaceAutoupdate", () => {});
test.skip("routeMarketplace :: dispatches noautoupdate to handlers.marketplaceNoautoupdate", () => {});
