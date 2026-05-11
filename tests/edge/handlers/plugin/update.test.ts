/* eslint-disable @typescript-eslint/no-empty-function --
 * Wave 0 skipped stubs (`test.skip(name, () => {})`) deliberately have empty
 * bodies; the bodies are filled in as the corresponding production modules
 * land in Wave 1+. See `.planning/phases/06-edge-layer-tab-completion/06-01-test-scaffolding-PLAN.md`. */

import { test } from "node:test";

// @ts-expect-error -- module created in Wave 1 (06-02-PLAN). Type-only so
// runtime ESM resolution does not fail before the module exists; when Wave 1+
// lands, executors REMOVE the @ts-expect-error directive, change this to
// `import * as _target ...`, and unskip the relevant tests.
import type * as _target from "../../../../extensions/claude-marketplace/edge/handlers/plugin/update.ts";

// Reference the namespace so noUnusedLocals is satisfied; type-only export
// is erased at runtime and never exposes a value.
export type _TargetShape = typeof _target;

test.skip("shim :: bare /update with no positional calls updatePlugins with target = all-plugins-all-marketplaces", () => {});
test.skip("shim :: <plugin>@<marketplace> form calls updatePlugins with single-plugin target", () => {});
test.skip("shim :: bare @<marketplace> form calls updatePlugins with all-plugins-one-marketplace target", () => {});
test.skip("shim :: --scope user/project propagated to updatePlugins", () => {});
test.skip("shim :: invalid ref (no @, not bare) emits USAGE", () => {});
