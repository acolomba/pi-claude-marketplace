import assert from "node:assert/strict";
import test from "node:test";

import type { ScopeConfig } from "../../../extensions/pi-claude-marketplace/persistence/config-io.ts";

interface ResolveInstallDeclaredEnabledOptions {
  readonly current: ScopeConfig;
  readonly sibling: ScopeConfig | undefined;
  readonly targetIsLocal: boolean;
  readonly key: string;
}

type ResolveInstallDeclaredEnabled = (
  options: ResolveInstallDeclaredEnabledOptions,
) => boolean | undefined;

async function loadResolveInstallDeclaredEnabled(): Promise<ResolveInstallDeclaredEnabled> {
  let resolveInstallDeclaredEnabled: ResolveInstallDeclaredEnabled | undefined;
  await assert.doesNotReject(async () => {
    const owner = await import(
      "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-declared-enabled.ts"
    );
    resolveInstallDeclaredEnabled = owner.resolveInstallDeclaredEnabled;
  }, "install-declared-enabled.ts must own tri-state config selection");
  assert.ok(resolveInstallDeclaredEnabled !== undefined);
  return resolveInstallDeclaredEnabled;
}

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
  test(row.title, async () => {
    // arrange
    const resolveInstallDeclaredEnabled = await loadResolveInstallDeclaredEnabled();

    // act
    const declaredEnabled = resolveInstallDeclaredEnabled({
      current: row.current,
      sibling: row.sibling,
      targetIsLocal: row.targetIsLocal,
      key: KEY,
    });

    // assert
    assert.strictEqual(declaredEnabled, row.expected);
  });
}
