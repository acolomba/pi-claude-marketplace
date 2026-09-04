import assert from "node:assert/strict";
import test from "node:test";

import { updatedRowFromOutcome } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts";

test("composes agent and MCP dependencies in declared display order", () => {
  // arrange
  const outcome = {
    declaresAgents: true,
    declaresMcp: true,
    fromVersion: "1.0.0",
    name: "alpha",
    partition: "updated" as const,
    stagedAgentNames: ["pi-claude-marketplace-alpha-review"],
    stagedMcpServerNames: ["alpha-server"],
    toVersion: "2.0.0",
  };
  const severity = { partiallyInstalled: "info" as const, updated: "info" as const };

  // act
  const result = updatedRowFromOutcome(outcome, "user", severity);

  // assert
  assert.deepStrictEqual(result, {
    dependencies: ["agents", "mcp"],
    from: "1.0.0",
    name: "alpha",
    needsReload: true,
    scope: "user",
    severity: "info",
    status: "updated",
    to: "2.0.0",
  });
});

test("composes agent-only dependencies without an MCP marker", () => {
  // arrange
  const outcome = {
    declaresAgents: true,
    declaresMcp: false,
    fromVersion: "2.0.0",
    name: "beta",
    partition: "updated" as const,
    stagedAgentNames: ["pi-claude-marketplace-beta-review"],
    stagedMcpServerNames: [],
    toVersion: "2.1.0",
  };
  const severity = { partiallyInstalled: "warning" as const, updated: "warning" as const };

  // act
  const result = updatedRowFromOutcome(outcome, "project", severity);

  // assert
  assert.deepStrictEqual(result, {
    dependencies: ["agents"],
    from: "2.0.0",
    name: "beta",
    needsReload: true,
    scope: "project",
    severity: "warning",
    status: "updated",
    to: "2.1.0",
  });
});

test("composes MCP-only dependencies without an agent marker", () => {
  // arrange
  const outcome = {
    declaresAgents: false,
    declaresMcp: true,
    fromVersion: "3.0.0",
    name: "gamma",
    partition: "updated" as const,
    stagedAgentNames: [],
    stagedMcpServerNames: ["gamma-server"],
    toVersion: "3.1.0",
  };
  const severity = { partiallyInstalled: "info" as const, updated: "info" as const };

  // act
  const result = updatedRowFromOutcome(outcome, "project", severity);

  // assert
  assert.deepStrictEqual(result, {
    dependencies: ["mcp"],
    from: "3.0.0",
    name: "gamma",
    needsReload: true,
    scope: "project",
    severity: "info",
    status: "updated",
    to: "3.1.0",
  });
});

test("composes no dependencies and truly omits clean optional reasons", () => {
  // arrange
  const outcome = {
    declaresAgents: false,
    declaresMcp: false,
    fromVersion: "4.0.0",
    name: "delta",
    partition: "updated" as const,
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    toVersion: "4.1.0",
  };
  const severity = { partiallyInstalled: "warning" as const, updated: "info" as const };

  // act
  const result = updatedRowFromOutcome(outcome, "user", severity);

  // assert
  assert.deepStrictEqual(result, {
    dependencies: [],
    from: "4.0.0",
    name: "delta",
    needsReload: true,
    scope: "user",
    severity: "info",
    status: "updated",
    to: "4.1.0",
  });
  assert.strictEqual(Object.hasOwn(result, "reasons"), false);
});

test("keeps an empty partial degradation on the updated row", () => {
  // arrange
  const outcome = {
    declaresAgents: false,
    declaresMcp: false,
    fromVersion: "5.0.0",
    name: "epsilon",
    partialDegrade: { kinds: [], newlyDegraded: true },
    partition: "updated" as const,
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    toVersion: "5.1.0",
  };
  const severity = { partiallyInstalled: "warning" as const, updated: "info" as const };

  // act
  const result = updatedRowFromOutcome(outcome, "user", severity);

  // assert
  assert.deepStrictEqual(result, {
    dependencies: [],
    from: "5.0.0",
    name: "epsilon",
    needsReload: true,
    scope: "user",
    severity: "info",
    status: "updated",
    to: "5.1.0",
  });
  assert.strictEqual(Object.hasOwn(result, "reasons"), false);
});

test("preserves orphan, malformed, and dropped reason order on a partial row", () => {
  // arrange
  const outcome = {
    declaresAgents: true,
    declaresMcp: true,
    degradedKinds: ["command", "skill", "command"] as const,
    fromVersion: "6.0.0",
    name: "zeta",
    orphanRewake: true,
    partialDegrade: {
      kinds: ["hooks", "lspServers", "commands", "hooks"],
      newlyDegraded: false,
    },
    partition: "updated" as const,
    stagedAgentNames: ["pi-claude-marketplace-zeta-review"],
    stagedMcpServerNames: ["zeta-server"],
    toVersion: "6.1.0",
  };
  const severity = { partiallyInstalled: "info" as const, updated: "info" as const };

  // act
  const result = updatedRowFromOutcome(outcome, "project", severity);

  // assert
  assert.deepStrictEqual(result, {
    dependencies: ["agents", "mcp"],
    name: "zeta",
    needsReload: true,
    reasons: [
      "orphan rewake",
      "malformed skill",
      "malformed command",
      "unsupported hooks",
      "lsp",
      "unsupported component",
    ],
    scope: "project",
    severity: "warning",
    status: "partially-installed",
    version: "6.1.0",
  });
});

test("raises a clean updated row only for malformed written content", () => {
  // arrange
  const outcome = {
    declaresAgents: false,
    declaresMcp: false,
    degradedKinds: ["command"] as const,
    fromVersion: "7.0.0",
    name: "eta",
    partition: "updated" as const,
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    toVersion: "7.1.0",
  };
  const severity = { partiallyInstalled: "info" as const, updated: "info" as const };

  // act
  const result = updatedRowFromOutcome(outcome, "user", severity);

  // assert
  assert.deepStrictEqual(result, {
    dependencies: [],
    from: "7.0.0",
    name: "eta",
    needsReload: true,
    reasons: ["malformed command"],
    scope: "user",
    severity: "warning",
    status: "updated",
    to: "7.1.0",
  });
});

test("retains base info severity for an already degraded partial update", () => {
  // arrange
  const outcome = {
    declaresAgents: false,
    declaresMcp: false,
    fromVersion: "8.0.0",
    name: "theta",
    partialDegrade: { kinds: ["hooks"], newlyDegraded: false },
    partition: "updated" as const,
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    toVersion: "8.1.0",
  };
  const severity = { partiallyInstalled: "info" as const, updated: "info" as const };

  // act
  const result = updatedRowFromOutcome(outcome, "project", severity);

  // assert
  assert.deepStrictEqual(result, {
    dependencies: [],
    name: "theta",
    needsReload: true,
    reasons: ["unsupported hooks"],
    scope: "project",
    severity: "info",
    status: "partially-installed",
    version: "8.1.0",
  });
});

test("retains base warning severity for a newly degraded partial update", () => {
  // arrange
  const outcome = {
    declaresAgents: false,
    declaresMcp: false,
    fromVersion: "9.0.0",
    name: "iota",
    partialDegrade: { kinds: ["lspServers"], newlyDegraded: true },
    partition: "updated" as const,
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    toVersion: "9.1.0",
  };
  const severity = { partiallyInstalled: "warning" as const, updated: "info" as const };

  // act
  const result = updatedRowFromOutcome(outcome, "user", severity);

  // assert
  assert.deepStrictEqual(result, {
    dependencies: [],
    name: "iota",
    needsReload: true,
    reasons: ["lsp"],
    scope: "user",
    severity: "warning",
    status: "partially-installed",
    version: "9.1.0",
  });
});

test("reports orphan rewake without overriding clean base severity", () => {
  // arrange
  const outcome = {
    declaresAgents: false,
    declaresMcp: false,
    fromVersion: "10.0.0",
    name: "kappa",
    orphanRewake: true,
    partition: "updated" as const,
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    toVersion: "10.1.0",
  };
  const severity = { partiallyInstalled: "info" as const, updated: "info" as const };

  // act
  const result = updatedRowFromOutcome(outcome, "project", severity);

  // assert
  assert.deepStrictEqual(result, {
    dependencies: [],
    from: "10.0.0",
    name: "kappa",
    needsReload: true,
    reasons: ["orphan rewake"],
    scope: "project",
    severity: "info",
    status: "updated",
    to: "10.1.0",
  });
});
