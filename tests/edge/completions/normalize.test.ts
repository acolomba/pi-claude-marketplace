/* eslint-disable @typescript-eslint/no-empty-function --
 * Wave 0 skipped stubs (`test.skip(name, () => {})`) deliberately have empty
 * bodies; the bodies are filled in as the corresponding production modules
 * land in Wave 1+. See `.planning/phases/06-edge-layer-tab-completion/06-01-test-scaffolding-PLAN.md`. */

import { test } from "node:test";

// @ts-expect-error -- module created in Wave 1 (06-02-PLAN). Type-only so
// runtime ESM resolution does not fail before the module exists; when Wave 1+
// lands, executors REMOVE the @ts-expect-error directive, change this to
// `import * as _target ...`, and unskip the relevant tests.
import type * as _target from "../../../extensions/claude-marketplace/edge/completions/normalize.ts";

// Reference the namespace so noUnusedLocals is satisfied; type-only export
// is erased at runtime and never exposes a value.
export type _TargetShape = typeof _target;

test.skip("TC-7 :: normalize collapses two spaces at cursor to one", () => {});
test.skip("TC-7 :: normalize is a no-op when no doubled space at cursor", () => {});
test.skip("TC-7 :: normalize is a no-op at end-of-line trailing space", () => {});
test.skip("TC-7 :: normalize is idempotent (stacked wrapper safe)", () => {});
test.skip("isClaudePluginCommandLine :: matches /claude:plugin", () => {});
test.skip("isClaudePluginCommandLine :: matches /claude:plugin install", () => {});
test.skip("isClaudePluginCommandLine :: matches /claude:plugin:42 install (collision suffix)", () => {});
test.skip("isClaudePluginCommandLine :: does not match /other-extension", () => {});
test.skip("isClaudePluginCommandLine :: does not match claude:plugin (no leading slash)", () => {});
test.skip("isClaudePluginCommandLine :: does not match /claude:plugin-extra", () => {});
