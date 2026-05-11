/* eslint-disable @typescript-eslint/no-empty-function --
 * Wave 0 skipped stubs (`test.skip(name, () => {})`) deliberately have empty
 * bodies; the bodies are filled in as the corresponding production modules
 * land in Wave 1+. See `.planning/phases/06-edge-layer-tab-completion/06-01-test-scaffolding-PLAN.md`. */

import { test } from "node:test";

// @ts-expect-error -- module created in Wave 1 (06-02-PLAN). Type-only so
// runtime ESM resolution does not fail before the module exists; when Wave 1+
// lands, executors REMOVE the @ts-expect-error directive, change this to
// `import * as _target ...`, and unskip the relevant tests.
import type * as _target from "../../extensions/claude-marketplace/edge/args-schema.ts";

// Reference the namespace so noUnusedLocals is satisfied; type-only export
// is erased at runtime and never exposes a value.
export type _TargetShape = typeof _target;

test.skip("parseCommandArgs :: required positional missing emits usage via notifyError and returns undefined", () => {});
test.skip("parseCommandArgs :: optional positional missing returns parsed with property undefined", () => {});
test.skip("parseCommandArgs :: tokenizer throw routes through notifyError + returns undefined", () => {});
test.skip("parseCommandArgs :: typed return shape (compile-time check)", () => {});
