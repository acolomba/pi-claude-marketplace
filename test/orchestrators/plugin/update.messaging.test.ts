import assert from "node:assert/strict";
import test from "node:test";

import {
  UPDATE_CONTEXT,
  type UpdateMsg,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts";
import { composePluginLines } from "../../../extensions/pi-claude-marketplace/shared/notification-grammar.ts";

import type { ResolvedRow } from "../../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";

void ({
  status: "updated",
  name: "alpha",
  from: "1.0.0",
  to: "2.0.0",
  dependencies: [],
  severity: "info",
  needsReload: true,
} satisfies UpdateMsg);
void ({
  status: "updated",
  name: "alpha",
  from: "1.0.0",
  to: "2.0.0",
  severity: "info",
  needsReload: true,
  // @ts-expect-error updated messages require a dependency inventory
} satisfies UpdateMsg);
void ({
  status: "skipped",
  name: "alpha",
  reasons: ["up-to-date"],
} satisfies UpdateMsg);
// UPDT-02: a held update's cause line is the first `skipped` row to carry
// `cause` -- the constraint gate's remedy, naming the constraining plugins.
void ({
  status: "skipped",
  name: "alpha",
  reasons: ["dependents constrain"],
  cause: new Error('required by "beta@mp"'),
} satisfies UpdateMsg);
void ({
  status: "partially-upgradable",
  name: "alpha",
  reasons: ["lsp"],
  // @ts-expect-error partially-upgradable messages cannot declare soft dependencies
  dependencies: ["mcp"],
} satisfies UpdateMsg);

test("exports the complete update command context in declared order", () => {
  // arrange
  const expectedContext = {
    keys: ["Messaging", "rowPolicies"],
    label: "Plugin update",
    renderKeys: [
      "updated",
      "partially-installed",
      "skipped",
      "partially-upgradable",
      "failed",
      "installed",
    ],
  };

  // act
  const context = {
    keys: Object.keys(UPDATE_CONTEXT),
    label: UPDATE_CONTEXT.Messaging.label,
    renderKeys: Object.keys(UPDATE_CONTEXT.rowPolicies),
  };

  // assert
  assert.deepStrictEqual(context, expectedContext);
});

test("renders a bare updated transition with true optional omission", () => {
  // arrange
  const message = {
    status: "updated",
    name: "alpha",
    from: "1.0.0",
    to: "1.1.0",
    reasons: [],
    severity: "info",
    needsReload: true,
  } as const satisfies ResolvedRow<UpdateMsg>;

  // act
  const row = composePluginLines(message, "user")[0]!.slice(2);

  // assert
  assert.equal(row, "● alpha v1.0.0 → v1.1.0 (updated)");
  assert.deepStrictEqual(message, {
    status: "updated",
    name: "alpha",
    from: "1.0.0",
    to: "1.1.0",
    reasons: [],
    severity: "info",
    needsReload: true,
  });
  assert.equal(Object.hasOwn(message, "scope"), false);
});

test("renders updated content reasons before the resolved markers", () => {
  // arrange
  const message = {
    status: "updated",
    name: "beta",
    from: "hash-2ea95f85703d",
    to: "hash-1c3d9a0bbef1",
    scope: "project",
    reasons: [
      "orphan rewake",
      "malformed skill",
      "requires pi-subagents",
      "requires pi-mcp-adapter",
    ],
    severity: "warning",
    needsReload: true,
  } as const satisfies ResolvedRow<UpdateMsg>;

  // act
  const row = composePluginLines(message, "user")[0]!.slice(2);

  // assert
  assert.equal(
    row,
    "● beta [project] v#2ea95f8 → v#1c3d9a0 (updated) {orphan rewake, malformed skill, requires pi-subagents, requires pi-mcp-adapter}",
  );
  assert.deepStrictEqual(message, {
    status: "updated",
    name: "beta",
    from: "hash-2ea95f85703d",
    to: "hash-1c3d9a0bbef1",
    scope: "project",
    reasons: [
      "orphan rewake",
      "malformed skill",
      "requires pi-subagents",
      "requires pi-mcp-adapter",
    ],
    severity: "warning",
    needsReload: true,
  });
});

test("renders a partially-installed transition with ordered resolved reasons", () => {
  // arrange
  const message = {
    status: "partially-installed",
    name: "gamma",
    reasons: ["malformed command", "unsupported component", "requires pi-mcp-adapter"],
    version: "2.0.0",
    scope: "project",
    severity: "warning",
    needsReload: true,
  } as const satisfies ResolvedRow<UpdateMsg>;

  // act
  const row = composePluginLines(message, "user")[0]!.slice(2);

  // assert
  assert.equal(
    row,
    "◉ gamma [project] v2.0.0 (partially-installed) {malformed command, unsupported component, requires pi-mcp-adapter}",
  );
  assert.deepStrictEqual(message, {
    status: "partially-installed",
    name: "gamma",
    reasons: ["malformed command", "unsupported component", "requires pi-mcp-adapter"],
    version: "2.0.0",
    scope: "project",
    severity: "warning",
    needsReload: true,
  });
});

test("renders an actionable skipped row with a folded marketplace scope", () => {
  // arrange
  const message = {
    status: "skipped",
    name: "delta",
    reasons: ["not installed", "concurrently uninstalled"],
    version: "3.0.0",
    scope: "user",
    severity: "error",
    needsReload: false,
  } as const satisfies ResolvedRow<UpdateMsg>;

  // act
  const row = composePluginLines(message, "user")[0]!.slice(2);

  // assert
  assert.equal(row, "⊘ delta v3.0.0 (skipped) {not installed, concurrently uninstalled}");
  assert.deepStrictEqual(message, {
    status: "skipped",
    name: "delta",
    reasons: ["not installed", "concurrently uninstalled"],
    version: "3.0.0",
    scope: "user",
    severity: "error",
    needsReload: false,
  });
  assert.equal(Object.hasOwn(message, "failure"), false);
});

test("preserves the partial-update hint while rendering its row body", () => {
  // arrange
  const message = {
    status: "partially-upgradable",
    name: "epsilon",
    reasons: ["unsupported hooks", "lsp"],
    version: "4.0.0",
    scope: "project",
    hint: "partial-update",
    severity: "info",
    needsReload: false,
  } as const satisfies ResolvedRow<UpdateMsg>;

  // act
  const row = composePluginLines(message, "user")[0]!.slice(2);

  // assert
  assert.equal(row, "● epsilon [project] v4.0.0 (partially-upgradable) {unsupported hooks, lsp}");
  assert.deepStrictEqual(message, {
    status: "partially-upgradable",
    name: "epsilon",
    reasons: ["unsupported hooks", "lsp"],
    version: "4.0.0",
    scope: "project",
    hint: "partial-update",
    severity: "info",
    needsReload: false,
  });
});

test("preserves failure detail while rendering the owned row body", () => {
  // arrange
  const failure = {
    cause: { causeChain: ["update failed"], truncated: false },
    leaks: [],
    rollbackPartial: [
      {
        phase: "phase3a",
        cause: { causeChain: ["remove staged agent failed"], truncated: false },
      },
      { phase: "phase3b" },
    ],
  };
  const message = {
    status: "failed",
    name: "zeta",
    reasons: ["rollback partial"],
    version: "5.0.0",
    scope: "project",
    failure,
    severity: "error",
    needsReload: false,
  } as const satisfies ResolvedRow<UpdateMsg>;

  // act
  const row = composePluginLines(message, "user")[0]!.slice(2);

  // assert
  assert.equal(row, "⊘ zeta [project] v5.0.0 (failed) {rollback partial}");
  assert.deepStrictEqual(message, {
    status: "failed",
    name: "zeta",
    reasons: ["rollback partial"],
    version: "5.0.0",
    scope: "project",
    failure,
    severity: "error",
    needsReload: false,
  });
});

test("UPDATE_CONTEXT declares complete row policies", () => {
  // act
  const policies = UPDATE_CONTEXT.rowPolicies;

  // assert
  assert.deepStrictEqual(policies, {
    updated: { markers: true, contentReasons: true },
    "partially-installed": { markers: true, contentReasons: true },
    skipped: { markers: false, contentReasons: true },
    "partially-upgradable": { markers: false, contentReasons: true },
    failed: { markers: false, contentReasons: true },
    installed: { markers: true, contentReasons: true },
  });
});
