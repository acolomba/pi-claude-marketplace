/* eslint-disable @typescript-eslint/no-empty-function --
 * Wave 0 skipped stubs (`test.skip(name, () => {})`) deliberately have empty
 * bodies; the bodies are filled in as the corresponding production modules
 * land in Wave 1+. See `.planning/phases/06-edge-layer-tab-completion/06-01-test-scaffolding-PLAN.md`. */

import { test } from "node:test";

// @ts-expect-error -- module created in Wave 1 (06-02-PLAN). Type-only so
// runtime ESM resolution does not fail before the module exists; when Wave 1+
// lands, executors REMOVE the @ts-expect-error directive, change this to
// `import * as _target ...`, and unskip the relevant tests.
import type * as _target from "../../../../extensions/claude-marketplace/edge/handlers/plugin/uninstall.ts";

// Reference the namespace so noUnusedLocals is satisfied; type-only export
// is erased at runtime and never exposes a value.
export type _TargetShape = typeof _target;

test.skip("shim :: missing positional emits USAGE via notifyError; no orchestrator call", () => {});
test.skip("shim :: invalid ref (no @) emits USAGE + format error; no orchestrator call", () => {});
test.skip("shim :: invalid ref (leading @) emits USAGE + format error", () => {});
test.skip("shim :: invalid ref (trailing @) emits USAGE + format error", () => {});
test.skip('shim :: valid args call uninstallPlugin with { ctx, pi, scope: "user", cwd, marketplace, plugin }', () => {});
test.skip('shim :: --scope project calls uninstallPlugin with scope: "project"', () => {});
