/* eslint-disable @typescript-eslint/no-empty-function --
 * Wave 0 skipped stubs (`test.skip(name, () => {})`) deliberately have empty
 * bodies; the bodies are filled in as the corresponding production modules
 * land in Wave 1+. See `.planning/phases/06-edge-layer-tab-completion/06-01-test-scaffolding-PLAN.md`. */

import { test } from "node:test";

// @ts-expect-error -- module created in Wave 1 (06-02-PLAN). Type-only so
// runtime ESM resolution does not fail before the module exists; when Wave 1+
// lands, executors REMOVE the @ts-expect-error directive, change this to
// `import * as _target ...`, and unskip the relevant tests.
import type * as _target from "../../extensions/claude-marketplace/edge/args.ts";

// Reference the namespace so noUnusedLocals is satisfied; type-only export
// is erased at runtime and never exposes a value.
export type _TargetShape = typeof _target;

test.skip("AP-1 :: tokenize bare string", () => {});
test.skip("AP-1 :: tokenize single-quoted spaced argument", () => {});
test.skip("AP-1 :: tokenize double-quoted spaced argument", () => {});
test.skip("AP-1 :: tokenize mixed quotes in same input", () => {});
test.skip("AP-1 :: tokenize unicode/non-ASCII positionals", () => {});
test.skip("AP-2 :: --scope user is valid", () => {});
test.skip("AP-2 :: --scope project is valid", () => {});
test.skip("AP-2 :: --scope missing value throws clear error", () => {});
test.skip("AP-2 :: --scope invalid value (foo) throws clear error", () => {});
test.skip("AP-4 :: --scope accepted at position 0", () => {});
test.skip("AP-4 :: --scope accepted at middle position", () => {});
test.skip("AP-4 :: --scope accepted at end position", () => {});
test.skip("AP-4 :: positionals extracted in order regardless of --scope position", () => {});
