/* eslint-disable @typescript-eslint/no-empty-function --
 * Wave 0 skipped stubs (`test.skip(name, () => {})`) deliberately have empty
 * bodies; the bodies are filled in as the corresponding production modules
 * land in Wave 1+. See `.planning/phases/06-edge-layer-tab-completion/06-01-test-scaffolding-PLAN.md`. */

import { test } from "node:test";

// @ts-expect-error -- module created in Wave 1 (06-02-PLAN). Type-only so
// runtime ESM resolution does not fail before the module exists; when Wave 1+
// lands, executors REMOVE the @ts-expect-error directive, change this to
// `import * as _target ...`, and unskip the relevant tests.
import type * as _target from "../../extensions/claude-marketplace/edge/register.ts";

// Reference the namespace so noUnusedLocals is satisfied; type-only export
// is erased at runtime and never exposes a value.
export type _TargetShape = typeof _target;

test.skip("D-04 :: registerClaudePluginCommand registers claude:plugin command on pi", () => {});
test.skip("D-04 :: registered command has a handler that routes through routeClaudePlugin", () => {});
test.skip("D-04 :: registered command has getArgumentCompletions returning AutocompleteItem[] | null", () => {});
test.skip('D-04 :: registerClaudePluginCommand also calls pi.on("session_start", ...) exactly once', () => {});
test.skip("D-04 :: firing the session_start handler installs an autocomplete provider via ctx.ui.addAutocompleteProvider", () => {});
test.skip("D-04 :: the installed wrapper applies normalizeCompletionWhitespace only to lines matching isClaudePluginCommandLine", () => {});
test.skip("D-04 :: the installed wrapper is a no-op for non-/claude:plugin lines", () => {});
test.skip("D-04 :: registerClaudeMarketplaceTools calls pi.registerTool exactly twice", () => {});
test.skip("D-04 :: registerClaudeMarketplaceTools registers claude_marketplace_list", () => {});
test.skip("D-04 :: registerClaudeMarketplaceTools registers claude_marketplace_plugin_list", () => {});
