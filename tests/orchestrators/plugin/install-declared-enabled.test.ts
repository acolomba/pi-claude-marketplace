import assert from "node:assert/strict";
import test from "node:test";

import { resolveInstallDeclaredEnabled } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-declared-enabled.ts";

import type { ScopeConfig } from "../../../extensions/pi-claude-marketplace/persistence/config-io.ts";

interface DeclaredEnabledCase {
  readonly title: string;
  readonly current: ScopeConfig;
  readonly sibling: ScopeConfig | undefined;
  readonly targetIsLocal: boolean;
  readonly expected: boolean | undefined;
}

const KEY = "hello@marketplace";

const CASES: readonly DeclaredEnabledCase[] = [
  {
    title: "returns true from a selected local declaration",
    current: { schemaVersion: 1, plugins: { [KEY]: { enabled: true } } },
    sibling: { schemaVersion: 1, plugins: { [KEY]: { enabled: false } } },
    targetIsLocal: true,
    expected: true,
  },
  {
    title: "preserves an absent local enabled field over a base opinion",
    current: { schemaVersion: 1, plugins: { [KEY]: {} } },
    sibling: { schemaVersion: 1, plugins: { [KEY]: { enabled: false } } },
    targetIsLocal: true,
    expected: undefined,
  },
  {
    title: "returns false from the local sibling of a selected base file",
    current: { schemaVersion: 1, plugins: { [KEY]: { enabled: true } } },
    sibling: { schemaVersion: 1, plugins: { [KEY]: { enabled: false } } },
    targetIsLocal: false,
    expected: false,
  },
  {
    title: "falls back to the selected base declaration when local is absent",
    current: { schemaVersion: 1, plugins: { [KEY]: { enabled: true } } },
    sibling: { schemaVersion: 1 },
    targetIsLocal: false,
    expected: true,
  },
  {
    title: "returns undefined when neither physical file declares the plugin",
    current: { schemaVersion: 1 },
    sibling: undefined,
    targetIsLocal: false,
    expected: undefined,
  },
];

for (const row of CASES) {
  test(row.title, () => {
    // arrange
    const options = {
      current: row.current,
      sibling: row.sibling,
      targetIsLocal: row.targetIsLocal,
      key: KEY,
    };

    // act
    const declaredEnabled = resolveInstallDeclaredEnabled(options);

    // assert
    assert.strictEqual(declaredEnabled, row.expected);
  });
}
