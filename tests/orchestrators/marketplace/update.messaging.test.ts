import assert from "node:assert/strict";
import test from "node:test";

import {
  UPDATE_CONTEXT,
  outcomeToCascadePluginMessage,
  type UpdateRowMsg,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts";

import type { PluginUpdateOutcome } from "../../../extensions/pi-claude-marketplace/orchestrators/types.ts";
import type { SoftDepStatus } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

void ({
  status: "updated",
  name: "alpha",
  from: "1.0.0",
  to: "2.0.0",
  dependencies: [],
  severity: "info",
  needsReload: true,
} satisfies UpdateRowMsg);
void ({
  status: "updated",
  name: "alpha",
  from: "1.0.0",
  to: "2.0.0",
  severity: "info",
  needsReload: true,
  // @ts-expect-error updated rows require a dependency inventory
} satisfies UpdateRowMsg);
void ({
  status: "skipped",
  name: "alpha",
  reasons: ["up-to-date"],
  // @ts-expect-error skipped rows cannot declare soft dependencies
  dependencies: ["agents"],
} satisfies UpdateRowMsg);

test("exports the complete marketplace update context in declared order", () => {
  // arrange
  const expectedContext = {
    keys: ["Messaging", "render"],
    label: "Marketplace update",
    renderKeys: ["updated", "partially-installed", "skipped", "failed"],
  };

  // act
  const context = {
    keys: Object.keys(UPDATE_CONTEXT),
    label: UPDATE_CONTEXT.Messaging.label,
    renderKeys: Object.keys(UPDATE_CONTEXT.render),
  };

  // assert
  assert.deepStrictEqual(context, expectedContext);
});

test("renders an updated row with ordered reasons and both missing companions", () => {
  // arrange
  const message = {
    status: "updated",
    name: "alpha",
    from: "hash-2ea95f85703d",
    to: "hash-1c3d9a0bbef1",
    dependencies: ["agents", "mcp"],
    scope: "project",
    reasons: ["orphan rewake", "malformed skill"],
    severity: "warning",
    needsReload: true,
  } as const satisfies UpdateRowMsg;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
  };

  // act
  const row = UPDATE_CONTEXT.render.updated(message, probe, "user");

  // assert
  assert.equal(
    row,
    "● alpha [project] v#2ea95f8 → v#1c3d9a0 (updated) {orphan rewake, malformed skill, requires pi-subagents, requires pi-mcp}",
  );
  assert.deepStrictEqual(message, {
    status: "updated",
    name: "alpha",
    from: "hash-2ea95f85703d",
    to: "hash-1c3d9a0bbef1",
    dependencies: ["agents", "mcp"],
    scope: "project",
    reasons: ["orphan rewake", "malformed skill"],
    severity: "warning",
    needsReload: true,
  });
});

test("renders a partially-installed row with a folded scope and MCP marker", () => {
  // arrange
  const message = {
    status: "partially-installed",
    name: "beta",
    reasons: ["malformed command", "lsp"],
    dependencies: ["mcp"],
    version: "2.0.0",
    scope: "user",
    severity: "warning",
    needsReload: true,
  } as const satisfies UpdateRowMsg;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: true,
    piMcpAdapterLoaded: false,
  };

  // act
  const row = UPDATE_CONTEXT.render["partially-installed"](message, probe, "user");

  // assert
  assert.equal(
    row,
    "◉ beta v2.0.0 (partially-installed) {malformed command, lsp, requires pi-mcp}",
  );
  assert.deepStrictEqual(message, {
    status: "partially-installed",
    name: "beta",
    reasons: ["malformed command", "lsp"],
    dependencies: ["mcp"],
    version: "2.0.0",
    scope: "user",
    severity: "warning",
    needsReload: true,
  });
});

test("renders a skipped row without failure-only metadata", () => {
  // arrange
  const message = {
    status: "skipped",
    name: "gamma",
    reasons: ["not installed", "concurrently uninstalled"],
    version: "3.0.0",
    scope: "project",
    severity: "warning",
    needsReload: false,
  } as const satisfies UpdateRowMsg;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
  };

  // act
  const row = UPDATE_CONTEXT.render.skipped(message, probe, "user");

  // assert
  assert.equal(row, "⊘ gamma [project] v3.0.0 (skipped) {not installed, concurrently uninstalled}");
  assert.deepStrictEqual(message, {
    status: "skipped",
    name: "gamma",
    reasons: ["not installed", "concurrently uninstalled"],
    version: "3.0.0",
    scope: "project",
    severity: "warning",
    needsReload: false,
  });
  assert.equal(Object.hasOwn(message, "cause"), false);
});

test("renders a failed row while preserving cause and rollback metadata", () => {
  // arrange
  const cause = new Error("update failed");
  const rollbackCause = new Error("remove staged agent failed");
  const message = {
    status: "failed",
    name: "delta",
    reasons: ["rollback partial"],
    version: "4.0.0",
    scope: "project",
    cause,
    rollbackPartial: [{ phase: "agents", cause: rollbackCause }, { phase: "hooks" }],
    severity: "error",
    needsReload: false,
  } as const satisfies UpdateRowMsg;
  const probe: SoftDepStatus = {
    piSubagentsLoaded: true,
    piMcpAdapterLoaded: true,
  };

  // act
  const row = UPDATE_CONTEXT.render.failed(message, probe, "user");

  // assert
  assert.equal(row, "⊘ delta [project] v4.0.0 (failed) {rollback partial}");
  assert.deepStrictEqual(message, {
    status: "failed",
    name: "delta",
    reasons: ["rollback partial"],
    version: "4.0.0",
    scope: "project",
    cause,
    rollbackPartial: [{ phase: "agents", cause: rollbackCause }, { phase: "hooks" }],
    severity: "error",
    needsReload: false,
  });
  assert.equal(Object.hasOwn(message.rollbackPartial[1], "cause"), false);
});

test("projects a clean updated outcome with dependency order and optional reason omission", () => {
  // arrange
  const outcome = {
    partition: "updated",
    name: "epsilon",
    fromVersion: "1.0.0",
    toVersion: "1.1.0",
    stagedAgentNames: ["reviewer"],
    stagedMcpServerNames: ["docs"],
    declaresAgents: true,
    declaresMcp: true,
  } satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "user");

  // assert
  assert.deepStrictEqual(message, {
    status: "updated",
    name: "epsilon",
    scope: "user",
    from: "1.0.0",
    to: "1.1.0",
    dependencies: ["agents", "mcp"],
    severity: "info",
    needsReload: true,
  });
  assert.equal(Object.hasOwn(message, "reasons"), false);
});

test("projects orphan rewake before canonical malformed reasons on an updated row", () => {
  // arrange
  const outcome = {
    partition: "updated",
    name: "eta",
    fromVersion: "2.0.0",
    toVersion: "2.1.0",
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    declaresAgents: false,
    declaresMcp: false,
    orphanRewake: true,
    degradedKinds: ["command", "skill", "command"],
  } as const satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "project");

  // assert
  assert.deepStrictEqual(message, {
    status: "updated",
    name: "eta",
    scope: "project",
    from: "2.0.0",
    to: "2.1.0",
    dependencies: [],
    reasons: ["orphan rewake", "malformed skill", "malformed command"],
    severity: "warning",
    needsReload: true,
  });
});

test("keeps an empty newly-degraded signal on the clean updated row", () => {
  // arrange
  const outcome = {
    partition: "updated",
    name: "theta",
    fromVersion: "3.0.0",
    toVersion: "3.1.0",
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    declaresAgents: false,
    declaresMcp: false,
    partialDegrade: { kinds: [], newlyDegraded: true },
  } satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "project");

  // assert
  assert.deepStrictEqual(message, {
    status: "updated",
    name: "theta",
    scope: "project",
    from: "3.0.0",
    to: "3.1.0",
    dependencies: [],
    severity: "info",
    needsReload: true,
  });
  assert.equal(Object.hasOwn(message, "reasons"), false);
});

test("projects a newly degraded partial update with warning severity", () => {
  // arrange
  const outcome = {
    partition: "updated",
    name: "iota",
    fromVersion: "4.0.0",
    toVersion: "4.1.0",
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    declaresAgents: false,
    declaresMcp: true,
    partialDegrade: { kinds: ["lspServers"], newlyDegraded: true },
  } satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "user");

  // assert
  assert.deepStrictEqual(message, {
    status: "partially-installed",
    name: "iota",
    scope: "user",
    version: "4.1.0",
    dependencies: ["mcp"],
    reasons: ["lsp"],
    severity: "warning",
    needsReload: true,
  });
});

test("projects an already degraded partial update with info severity", () => {
  // arrange
  const outcome = {
    partition: "updated",
    name: "kappa",
    fromVersion: "5.0.0",
    toVersion: "5.1.0",
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    declaresAgents: true,
    declaresMcp: false,
    partialDegrade: { kinds: ["hooks"], newlyDegraded: false },
  } satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "project");

  // assert
  assert.deepStrictEqual(message, {
    status: "partially-installed",
    name: "kappa",
    scope: "project",
    version: "5.1.0",
    dependencies: ["agents"],
    reasons: ["unsupported hooks"],
    severity: "info",
    needsReload: true,
  });
});

test("preserves orphan, malformed, and dropped reason order on a partial update", () => {
  // arrange
  const outcome = {
    partition: "updated",
    name: "lambda",
    fromVersion: "6.0.0",
    toVersion: "6.1.0",
    stagedAgentNames: ["reviewer"],
    stagedMcpServerNames: ["docs"],
    declaresAgents: true,
    declaresMcp: true,
    orphanRewake: true,
    degradedKinds: ["command", "skill", "command"],
    partialDegrade: {
      kinds: ["hooks", "lspServers", "commands", "hooks"],
      newlyDegraded: false,
    },
  } as const satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "project");

  // assert
  assert.deepStrictEqual(message, {
    status: "partially-installed",
    name: "lambda",
    scope: "project",
    version: "6.1.0",
    dependencies: ["agents", "mcp"],
    reasons: [
      "orphan rewake",
      "malformed skill",
      "malformed command",
      "unsupported hooks",
      "lsp",
      "unsupported component",
    ],
    severity: "warning",
    needsReload: true,
  });
});

test("projects an unchanged outcome as a complete benign skipped message", () => {
  // arrange
  const outcome = {
    partition: "unchanged",
    name: "mu",
    fromVersion: "7.0.0",
    toVersion: "7.0.0",
    declaresAgents: false,
    declaresMcp: false,
  } satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "user");

  // assert
  assert.deepStrictEqual(message, {
    status: "skipped",
    name: "mu",
    scope: "user",
    reasons: ["up-to-date"],
    severity: "info",
    needsReload: false,
  });
  assert.equal(Object.hasOwn(message, "version"), false);
});

test("prefers a typed benign skip reason over contradictory notes", () => {
  // arrange
  const outcome = {
    partition: "skipped",
    name: "nu",
    fromVersion: "8.0.0",
    notes: ["source mismatch"],
    reasons: ["up-to-date"],
    declaresAgents: false,
    declaresMcp: false,
  } as const satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "project");

  // assert
  assert.deepStrictEqual(message, {
    status: "skipped",
    name: "nu",
    scope: "project",
    reasons: ["up-to-date"],
    severity: "info",
    needsReload: false,
  });
  assert.equal(Object.hasOwn(message, "version"), false);
});

test("prefers a typed actionable skip reason over unclassified notes", () => {
  // arrange
  const outcome = {
    partition: "skipped",
    name: "xi",
    notes: ["unclassified"],
    reasons: ["not installed"],
    declaresAgents: false,
    declaresMcp: false,
  } as const satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "user");

  // assert
  assert.deepStrictEqual(message, {
    status: "skipped",
    name: "xi",
    scope: "user",
    reasons: ["not installed"],
    severity: "warning",
    needsReload: false,
  });
});

test("classifies an empty notes-only skip as an unreadable manifest", () => {
  // arrange
  const outcome = {
    partition: "skipped",
    name: "omicron",
    notes: [],
    reasons: [],
    declaresAgents: false,
    declaresMcp: false,
  } satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "project");

  // assert
  assert.deepStrictEqual(message, {
    status: "skipped",
    name: "omicron",
    scope: "project",
    reasons: ["unreadable manifest"],
    severity: "warning",
    needsReload: false,
  });
});

test("classifies an explicit not-in-manifest skip note", () => {
  // arrange
  const outcome = {
    partition: "skipped",
    name: "pi",
    notes: ["plugin not in manifest"],
    reasons: [],
    declaresAgents: false,
    declaresMcp: false,
  } satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "user");

  // assert
  assert.deepStrictEqual(message, {
    status: "skipped",
    name: "pi",
    scope: "user",
    reasons: ["not in manifest"],
    severity: "warning",
    needsReload: false,
  });
});

test("classifies a not-found-in-marketplace skip note", () => {
  // arrange
  const outcome = {
    partition: "skipped",
    name: "rho",
    notes: ["plugin was not found in marketplace"],
    reasons: [],
    declaresAgents: false,
    declaresMcp: false,
  } satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "project");

  // assert
  assert.deepStrictEqual(message, {
    status: "skipped",
    name: "rho",
    scope: "project",
    reasons: ["not in manifest"],
    severity: "warning",
    needsReload: false,
  });
});

test("classifies a source-mismatch skip note", () => {
  // arrange
  const outcome = {
    partition: "skipped",
    name: "sigma",
    notes: ["source mismatch after refresh"],
    reasons: [],
    declaresAgents: false,
    declaresMcp: false,
  } satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "project");

  // assert
  assert.deepStrictEqual(message, {
    status: "skipped",
    name: "sigma",
    scope: "project",
    reasons: ["source mismatch"],
    severity: "warning",
    needsReload: false,
  });
});

test("classifies a no-longer-installable skip note", () => {
  // arrange
  const outcome = {
    partition: "skipped",
    name: "tau",
    notes: ["plugin is no longer installable"],
    reasons: [],
    declaresAgents: false,
    declaresMcp: false,
  } satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "user");

  // assert
  assert.deepStrictEqual(message, {
    status: "skipped",
    name: "tau",
    scope: "user",
    reasons: ["no longer installable"],
    severity: "warning",
    needsReload: false,
  });
});

test("classifies an unknown skip note as an unreadable manifest", () => {
  // arrange
  const outcome = {
    partition: "skipped",
    name: "upsilon",
    notes: ["unclassified producer note"],
    reasons: [],
    declaresAgents: false,
    declaresMcp: false,
  } satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "project");

  // assert
  assert.deepStrictEqual(message, {
    status: "skipped",
    name: "upsilon",
    scope: "project",
    reasons: ["unreadable manifest"],
    severity: "warning",
    needsReload: false,
  });
});

test("prefers a typed failure reason and preserves its Error cause", () => {
  // arrange
  const cause = new Error("permission denied");
  const outcome = {
    partition: "failed",
    name: "phi",
    fromVersion: "9.0.0",
    toVersion: "9.1.0",
    notes: ["rollback partial"],
    reasons: ["permission denied"],
    cause,
    declaresAgents: false,
    declaresMcp: false,
  } as const satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "user");

  // assert
  assert.deepStrictEqual(message, {
    status: "failed",
    name: "phi",
    scope: "user",
    reasons: ["permission denied"],
    cause,
    severity: "error",
    needsReload: false,
  });
  assert.equal(Object.hasOwn(message, "version"), false);
  assert.equal(Object.hasOwn(message, "from"), false);
  assert.equal(Object.hasOwn(message, "to"), false);
});

test("prefers a typed rollback reason while truly omitting an absent cause", () => {
  // arrange
  const outcome = {
    partition: "failed",
    name: "chi",
    notes: ["invalid manifest"],
    reasons: ["rollback partial"],
    declaresAgents: false,
    declaresMcp: false,
  } as const satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "project");

  // assert
  assert.deepStrictEqual(message, {
    status: "failed",
    name: "chi",
    scope: "project",
    reasons: ["rollback partial"],
    severity: "error",
    needsReload: false,
  });
  assert.equal(Object.hasOwn(message, "cause"), false);
});

test("classifies an empty notes-only failure as an unreadable manifest", () => {
  // arrange
  const outcome = {
    partition: "failed",
    name: "psi",
    notes: [],
    reasons: [],
    declaresAgents: false,
    declaresMcp: false,
  } satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "user");

  // assert
  assert.deepStrictEqual(message, {
    status: "failed",
    name: "psi",
    scope: "user",
    reasons: ["unreadable manifest"],
    severity: "error",
    needsReload: false,
  });
});

test("classifies an explicit not-in-manifest failure note", () => {
  // arrange
  const outcome = {
    partition: "failed",
    name: "omega",
    notes: ["plugin not in manifest"],
    declaresAgents: false,
    declaresMcp: false,
  } satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "project");

  // assert
  assert.deepStrictEqual(message, {
    status: "failed",
    name: "omega",
    scope: "project",
    reasons: ["not in manifest"],
    severity: "error",
    needsReload: false,
  });
});

test("classifies a not-found-in-marketplace failure note", () => {
  // arrange
  const outcome = {
    partition: "failed",
    name: "alpha-failure",
    notes: ["plugin was not found in marketplace"],
    declaresAgents: false,
    declaresMcp: false,
  } satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "user");

  // assert
  assert.deepStrictEqual(message, {
    status: "failed",
    name: "alpha-failure",
    scope: "user",
    reasons: ["not in manifest"],
    severity: "error",
    needsReload: false,
  });
});

test("classifies a rollback-partial failure note", () => {
  // arrange
  const outcome = {
    partition: "failed",
    name: "beta-failure",
    notes: ["rollback partial: agents"],
    declaresAgents: false,
    declaresMcp: false,
  } satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "project");

  // assert
  assert.deepStrictEqual(message, {
    status: "failed",
    name: "beta-failure",
    scope: "project",
    reasons: ["rollback partial"],
    severity: "error",
    needsReload: false,
  });
});

test("classifies an invalid-manifest failure note", () => {
  // arrange
  const outcome = {
    partition: "failed",
    name: "gamma-failure",
    notes: ["invalid manifest after refresh"],
    declaresAgents: false,
    declaresMcp: false,
  } satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "user");

  // assert
  assert.deepStrictEqual(message, {
    status: "failed",
    name: "gamma-failure",
    scope: "user",
    reasons: ["invalid manifest"],
    severity: "error",
    needsReload: false,
  });
});

test("classifies an unparseable failure note as an invalid manifest", () => {
  // arrange
  const outcome = {
    partition: "failed",
    name: "delta-failure",
    notes: ["manifest is unparseable"],
    declaresAgents: false,
    declaresMcp: false,
  } satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "project");

  // assert
  assert.deepStrictEqual(message, {
    status: "failed",
    name: "delta-failure",
    scope: "project",
    reasons: ["invalid manifest"],
    severity: "error",
    needsReload: false,
  });
});

test("classifies an unreadable failure note as an unreadable manifest", () => {
  // arrange
  const outcome = {
    partition: "failed",
    name: "epsilon-failure",
    notes: ["manifest is unreadable"],
    declaresAgents: false,
    declaresMcp: false,
  } satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "user");

  // assert
  assert.deepStrictEqual(message, {
    status: "failed",
    name: "epsilon-failure",
    scope: "user",
    reasons: ["unreadable manifest"],
    severity: "error",
    needsReload: false,
  });
});

test("classifies an unknown failure note as an unreadable manifest", () => {
  // arrange
  const outcome = {
    partition: "failed",
    name: "zeta-failure",
    notes: ["unclassified producer note"],
    declaresAgents: false,
    declaresMcp: false,
  } satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "project");

  // assert
  assert.deepStrictEqual(message, {
    status: "failed",
    name: "zeta-failure",
    scope: "project",
    reasons: ["unreadable manifest"],
    severity: "error",
    needsReload: false,
  });
});
