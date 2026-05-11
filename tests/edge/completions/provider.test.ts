/* eslint-disable @typescript-eslint/no-empty-function --
 * Wave 0 skipped stubs (`test.skip(name, () => {})`) deliberately have empty
 * bodies; the bodies are filled in as the corresponding production modules
 * land in Wave 1+. See `.planning/phases/06-edge-layer-tab-completion/06-01-test-scaffolding-PLAN.md`. */

import { test } from "node:test";

// @ts-expect-error -- module created in Wave 1 (06-02-PLAN). Type-only so
// runtime ESM resolution does not fail before the module exists; when Wave 1+
// lands, executors REMOVE the @ts-expect-error directive, change this to
// `import * as _target ...`, and unskip the relevant tests.
import type * as _target from "../../../extensions/claude-marketplace/edge/completions/provider.ts";

// Reference the namespace so noUnusedLocals is satisfied; type-only export
// is erased at runtime and never exposes a value.
export type _TargetShape = typeof _target;

test.skip("TC-1 :: first positional surfaces top-level keywords (install/uninstall/update/list/marketplace)", () => {});
test.skip('TC-1 :: top-level keyword filtering by prefix ("ins" -> install only)', () => {});
test.skip("TC-2 :: after marketplace surfaces nested keywords (add/remove/list/update/autoupdate/noautoupdate)", () => {});
test.skip("TC-2 :: nested keyword set excludes rm (surfaced only via router alias)", () => {});
test.skip("TC-3 :: - prefix surfaces --scope", () => {});
test.skip("TC-3 :: - prefix on list head also surfaces --installed/--available/--unavailable", () => {});
test.skip("TC-3 :: -- and - prefixes behave identically", () => {});
test.skip("TC-4 :: token after --scope surfaces user and project only", () => {});
test.skip("TC-5 :: list <here> completes with union of marketplace names from both scopes", () => {});
test.skip("TC-5 :: marketplace remove <here> completes with marketplace names", () => {});
test.skip("TC-5 :: marketplace update <here> completes with marketplace names", () => {});
test.skip("TC-5 :: marketplace autoupdate <here> completes with marketplace names", () => {});
test.skip("TC-5 :: marketplace noautoupdate <here> completes with marketplace names", () => {});
test.skip("TC-6 :: install <here> -- status filter excludes installed plugins", () => {});
test.skip("TC-6 :: install <here> -- status filter INCLUDES unavailable plugins (D-03 corollary, future --force)", () => {});
test.skip("TC-6 :: uninstall <here> -- status filter shows only installed plugins", () => {});
test.skip("TC-6 :: update <here> -- status filter shows only installed plugins", () => {});
test.skip("TC-6 :: update accepts bare @<marketplace> form", () => {});
test.skip("TC-6 :: unique plugin yields name@mp with trailing space", () => {});
test.skip("TC-6 :: multi-marketplace plugin yields name@ without trailing space", () => {});
test.skip("TC-7 :: all terminal completions include trailing space (TC-1 case)", () => {});
test.skip("TC-8 :: per-marketplace manifest load failure soft-fails to empty list (no throw)", () => {});
test.skip("TC-9 :: state.json error propagates (throw escapes getArgumentCompletions)", () => {});
test.skip("no-match position returns null (Pi-tui sentinel; not [])", () => {});
