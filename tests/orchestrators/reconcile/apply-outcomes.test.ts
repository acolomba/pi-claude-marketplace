import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { UninstallRefusedError } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts";
import {
  classifyOrchestratorThrow,
  classifyReadPassThrow,
  dependenciesFromInstall,
  dependencyDisabledOutcome,
  MigrateConfigSaveError,
  sourceMismatchOutcomeSubject,
  type InvalidBlockOutcome,
  type MpAddedOutcome,
  type MpAddFailedOutcome,
  type MpRemovedOutcome,
  type MpRemoveFailedOutcome,
  type MpRemovePartialOutcome,
  type OutcomeBase,
  type PerEntryOutcome,
  type PluginBackfilledOutcome,
  type PluginDependencyDisabledOutcome,
  type PluginDisabledOutcome,
  type PluginDisableFailedOutcome,
  type PluginEnabledOutcome,
  type PluginEnableFailedOutcome,
  type PluginInstalledOutcome,
  type PluginInstallFailedOutcome,
  type PluginOutcomeBase,
  type PluginUninstalledOutcome,
  type PluginUninstallFailedOutcome,
  type SourceMismatchOutcome,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts";
import {
  DependencyCascadeError,
  InvalidMarketplaceManifestError,
  PluginShapeError,
  StateLockHeldError,
} from "../../../extensions/pi-claude-marketplace/shared/errors.ts";

void ({ scope: "project", marketplace: "official" } satisfies OutcomeBase);
void ({ scope: "user", marketplace: "official", plugin: "formatter" } satisfies PluginOutcomeBase);
void ({ kind: "mp-added", scope: "project", marketplace: "official" } satisfies MpAddedOutcome);
void ({
  kind: "mp-add-failed",
  scope: "user",
  marketplace: "official",
  reason: "permission denied",
} satisfies MpAddFailedOutcome);
void ({ kind: "mp-removed", scope: "project", marketplace: "retired" } satisfies MpRemovedOutcome);
void ({
  kind: "mp-remove-failed",
  scope: "user",
  marketplace: "retired",
  reason: "plugins remain",
} satisfies MpRemoveFailedOutcome);
void ({
  kind: "mp-remove-partial",
  scope: "project",
  marketplace: "retired",
} satisfies MpRemovePartialOutcome);
void ({
  kind: "plugin-installed",
  scope: "project",
  marketplace: "official",
  plugin: "formatter",
  version: "1.2.3",
  dependencies: ["agents", "mcp"],
  orphanRewake: true,
  degradedKinds: ["skill", "command"],
  postCommitWarnings: ["cache refresh deferred"],
} satisfies PluginInstalledOutcome);
void ({
  kind: "plugin-backfilled",
  scope: "user",
  marketplace: "official",
  plugin: "formatter",
  version: "1.2.3",
  dependencies: ["mcp"],
  installable: false,
  unsupported: ["hooks", "lspServers"],
  orphanRewake: true,
  degradedKinds: ["command"],
} satisfies PluginBackfilledOutcome);
void ({
  kind: "plugin-install-failed",
  scope: "project",
  marketplace: "official",
  plugin: "formatter",
  reason: "not in manifest",
} satisfies PluginInstallFailedOutcome);
void ({
  kind: "plugin-install-failed",
  scope: "project",
  marketplace: "official",
  plugin: "formatter",
  reason: "dependency failed",
  cause: new DependencyCascadeError(
    'Dependency "linter@official" is not declared by its marketplace.',
    "linter@official",
  ),
} satisfies PluginInstallFailedOutcome);
void ({
  kind: "plugin-uninstalled",
  scope: "user",
  marketplace: "official",
  plugin: "formatter",
  version: "1.2.3",
} satisfies PluginUninstalledOutcome);
void ({
  kind: "plugin-uninstall-failed",
  scope: "project",
  marketplace: "official",
  plugin: "formatter",
  reason: "permission denied",
} satisfies PluginUninstallFailedOutcome);
void ({
  kind: "plugin-uninstall-failed",
  scope: "project",
  marketplace: "official",
  plugin: "formatter",
  reason: "unreadable",
  cause: new UninstallRefusedError(
    "unreadable",
    "cannot read the dependencies of linter@official: not declared by its marketplace",
  ),
} satisfies PluginUninstallFailedOutcome);
void ({
  kind: "plugin-enabled",
  scope: "user",
  marketplace: "official",
  plugin: "formatter",
  version: "1.2.3",
  unsupported: ["hooks"],
  orphanRewake: true,
  degradedKinds: ["skill"],
  stagedAgents: true,
  stagedMcpServers: true,
} satisfies PluginEnabledOutcome);
void ({
  kind: "plugin-enable-failed",
  scope: "project",
  marketplace: "official",
  plugin: "formatter",
  reason: "already installed",
} satisfies PluginEnableFailedOutcome);
void ({
  kind: "plugin-disabled",
  scope: "user",
  marketplace: "official",
  plugin: "formatter",
  version: "1.2.3",
  reasons: ["installs disabled", "orphan rewake"],
  enableHint: true,
  postCommitWarnings: ["data directory deferred"],
} satisfies PluginDisabledOutcome);
void ({
  kind: "plugin-dependency-disabled",
  scope: "project",
  marketplace: "official",
  plugin: "deploy-kit",
  version: "1.2.3",
  reasons: ["dependency unsatisfied"],
  cause: new Error('Install "secrets-vault@official" or uninstall "deploy-kit@official"'),
} satisfies PluginDependencyDisabledOutcome);
void ({
  kind: "plugin-dependency-disabled",
  scope: "user",
  marketplace: "official",
  plugin: "deploy-kit",
  reasons: ["dependency unsatisfied"],
  cause: new Error('Install "secrets-vault@official" or uninstall "deploy-kit@official"'),
} satisfies PluginDependencyDisabledOutcome);
void ({
  kind: "plugin-disable-failed",
  scope: "project",
  marketplace: "official",
  plugin: "formatter",
  reason: "lock held",
} satisfies PluginDisableFailedOutcome);
void ({
  kind: "source-mismatch",
  cause: "source-mismatch",
  scope: "project",
  marketplace: "official",
} satisfies SourceMismatchOutcome);
void ({
  kind: "source-mismatch",
  cause: "unknown-stored",
  scope: "user",
  marketplace: "legacy",
} satisfies SourceMismatchOutcome);
void ({
  kind: "source-mismatch",
  cause: "dangling-reference",
  scope: "project",
  marketplace: "missing",
  plugin: "formatter",
} satisfies SourceMismatchOutcome);
void ({
  kind: "source-mismatch",
  cause: "malformed-plugin-key",
  scope: "user",
  rawKey: "formatter",
} satisfies SourceMismatchOutcome);
void ({
  kind: "invalid-block",
  scope: "project",
  basename: "state.json",
  reason: "unparseable",
  cause: new Error("Unexpected token"),
} satisfies InvalidBlockOutcome);
void ({ kind: "mp-added", scope: "user", marketplace: "official" } satisfies PerEntryOutcome);

// @ts-expect-error outcome bases always identify their marketplace
void ({ scope: "project" } satisfies OutcomeBase);
// @ts-expect-error plugin outcome bases always identify their plugin
void ({ scope: "user", marketplace: "official" } satisfies PluginOutcomeBase);
void ({
  kind: "mp-added",
  scope: "project",
  marketplace: "official",
  // @ts-expect-error marketplace add success outcomes cannot carry a failure reason
  reason: "unreadable",
} satisfies MpAddedOutcome);
void ({
  kind: "mp-add-failed",
  scope: "user",
  marketplace: "official",
  // @ts-expect-error marketplace add failure outcomes require a reason
} satisfies MpAddFailedOutcome);
void ({
  kind: "mp-removed",
  scope: "project",
  marketplace: "retired",
  // @ts-expect-error marketplace remove success outcomes cannot carry a failure reason
  reason: "unreadable",
} satisfies MpRemovedOutcome);
void ({
  kind: "mp-remove-failed",
  scope: "user",
  marketplace: "retired",
  // @ts-expect-error marketplace remove failure outcomes require a reason
} satisfies MpRemoveFailedOutcome);
void ({
  kind: "mp-remove-partial",
  scope: "project",
  marketplace: "retired",
  // @ts-expect-error partial marketplace removals carry failure detail on plugin children
  reason: "plugins remain",
} satisfies MpRemovePartialOutcome);
void ({
  kind: "plugin-installed",
  scope: "project",
  marketplace: "official",
  plugin: "formatter",
  // @ts-expect-error installed plugin outcomes require an explicit dependency tuple
} satisfies PluginInstalledOutcome);
void ({
  kind: "plugin-installed",
  scope: "project",
  marketplace: "official",
  plugin: "formatter",
  version: undefined,
  dependencies: [],
  // @ts-expect-error exact optional properties reject an explicitly undefined version
} satisfies PluginInstalledOutcome);
void ({
  kind: "plugin-backfilled",
  scope: "user",
  marketplace: "official",
  plugin: "formatter",
  dependencies: [],
  unsupported: [],
  // @ts-expect-error backfilled outcomes require the re-resolved installability verdict
} satisfies PluginBackfilledOutcome);
void ({
  kind: "plugin-backfilled",
  scope: "user",
  marketplace: "official",
  plugin: "formatter",
  dependencies: [],
  installable: true,
  // @ts-expect-error backfilled outcomes require the re-resolved unsupported-kind list
} satisfies PluginBackfilledOutcome);
void ({
  kind: "plugin-install-failed",
  scope: "project",
  marketplace: "official",
  plugin: "formatter",
  // @ts-expect-error plugin install failure outcomes require a reason
} satisfies PluginInstallFailedOutcome);
void ({
  kind: "plugin-install-failed",
  scope: "project",
  marketplace: "official",
  plugin: "formatter",
  reason: "unreadable",
  // @ts-expect-error install failure causes are DependencyCascadeError, not a bare Error
  cause: new Error("boom"),
} satisfies PluginInstallFailedOutcome);
void ({
  kind: "plugin-uninstalled",
  scope: "user",
  marketplace: "official",
  plugin: "formatter",
  // @ts-expect-error uninstalled outcomes cannot carry a failure reason
  reason: "unreadable",
} satisfies PluginUninstalledOutcome);
void ({
  kind: "plugin-uninstall-failed",
  scope: "project",
  marketplace: "official",
  plugin: "formatter",
  // @ts-expect-error plugin uninstall failure outcomes require a reason
} satisfies PluginUninstallFailedOutcome);
void ({
  kind: "plugin-uninstall-failed",
  scope: "project",
  marketplace: "official",
  plugin: "formatter",
  reason: "unreadable",
  // @ts-expect-error uninstall failure causes are UninstallRefusedError, not a bare Error
  cause: new Error("boom"),
} satisfies PluginUninstallFailedOutcome);
void ({
  kind: "plugin-enabled",
  scope: "user",
  marketplace: "official",
  plugin: "formatter",
  // @ts-expect-error enabled outcomes derive dependencies from staged ledger signals
  dependencies: ["agents"],
} satisfies PluginEnabledOutcome);
void ({
  kind: "plugin-enable-failed",
  scope: "project",
  marketplace: "official",
  plugin: "formatter",
  // @ts-expect-error plugin enable failure outcomes require a reason
} satisfies PluginEnableFailedOutcome);
void ({
  kind: "plugin-disabled",
  scope: "user",
  marketplace: "official",
  plugin: "formatter",
  // @ts-expect-error the enable hint is a true-only presence marker
  enableHint: false,
} satisfies PluginDisabledOutcome);
void ({
  kind: "plugin-disabled",
  scope: "user",
  marketplace: "official",
  plugin: "formatter",
  // @ts-expect-error disabled plugin reasons exclude the structural marketplace-only reason
  reasons: ["marketplace not added"],
} satisfies PluginDisabledOutcome);
void ({
  kind: "plugin-dependency-disabled",
  scope: "user",
  marketplace: "official",
  plugin: "deploy-kit",
  reasons: ["dependency unsatisfied"],
  // @ts-expect-error a held-down plugin always carries the remedy its row renders
} satisfies PluginDependencyDisabledOutcome);
void ({
  kind: "plugin-dependency-disabled",
  scope: "user",
  marketplace: "official",
  plugin: "deploy-kit",
  cause: new Error("remedy"),
  // @ts-expect-error the row's brace is stamped by the producer, never the renderer
} satisfies PluginDependencyDisabledOutcome);
void ({
  kind: "plugin-disable-failed",
  scope: "project",
  marketplace: "official",
  plugin: "formatter",
  // @ts-expect-error plugin disable failure outcomes require a reason
} satisfies PluginDisableFailedOutcome);
void ({
  kind: "source-mismatch",
  cause: "dangling-reference",
  scope: "project",
  marketplace: "missing",
  // @ts-expect-error dangling references always identify the referenced plugin
} satisfies SourceMismatchOutcome);
void ({
  kind: "source-mismatch",
  cause: "malformed-plugin-key",
  scope: "user",
  // @ts-expect-error malformed plugin keys use rawKey instead of a marketplace field
  marketplace: "formatter",
} satisfies SourceMismatchOutcome);
void ({
  kind: "source-mismatch",
  // @ts-expect-error source mismatches use a closed cause vocabulary
  cause: "unreadable",
  scope: "project",
  marketplace: "official",
} satisfies SourceMismatchOutcome);
void ({
  kind: "invalid-block",
  scope: "project",
  basename: "state.json",
  // @ts-expect-error invalid blocks reject the structural marketplace-only reason
  reason: "marketplace not added",
} satisfies InvalidBlockOutcome);
void ({
  kind: "invalid-block",
  scope: "project",
  basename: "state.json",
  reason: "unparseable",
  // @ts-expect-error invalid block diagnostics are Error objects when present
  cause: "Unexpected token",
} satisfies InvalidBlockOutcome);
void ({
  // @ts-expect-error per-entry outcomes reject unknown discriminants
  kind: "plugin-updated",
  scope: "project",
  marketplace: "official",
  plugin: "formatter",
} satisfies PerEntryOutcome);

describe("sourceMismatchOutcomeSubject", () => {
  test("selects the marketplace for a dangling reference", () => {
    // arrange
    const outcome = {
      kind: "source-mismatch",
      cause: "dangling-reference",
      scope: "project",
      marketplace: "missing",
      plugin: "formatter",
    } satisfies SourceMismatchOutcome;

    // act
    const subject = sourceMismatchOutcomeSubject(outcome);

    // assert
    assert.strictEqual(subject, "missing");
  });

  test("selects the raw key for a malformed plugin key", () => {
    // arrange
    const outcome = {
      kind: "source-mismatch",
      cause: "malformed-plugin-key",
      scope: "user",
      rawKey: "formatter",
    } satisfies SourceMismatchOutcome;

    // act
    const subject = sourceMismatchOutcomeSubject(outcome);

    // assert
    assert.strictEqual(subject, "formatter");
  });

  test("selects the marketplace for a source mismatch", () => {
    // arrange
    const outcome = {
      kind: "source-mismatch",
      cause: "source-mismatch",
      scope: "project",
      marketplace: "official",
    } satisfies SourceMismatchOutcome;

    // act
    const subject = sourceMismatchOutcomeSubject(outcome);

    // assert
    assert.strictEqual(subject, "official");
  });

  test("selects the marketplace for an unknown stored source", () => {
    // arrange
    const outcome = {
      kind: "source-mismatch",
      cause: "unknown-stored",
      scope: "user",
      marketplace: "legacy",
    } satisfies SourceMismatchOutcome;

    // act
    const subject = sourceMismatchOutcomeSubject(outcome);

    // assert
    assert.strictEqual(subject, "legacy");
  });
});

describe("classifyOrchestratorThrow", () => {
  test("classifies a dependency-cascade failure", () => {
    // arrange
    const error = new DependencyCascadeError(
      'Dependency "linter@official" is not declared by its marketplace.',
      "linter@official",
    );

    // act
    const reason = classifyOrchestratorThrow(error);

    // assert
    assert.strictEqual(reason, "dependency failed");
  });

  test("classifies an already-installed plugin shape", () => {
    // arrange
    const error = new PluginShapeError({
      kind: "already-installed",
      plugin: "formatter",
      marketplace: "official",
    });

    // act
    const reason = classifyOrchestratorThrow(error);

    // assert
    assert.strictEqual(reason, "already installed");
  });

  test("classifies a no-longer-installable plugin shape", () => {
    // arrange
    const error = new PluginShapeError({
      kind: "no-longer-installable",
      plugin: "formatter",
      reasons: ["contains lspServers"],
      partialable: false,
    });

    // act
    const reason = classifyOrchestratorThrow(error);

    // assert
    assert.strictEqual(reason, "no longer installable");
  });

  test("classifies a not-installable plugin shape", () => {
    // arrange
    const error = new PluginShapeError({
      kind: "not-installable",
      plugin: "formatter",
      reasons: ["contains lspServers"],
      partialable: true,
    });

    // act
    const reason = classifyOrchestratorThrow(error);

    // assert
    assert.strictEqual(reason, "no longer installable");
  });

  test("classifies a plugin missing from its manifest", () => {
    // arrange
    const error = new PluginShapeError({
      kind: "not-in-manifest",
      plugin: "formatter",
      marketplace: "official",
    });

    // act
    const reason = classifyOrchestratorThrow(error);

    // assert
    assert.strictEqual(reason, "not in manifest");
  });

  test("classifies a held state lock", () => {
    // arrange
    const error = new StateLockHeldError("project", "/work/project/.state-lock");

    // act
    const reason = classifyOrchestratorThrow(error);

    // assert
    assert.strictEqual(reason, "lock held");
  });

  for (const { code, reason } of [
    { code: "EACCES", reason: "permission denied" },
    { code: "ENOENT", reason: "source missing" },
    { code: "ENOTDIR", reason: "source missing" },
    { code: "EPERM", reason: "permission denied" },
  ] as const) {
    test(`classifies ${code} through the probe fallback`, () => {
      // arrange
      const error = Object.assign(new Error(`${code} failure`), { code });

      // act
      const classifiedReason = classifyOrchestratorThrow(error);

      // assert
      assert.strictEqual(classifiedReason, reason);
    });
  }

  test("classifies malformed JSON through the probe fallback", () => {
    // arrange
    const error = new SyntaxError("Unexpected token");

    // act
    const reason = classifyOrchestratorThrow(error);

    // assert
    assert.strictEqual(reason, "unparseable");
  });

  test("classifies an invalid marketplace manifest through the probe fallback", () => {
    // arrange
    const error = new InvalidMarketplaceManifestError("marketplace schema invalid");

    // act
    const reason = classifyOrchestratorThrow(error);

    // assert
    assert.strictEqual(reason, "invalid manifest");
  });

  test("classifies an unknown Error through the probe fallback", () => {
    // arrange
    const error = new Error("probe failed");

    // act
    const reason = classifyOrchestratorThrow(error);

    // assert
    assert.strictEqual(reason, "unreadable");
  });

  test("classifies an unknown non-Error through the probe fallback", () => {
    // arrange
    const error = { failure: "probe failed" };

    // act
    const reason = classifyOrchestratorThrow(error);

    // assert
    assert.strictEqual(reason, "unreadable");
  });
});

describe("MigrateConfigSaveError", () => {
  test("preserves the failing config path and errno cause while naming only the basename", () => {
    // arrange
    const cause = Object.assign(new Error("permission denied"), { code: "EACCES" });
    const configFilePath = "/work/project/.pi/claude-plugins.json";

    // act
    const error = new MigrateConfigSaveError(configFilePath, cause);

    // assert
    assert.deepStrictEqual(
      {
        isError: error instanceof Error,
        isMigrateConfigSaveError: error instanceof MigrateConfigSaveError,
        name: error.name,
        message: error.message,
        configFilePath: error.configFilePath,
        cause: error.cause,
        causeCode: (error.cause as NodeJS.ErrnoException).code,
      },
      {
        isError: true,
        isMigrateConfigSaveError: true,
        name: "MigrateConfigSaveError",
        message: 'migrateFirstRunConfig saveConfig failed for "claude-plugins.json"',
        configFilePath: "/work/project/.pi/claude-plugins.json",
        cause,
        causeCode: "EACCES",
      },
    );
  });
});

describe("classifyReadPassThrow", () => {
  test("classifies an Error with a SyntaxError cause as unparseable", () => {
    // arrange
    const error = new Error("state load failed", { cause: new SyntaxError("Unexpected token") });

    // act
    const reason = classifyReadPassThrow(error);

    // assert
    assert.strictEqual(reason, "unparseable");
  });

  test("classifies a held state lock", () => {
    // arrange
    const error = new StateLockHeldError("user", "/home/user/.pi/.state-lock");

    // act
    const reason = classifyReadPassThrow(error);

    // assert
    assert.strictEqual(reason, "lock held");
  });

  for (const { code, reason } of [
    { code: "EACCES", reason: "permission denied" },
    { code: "ENOENT", reason: "source missing" },
    { code: "ENOTDIR", reason: "source missing" },
    { code: "EPERM", reason: "permission denied" },
  ] as const) {
    test(`classifies ${code} through the probe fallback`, () => {
      // arrange
      const error = Object.assign(new Error(`${code} failure`), { code });

      // act
      const classifiedReason = classifyReadPassThrow(error);

      // assert
      assert.strictEqual(classifiedReason, reason);
    });
  }

  test("classifies an invalid marketplace manifest through the probe fallback", () => {
    // arrange
    const error = new InvalidMarketplaceManifestError("marketplace schema invalid");

    // act
    const reason = classifyReadPassThrow(error);

    // assert
    assert.strictEqual(reason, "invalid manifest");
  });

  test("classifies a SyntaxError through the probe fallback", () => {
    // arrange
    const error = new SyntaxError("Unexpected token");

    // act
    const reason = classifyReadPassThrow(error);

    // assert
    assert.strictEqual(reason, "unparseable");
  });

  test("classifies an unknown Error through the probe fallback", () => {
    // arrange
    const error = new Error("state read failed");

    // act
    const reason = classifyReadPassThrow(error);

    // assert
    assert.strictEqual(reason, "unreadable");
  });

  test("classifies an unknown non-Error through the probe fallback", () => {
    // arrange
    const error = "state read failed";

    // act
    const reason = classifyReadPassThrow(error);

    // assert
    assert.strictEqual(reason, "unreadable");
  });
});

describe("dependenciesFromInstall", () => {
  test("returns no dependencies when neither dependency is declared", () => {
    // arrange
    const outcome = { declaresAgents: false, declaresMcp: false };

    // act
    const dependencies = dependenciesFromInstall(outcome);

    // assert
    assert.deepStrictEqual(dependencies, []);
  });

  test("returns agents when only agents are declared", () => {
    // arrange
    const outcome = { declaresAgents: true, declaresMcp: false };

    // act
    const dependencies = dependenciesFromInstall(outcome);

    // assert
    assert.deepStrictEqual(dependencies, ["agents"]);
  });

  test("returns mcp when only mcp is declared", () => {
    // arrange
    const outcome = { declaresAgents: false, declaresMcp: true };

    // act
    const dependencies = dependenciesFromInstall(outcome);

    // assert
    assert.deepStrictEqual(dependencies, ["mcp"]);
  });

  test("returns agents before mcp when both are declared", () => {
    // arrange
    const outcome = { declaresAgents: true, declaresMcp: true };

    // act
    const dependencies = dependenciesFromInstall(outcome);

    // assert
    assert.deepStrictEqual(dependencies, ["agents", "mcp"]);
  });
});

describe("dependencyDisabledOutcome", () => {
  test("names the install remedy and the recorded version for a missing dependency", () => {
    // arrange
    const held = {
      scope: "project",
      marketplace: "official",
      plugin: "deploy-kit",
      dependency: "secrets-vault@official",
      kind: "missing",
    } as const;

    // act
    const outcome = dependencyDisabledOutcome(held, "1.2.3");

    // assert
    assert.deepStrictEqual(
      {
        ...outcome,
        cause: { message: outcome.cause.message, cause: outcome.cause.cause },
      },
      {
        kind: "plugin-dependency-disabled",
        scope: "project",
        marketplace: "official",
        plugin: "deploy-kit",
        version: "1.2.3",
        reasons: ["dependency unsatisfied"],
        cause: {
          message: 'Install "secrets-vault@official" or uninstall "deploy-kit@official"',
          cause: undefined,
        },
      },
    );
  });

  test("names the enable remedy and omits the version a disabled dependency has none of", () => {
    // arrange
    const held = {
      scope: "user",
      marketplace: "official",
      plugin: "deploy-kit",
      dependency: "secrets-vault@official",
      kind: "disabled",
    } as const;

    // act
    const outcome = dependencyDisabledOutcome(held, undefined);

    // assert
    assert.deepStrictEqual(
      { ...outcome, cause: outcome.cause.message },
      {
        kind: "plugin-dependency-disabled",
        scope: "user",
        marketplace: "official",
        plugin: "deploy-kit",
        reasons: ["dependency unsatisfied"],
        cause: 'Enable "secrets-vault@official" or uninstall "deploy-kit@official"',
      },
    );
  });

  test("names the declared range in the update remedy of an out-of-range dependency", () => {
    // arrange
    const held = {
      scope: "user",
      marketplace: "official",
      plugin: "deploy-kit",
      dependency: "secrets-vault@official",
      kind: "out-of-range",
      range: "^2.0.0",
    } as const;

    // act
    const outcome = dependencyDisabledOutcome(held, "1.0.0");

    // assert
    assert.deepStrictEqual(
      { cause: outcome.cause.message, reasons: outcome.reasons },
      {
        cause:
          'Update "secrets-vault@official" to satisfy ^2.0.0, or uninstall "deploy-kit@official"',
        reasons: ["dependency version unsatisfied"],
      },
    );
  });

  test("bounds a declared range too long to render", () => {
    // arrange
    const held = {
      scope: "user",
      marketplace: "official",
      plugin: "deploy-kit",
      dependency: "secrets-vault@official",
      kind: "out-of-range",
      range: `>=${"1".repeat(210)}`,
    } as const;

    // act
    const outcome = dependencyDisabledOutcome(held, "1.0.0");

    // assert
    assert.strictEqual(
      outcome.cause.message,
      `Update "secrets-vault@official" to satisfy >=${"1".repeat(198)}... (+12 chars), or uninstall "deploy-kit@official"`,
    );
  });

  test("T-06-02: drops a dependent key whose plugin name could close the remedy's quote", () => {
    // arrange
    const held = {
      scope: "project",
      marketplace: "official",
      plugin: 'x" or uninstall "victim@official',
      dependency: "secrets-vault@official",
      kind: "missing",
    } as const;

    // act
    const outcome = dependencyDisabledOutcome(held, "1.2.3");

    // assert
    assert.strictEqual(
      outcome.cause.message,
      'Install "secrets-vault@official" or uninstall this plugin',
    );
  });

  test("T-06-02: drops both keys when the marketplace name they share is unrenderable", () => {
    // arrange
    const held = {
      scope: "user",
      marketplace: 'official" or enable "victim@official',
      plugin: "deploy-kit",
      dependency: 'secrets-vault@official" or enable "victim@official',
      kind: "disabled",
    } as const;

    // act
    const outcome = dependencyDisabledOutcome(held, undefined);

    // assert
    assert.strictEqual(
      outcome.cause.message,
      "Enable the declared dependency or uninstall this plugin",
    );
  });

  test("names both parties without a constraint when an out-of-range entry carries no range", () => {
    // arrange
    const held = {
      scope: "user",
      marketplace: "official",
      plugin: "deploy-kit",
      dependency: "secrets-vault@official",
      kind: "out-of-range",
    } as const;

    // act
    const outcome = dependencyDisabledOutcome(held, undefined);

    // assert
    assert.strictEqual(
      outcome.cause.message,
      'Update "secrets-vault@official" or uninstall "deploy-kit@official"',
    );
  });
});
