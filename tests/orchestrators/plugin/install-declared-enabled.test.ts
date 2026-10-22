import assert from "node:assert/strict";
import test from "node:test";

import { resolveInstallDeclaredEnabled } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-declared-enabled.ts";

import type { ScopeConfig } from "../../../extensions/pi-claude-marketplace/persistence/config-io.ts";

interface DeclaredEnabledCase {
  readonly title: string;
  readonly current: ScopeConfig;
  readonly other: ScopeConfig | undefined;
  readonly targetIsLocal: boolean;
  readonly expected: boolean | undefined;
}

const KEY = "hello@marketplace";

const CASES: readonly DeclaredEnabledCase[] = [
  {
    title: "returns true from a selected local declaration",
    current: { schemaVersion: 1, plugins: { [KEY]: { enabled: true } } },
    other: { schemaVersion: 1, plugins: { [KEY]: { enabled: false } } },
    targetIsLocal: true,
    expected: true,
  },
  {
    title: "returns the base false under a local entry without enabled",
    current: { schemaVersion: 1, plugins: { [KEY]: {} } },
    other: { schemaVersion: 1, plugins: { [KEY]: { enabled: false } } },
    targetIsLocal: true,
    expected: false,
  },
  {
    title: "returns the base true under a local entry without enabled",
    current: { schemaVersion: 1, plugins: { [KEY]: { enabled: true } } },
    other: { schemaVersion: 1, plugins: { [KEY]: {} } },
    targetIsLocal: false,
    expected: true,
  },
  {
    title: "returns false from the local layer when the base layer is the target",
    current: { schemaVersion: 1, plugins: { [KEY]: { enabled: true } } },
    other: { schemaVersion: 1, plugins: { [KEY]: { enabled: false } } },
    targetIsLocal: false,
    expected: false,
  },
  {
    title: "falls back to the selected base declaration when local is absent",
    current: { schemaVersion: 1, plugins: { [KEY]: { enabled: true } } },
    other: { schemaVersion: 1 },
    targetIsLocal: false,
    expected: true,
  },
  {
    title: "returns undefined when neither physical file declares the plugin",
    current: { schemaVersion: 1 },
    other: undefined,
    targetIsLocal: false,
    expected: undefined,
  },
];

for (const row of CASES) {
  test(row.title, () => {
    // arrange
    const options = {
      current: row.current,
      other: row.other,
      targetIsLocal: row.targetIsLocal,
      key: KEY,
    };

    // act
    const declaredEnabled = resolveInstallDeclaredEnabled(options);

    // assert
    assert.strictEqual(declaredEnabled, row.expected);
  });
}
