import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import test from "node:test";

import {
  UPDATE_CONTEXT,
  outcomeToCascadePluginMessage,
  type UpdateRowMsg,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts";
import { preparePluginUpdate } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts";
import { composePluginLines } from "../../../extensions/pi-claude-marketplace/shared/notification-grammar.ts";
import { seedUnconstrainedTarget } from "../plugin/seed-unconstrained-target.ts";

import type { MaterializationPolicy } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts";
import type { PluginUpdateOutcome } from "../../../extensions/pi-claude-marketplace/orchestrators/types.ts";
import type { ResolvedRow } from "../../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";

/** `update`'s knobs on the shared runner (D-18-04). */
const UPDATE_POLICY = {
  refreshSource: true,
  skipSameRevision: true,
  overwrite: false,
  searchReleaseTags: true,
} satisfies MaterializationPolicy;

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
    keys: ["Messaging", "rowPolicies"],
    label: "Marketplace update",
    renderKeys: ["updated", "partially-installed", "skipped", "failed"],
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

test("renders an updated row with its ordered resolved reasons", () => {
  // arrange
  const message = {
    status: "updated",
    name: "alpha",
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
  } as const satisfies ResolvedRow<UpdateRowMsg>;

  // act
  const row = composePluginLines(message, "user")[0]!.slice(2);

  // assert
  assert.equal(
    row,
    "● alpha [project] v#2ea95f8 → v#1c3d9a0 (updated) {orphan rewake, malformed skill, requires pi-subagents, requires pi-mcp-adapter}",
  );
  assert.deepStrictEqual(message, {
    status: "updated",
    name: "alpha",
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

test("renders a partially-installed row with a folded scope and its resolved marker", () => {
  // arrange
  const message = {
    status: "partially-installed",
    name: "beta",
    reasons: ["malformed command", "lsp", "requires pi-mcp-adapter"],
    version: "2.0.0",
    scope: "user",
    severity: "warning",
    needsReload: true,
  } as const satisfies ResolvedRow<UpdateRowMsg>;

  // act
  const row = composePluginLines(message, "user")[0]!.slice(2);

  // assert
  assert.equal(
    row,
    "◉ beta v2.0.0 (partially-installed) {malformed command, lsp, requires pi-mcp-adapter}",
  );
  assert.deepStrictEqual(message, {
    status: "partially-installed",
    name: "beta",
    reasons: ["malformed command", "lsp", "requires pi-mcp-adapter"],
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
  } as const satisfies ResolvedRow<UpdateRowMsg>;

  // act
  const row = composePluginLines(message, "user")[0]!.slice(2);

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
  assert.equal(Object.hasOwn(message, "failure"), false);
});

test("renders a failed row while preserving its failure detail", () => {
  // arrange
  const failure = {
    cause: { causeChain: ["update failed"], truncated: false },
    leaks: [],
    rollbackPartial: [
      {
        phase: "agents",
        cause: { causeChain: ["remove staged agent failed"], truncated: false },
      },
      { phase: "hooks" },
    ],
  };
  const message = {
    status: "failed",
    name: "delta",
    reasons: ["rollback partial"],
    version: "4.0.0",
    scope: "project",
    failure,
    severity: "error",
    needsReload: false,
  } as const satisfies ResolvedRow<UpdateRowMsg>;

  // act
  const row = composePluginLines(message, "user")[0]!.slice(2);

  // assert
  assert.equal(row, "⊘ delta [project] v4.0.0 (failed) {rollback partial}");
  assert.deepStrictEqual(message, {
    status: "failed",
    name: "delta",
    reasons: ["rollback partial"],
    version: "4.0.0",
    scope: "project",
    failure,
    severity: "error",
    needsReload: false,
  });
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
    constraint: undefined,
    declaresWorkflows: false,
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

test("UPR-02: an autoupdated plugin at the same version names the moved commits", () => {
  // arrange
  const fromCommit = "a".repeat(40);
  const toCommit = "b".repeat(40);
  const outcome = {
    partition: "updated",
    name: "ghp",
    fromVersion: "1.0.0",
    toVersion: "1.0.0",
    fromCommit,
    toCommit,
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    declaresAgents: false,
    declaresMcp: false,
    constraint: undefined,
    declaresWorkflows: false,
  } satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "user");

  // assert
  assert.deepStrictEqual(message, {
    status: "updated",
    name: "ghp",
    scope: "user",
    from: "1.0.0",
    to: "1.0.0",
    commits: { from: fromCommit, to: toCommit },
    dependencies: [],
    severity: "info",
    needsReload: true,
  });
});

test("NREG-01: an autoupdated plugin whose version moved names no commits", () => {
  // arrange
  const outcome = {
    partition: "updated",
    name: "ghp",
    fromVersion: "1.0.0",
    toVersion: "1.1.0",
    fromCommit: "a".repeat(40),
    toCommit: "b".repeat(40),
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    declaresAgents: false,
    declaresMcp: false,
    constraint: undefined,
    declaresWorkflows: false,
  } satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "user");

  // assert
  assert.deepStrictEqual(message, {
    status: "updated",
    name: "ghp",
    scope: "user",
    from: "1.0.0",
    to: "1.1.0",
    dependencies: [],
    severity: "info",
    needsReload: true,
  });
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
    declaresWorkflows: false,
    orphanRewake: true,
    degradedKinds: ["command", "skill", "command"],
    constraint: undefined,
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
    declaresWorkflows: false,
    partialDegrade: { kinds: [], newlyDegraded: true },
    constraint: undefined,
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
    declaresWorkflows: false,
    partialDegrade: { kinds: ["lspServers"], newlyDegraded: true },
    constraint: undefined,
  } satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "user");

  // assert
  assert.deepStrictEqual(message, {
    status: "partially-installed",
    name: "iota",
    scope: "user",
    from: "4.0.0",
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
    declaresWorkflows: false,
    partialDegrade: { kinds: ["hooks"], newlyDegraded: false },
    constraint: undefined,
  } satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "project");

  // assert
  assert.deepStrictEqual(message, {
    status: "partially-installed",
    name: "kappa",
    scope: "project",
    from: "5.0.0",
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
    declaresWorkflows: false,
    orphanRewake: true,
    degradedKinds: ["command", "skill", "command"],
    partialDegrade: {
      kinds: ["hooks", "lspServers", "commands", "hooks"],
      newlyDegraded: false,
    },
    constraint: undefined,
  } as const satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "project");

  // assert
  assert.deepStrictEqual(message, {
    status: "partially-installed",
    name: "lambda",
    scope: "project",
    from: "6.0.0",
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
    constraint: undefined,
    declaresWorkflows: false,
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
  assert.equal(Object.hasOwn(message, "cause"), false);
});

test("D-10-13: an unchanged outcome with a constraint discloses its range and holders", () => {
  // arrange
  const outcome = {
    declaresWorkflows: false,
    partition: "unchanged",
    name: "shared-lib",
    fromVersion: "1.5.0",
    toVersion: "1.5.0",
    declaresAgents: false,
    declaresMcp: false,
    constraint: {
      disclosure:
        'already the highest version the combined range admits (<=1.5.0) -- required by "alpha@mp"',
      fellBackToCurrentCopy: false,
    },
  } satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "user");

  // assert
  assert.deepStrictEqual(message, {
    status: "skipped",
    name: "shared-lib",
    scope: "user",
    reasons: ["up-to-date"],
    severity: "info",
    needsReload: false,
    cause: new Error(
      'already the highest version the combined range admits (<=1.5.0) -- required by "alpha@mp"',
    ),
  });
});

test("D-10-13: an updated outcome with a constraint discloses its range on the autoupdate row", () => {
  // arrange
  const outcome = {
    declaresWorkflows: false,
    partition: "updated",
    name: "lib",
    fromVersion: "1.0.0",
    toVersion: "1.1.0",
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    declaresAgents: false,
    declaresMcp: false,
    constraint: {
      disclosure: 'constrained to the combined range (^1.0.0) -- required by "app@tools"',
      fellBackToCurrentCopy: false,
    },
  } satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "user");

  // assert
  assert.deepStrictEqual(message, {
    status: "updated",
    name: "lib",
    scope: "user",
    from: "1.0.0",
    to: "1.1.0",
    dependencies: [],
    cause: new Error('constrained to the combined range (^1.0.0) -- required by "app@tools"'),
    severity: "info",
    needsReload: true,
  });
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
    declaresWorkflows: false,
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
    declaresWorkflows: false,
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

test("D-10-12: the held row is warning on the autoupdate cascade", () => {
  // arrange -- the SAME held outcome `update-cascade.test.ts`'s manual-
  // cascade case drives, so both surfaces are proven against one literal.
  const outcome = {
    declaresWorkflows: false,
    partition: "skipped",
    name: "shared-lib",
    fromVersion: "1.0.0",
    notes: ['the declared ranges admit no version in common -- required by "alpha@mp"'],
    reasons: ["dependents constrain"],
    declaresAgents: false,
    declaresMcp: false,
  } as const satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "user");

  // assert
  assert.deepStrictEqual(message, {
    status: "skipped",
    name: "shared-lib",
    scope: "user",
    reasons: ["dependents constrain"],
    severity: "warning",
    needsReload: false,
    cause: new Error('the declared ranges admit no version in common -- required by "alpha@mp"'),
  });
});

test("SC3: an unconstrained plugin renders the same autoupdate cascade rows as before", async (t) => {
  // arrange: the REAL preflight over a real on-disk marketplace, with a
  // second installed plugin ("beta") declaring something else entirely --
  // the gate itself, not a stub, decides "alpha" is unconstrained, and
  // `constraintFromVerdict` -- the production step that turns that verdict
  // into the outcome's disclosure slot -- is what fills `constraint` below.
  const seed = await seedUnconstrainedTarget("sc3-update-messaging-");
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));
  const prepared = await preparePluginUpdate({
    policy: UPDATE_POLICY,
    plugin: "alpha",
    marketplace: "mp",
    scope: "project",
    locations: seed.locations,
    cleanupClones: async () => {},
  });
  assert.ok(!("partition" in prepared));
  assert.strictEqual(prepared.constraint, undefined);
  const outcome = {
    declaresWorkflows: false,
    partition: "updated",
    name: "alpha",
    fromVersion: prepared.fromVersion,
    toVersion: prepared.toVersion,
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    declaresAgents: false,
    declaresMcp: false,
    constraint: prepared.constraint,
  } satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "project");

  // assert: the gate ran, found no holder, the preflight projected no
  // disclosure, and the projected row is byte-identical to the
  // pre-constraint-gate projection (NREG-01).
  assert.deepStrictEqual(message, {
    status: "updated",
    name: "alpha",
    scope: "project",
    from: "1.0.0",
    to: "1.1.0",
    dependencies: [],
    severity: "info",
    needsReload: true,
  });
  assert.equal(Object.hasOwn(message, "reasons"), false);
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
    declaresWorkflows: false,
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
    declaresWorkflows: false,
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
    declaresWorkflows: false,
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
    declaresWorkflows: false,
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
    declaresWorkflows: false,
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
    declaresWorkflows: false,
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
    declaresWorkflows: false,
  } as const satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "user");

  // assert
  assert.deepStrictEqual(message, {
    status: "failed",
    name: "phi",
    scope: "user",
    version: "9.1.0",
    from: "9.0.0",
    reasons: ["permission denied"],
    cause,
    severity: "error",
    needsReload: false,
  });
});

test("UPR-03: a failed autoupdate that knows only the installed version shows it alone", () => {
  // arrange
  const outcome = {
    partition: "failed",
    name: "phi",
    fromVersion: "9.0.0",
    notes: [],
    reasons: ["lock held"],
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
  } as const satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "user");

  // assert
  assert.deepStrictEqual(message, {
    status: "failed",
    name: "phi",
    scope: "user",
    version: "9.0.0",
    reasons: ["lock held"],
    severity: "error",
    needsReload: false,
  });
});

test("UPR-02 / UPR-03: a failed same-version autoupdate names the commits it attempted", () => {
  // arrange
  const fromCommit = "a".repeat(40);
  const toCommit = "b".repeat(40);
  const outcome = {
    partition: "failed",
    name: "phi",
    fromVersion: "9.0.0",
    toVersion: "9.0.0",
    fromCommit,
    toCommit,
    notes: [],
    reasons: ["lock held"],
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
  } as const satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "user");

  // assert
  assert.deepStrictEqual(message, {
    status: "failed",
    name: "phi",
    scope: "user",
    version: "9.0.0",
    from: "9.0.0",
    commits: { from: fromCommit, to: toCommit },
    reasons: ["lock held"],
    severity: "error",
    needsReload: false,
  });
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
    declaresWorkflows: false,
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

test("SRC-01: renders an empty typed reason set with its cause and no reason token", () => {
  // arrange
  const cause = new Error("mirror gone");
  const outcome = {
    partition: "failed",
    name: "upsilon",
    fromVersion: "1.0.0",
    notes: ["mirror gone"],
    reasons: [],
    cause,
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
  } satisfies PluginUpdateOutcome;

  // act
  const message = outcomeToCascadePluginMessage(outcome, "user");

  // assert
  assert.deepStrictEqual(message, {
    status: "failed",
    name: "upsilon",
    scope: "user",
    version: "1.0.0",
    reasons: [],
    cause,
    severity: "error",
    needsReload: false,
  });
});

test("classifies an empty notes-only failure as an unreadable manifest", () => {
  // arrange
  const outcome = {
    partition: "failed",
    name: "psi",
    notes: [],
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
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
    declaresWorkflows: false,
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
    declaresWorkflows: false,
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
    declaresWorkflows: false,
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
    declaresWorkflows: false,
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
    declaresWorkflows: false,
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
    declaresWorkflows: false,
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
    declaresWorkflows: false,
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

test("UPDATE_CONTEXT declares complete row policies", () => {
  // act
  const policies = UPDATE_CONTEXT.rowPolicies;

  // assert
  assert.deepStrictEqual(policies, {
    updated: { markers: true, contentReasons: true },
    "partially-installed": { markers: true, contentReasons: true },
    skipped: { markers: false, contentReasons: true },
    failed: { markers: false, contentReasons: true },
  });
});
