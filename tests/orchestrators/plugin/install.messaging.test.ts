import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  INSTALL_CONTEXT,
  classifyEntityShapeError,
  classifyInstallFailure,
  composeInstallFailureMessage,
  formatOrchestratedCause,
  narrowResolverReasons,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts";
import { PluginShapeError } from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { PathContainmentError } from "../../../extensions/pi-claude-marketplace/shared/path-safety.ts";

import type {
  EntityErrorRow,
  InstallMsg,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts";
import type { SoftDepStatus } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

describe("INSTALL_CONTEXT", () => {
  test("exposes the install label and all six render arms", () => {
    // arrange
    const expectedRenderArms = [
      "disabled",
      "failed",
      "installed",
      "partially-available",
      "partially-installed",
      "unavailable",
    ];

    // act
    const contextShape = {
      label: INSTALL_CONTEXT.Messaging.label,
      renderArms: Object.keys(INSTALL_CONTEXT.render).sort(),
    };

    // assert
    assert.deepStrictEqual(contextShape, {
      label: "Plugin install",
      renderArms: expectedRenderArms,
    });
  });

  test("renders an installed row with reasons and both missing companions", () => {
    // arrange
    const message = {
      status: "installed",
      name: "helper",
      dependencies: ["agents", "mcp"],
      version: "1.2.3",
      scope: "user",
      reasons: ["orphan rewake"],
      severity: "warning",
      needsReload: true,
    } satisfies InstallMsg;
    const probe = {
      piSubagentsLoaded: false,
      piMcpAdapterLoaded: false,
    } satisfies SoftDepStatus;

    // act
    const row = INSTALL_CONTEXT.render.installed(message, probe, "user");

    // assert
    assert.strictEqual(
      row,
      "● helper v1.2.3 (installed) {orphan rewake, requires pi-subagents, requires pi-mcp}",
    );
  });

  test("renders a partially-installed row with cross-scope and dependency markers", () => {
    // arrange
    const message = {
      status: "partially-installed",
      name: "helper",
      reasons: ["lsp"],
      dependencies: ["agents"],
      version: "2.0.0",
      scope: "project",
      severity: "warning",
      needsReload: true,
    } satisfies InstallMsg;
    const probe = {
      piSubagentsLoaded: false,
      piMcpAdapterLoaded: true,
    } satisfies SoftDepStatus;

    // act
    const row = INSTALL_CONTEXT.render["partially-installed"](message, probe, "user");

    // assert
    assert.strictEqual(
      row,
      "◉ helper [project] v2.0.0 (partially-installed) {lsp, requires pi-subagents}",
    );
  });

  test("renders an unavailable row without a scope or partial hint trailer", () => {
    // arrange
    const message = {
      status: "unavailable",
      name: "helper",
      reasons: ["unsupported source"],
      severity: "error",
    } satisfies InstallMsg;
    const probe = {
      piSubagentsLoaded: false,
      piMcpAdapterLoaded: false,
    } satisfies SoftDepStatus;

    // act
    const row = INSTALL_CONTEXT.render.unavailable(message, probe, "project");

    // assert
    assert.strictEqual(row, "⊘ helper (unavailable) {unsupported source}");
  });

  test("renders a partially-available row without a scope", () => {
    // arrange
    const message = {
      status: "partially-available",
      name: "helper",
      reasons: ["unsupported hooks", "lsp"],
      version: "3.1.0",
      severity: "error",
      partialHint: true,
    } satisfies InstallMsg;
    const probe = {
      piSubagentsLoaded: false,
      piMcpAdapterLoaded: false,
    } satisfies SoftDepStatus;

    // act
    const row = INSTALL_CONTEXT.render["partially-available"](message, probe, "project");

    // assert
    assert.strictEqual(row, "⊖ helper v3.1.0 (partially-available) {unsupported hooks, lsp}");
  });

  test("renders a failed row with a cross-scope bracket and exact reasons", () => {
    // arrange
    const message = {
      status: "failed",
      name: "helper",
      reasons: ["permission denied"],
      version: "1.0.0",
      scope: "project",
      severity: "error",
      needsReload: false,
    } satisfies InstallMsg;
    const probe = {
      piSubagentsLoaded: false,
      piMcpAdapterLoaded: false,
    } satisfies SoftDepStatus;

    // act
    const row = INSTALL_CONTEXT.render.failed(message, probe, "user");

    // assert
    assert.strictEqual(row, "⊘ helper [project] v1.0.0 (failed) {permission denied}");
  });

  test("renders a disabled row without soft-dependency markers", () => {
    // arrange
    const message = {
      status: "disabled",
      name: "helper",
      version: "4.0.0",
      scope: "user",
      reasons: ["installs disabled", "malformed skill"],
      enableHint: true,
      severity: "warning",
      needsReload: false,
    } satisfies InstallMsg;
    const probe = {
      piSubagentsLoaded: false,
      piMcpAdapterLoaded: false,
    } satisfies SoftDepStatus;

    // act
    const row = INSTALL_CONTEXT.render.disabled(message, probe, "user");

    // assert
    assert.strictEqual(row, "◍ helper v4.0.0 (disabled) {installs disabled, malformed skill}");
  });
});

describe("composeInstallFailureMessage", () => {
  test("gives path containment precedence over rollback and entity failures", () => {
    // arrange
    const containment = new PathContainmentError("/safe", "/escape", "plugin source");
    const rollbackCause = new Error("rollback failed");
    const entityErrorRow = {
      kind: "entity-error",
      name: "ignored",
      marketplace: "official",
      scope: "project",
      status: "unavailable",
      reasons: ["unsupported source"],
      partialable: true,
    } satisfies EntityErrorRow;

    // act
    const message = composeInstallFailureMessage({
      err: containment,
      plugin: "helper",
      scope: "project",
      version: "1.0.0",
      rolledBackPartial: true,
      rollbackPartials: [{ phase: "phase3a", msg: "ignored", cause: rollbackCause }],
      entityErrorRow,
    });

    // assert
    assert.deepStrictEqual(message, {
      status: "failed",
      name: "helper",
      reasons: [],
      version: "1.0.0",
      scope: "project",
      cause: containment,
      severity: "error",
      needsReload: false,
    });
  });

  test("maps rollback-partial children in causal order with true cause omission", () => {
    // arrange
    const failure = new Error("install failed");
    const rollbackCause = new Error("remove failed");
    const entityErrorRow = {
      kind: "entity-error",
      name: "ignored",
      status: "failed",
      reasons: ["already installed"],
    } satisfies EntityErrorRow;

    // act
    const message = composeInstallFailureMessage({
      err: failure,
      plugin: "helper",
      scope: "user",
      version: "2.4.0",
      rolledBackPartial: true,
      rollbackPartials: [
        { phase: "phase3a", msg: "remove failed", cause: rollbackCause },
        { phase: "phase3b", msg: "orphan remains" },
      ],
      entityErrorRow,
    });

    // assert
    assert.deepStrictEqual(message, {
      status: "failed",
      name: "helper",
      reasons: ["rollback partial"],
      version: "2.4.0",
      scope: "user",
      cause: failure,
      severity: "error",
      needsReload: false,
      rollbackPartial: [{ phase: "phase3a", cause: rollbackCause }, { phase: "phase3b" }],
    });
  });

  test("composes a failed entity row with the runtime cause", () => {
    // arrange
    const failure = new Error("plugin missing");
    const entityErrorRow = {
      kind: "entity-error",
      name: "helper",
      marketplace: "official",
      scope: "project",
      status: "failed",
      reasons: ["not in manifest"],
    } satisfies EntityErrorRow;

    // act
    const message = composeInstallFailureMessage({
      err: failure,
      plugin: "helper",
      scope: "project",
      version: undefined,
      rolledBackPartial: false,
      rollbackPartials: [],
      entityErrorRow,
    });

    // assert
    assert.deepStrictEqual(message, {
      status: "failed",
      name: "helper",
      reasons: ["not in manifest"],
      scope: "project",
      cause: failure,
      severity: "error",
      needsReload: false,
    });
  });

  test("includes a nonempty version on a failed entity row", () => {
    // arrange
    const entityErrorRow = {
      kind: "entity-error",
      name: "helper",
      status: "failed",
      reasons: ["already installed"],
    } satisfies EntityErrorRow;

    // act
    const message = composeInstallFailureMessage({
      err: "already installed",
      plugin: "helper",
      scope: "user",
      version: "7.0.0",
      rolledBackPartial: false,
      rollbackPartials: [],
      entityErrorRow,
    });

    // assert
    assert.deepStrictEqual(message, {
      status: "failed",
      name: "helper",
      reasons: ["already installed"],
      version: "7.0.0",
      scope: "user",
      severity: "error",
      needsReload: false,
    });
  });

  test("composes structural unavailability without scope, cause, or hint", () => {
    // arrange
    const failure = new Error("source missing");
    const entityErrorRow = {
      kind: "entity-error",
      name: "helper",
      marketplace: "official",
      scope: "project",
      status: "unavailable",
      reasons: ["unsupported source"],
      partialable: false,
    } satisfies EntityErrorRow;

    // act
    const message = composeInstallFailureMessage({
      err: failure,
      plugin: "helper",
      scope: "project",
      version: "2.0.0",
      rolledBackPartial: false,
      rollbackPartials: [],
      entityErrorRow,
    });

    // assert
    assert.deepStrictEqual(message, {
      status: "unavailable",
      name: "helper",
      reasons: ["unsupported source"],
      version: "2.0.0",
      severity: "error",
    });
  });

  test("composes partial availability with the exact hint and empty-version omission", () => {
    // arrange
    const failure = new Error("unsupported components");
    const entityErrorRow = {
      kind: "entity-error",
      name: "helper",
      marketplace: "official",
      scope: "project",
      status: "unavailable",
      reasons: ["unsupported hooks", "lsp"],
      partialable: true,
    } satisfies EntityErrorRow;

    // act
    const message = composeInstallFailureMessage({
      err: failure,
      plugin: "helper",
      scope: "project",
      version: "",
      rolledBackPartial: false,
      rollbackPartials: [],
      entityErrorRow,
    });

    // assert
    assert.deepStrictEqual(message, {
      status: "partially-available",
      name: "helper",
      reasons: ["unsupported hooks", "lsp"],
      severity: "error",
      partialHint: true,
    });
  });

  test("includes a nonempty version on partial availability", () => {
    // arrange
    const entityErrorRow = {
      kind: "entity-error",
      name: "helper",
      status: "unavailable",
      reasons: ["unsupported component"],
      partialable: true,
    } satisfies EntityErrorRow;

    // act
    const message = composeInstallFailureMessage({
      err: new Error("unsupported component"),
      plugin: "helper",
      scope: "project",
      version: "8.0.0",
      rolledBackPartial: false,
      rollbackPartials: [],
      entityErrorRow,
    });

    // assert
    assert.deepStrictEqual(message, {
      status: "partially-available",
      name: "helper",
      reasons: ["unsupported component"],
      version: "8.0.0",
      severity: "error",
      partialHint: true,
    });
  });

  test("classifies an HTTP authentication challenge without exposing its cause", () => {
    // arrange
    const failure = Object.assign(new Error("HTTP 401 for private clone"), {
      code: "HttpError",
      data: { statusCode: 401 },
    });

    // act
    const message = composeInstallFailureMessage({
      err: failure,
      plugin: "helper",
      scope: "user",
      version: "1.2.3",
      rolledBackPartial: false,
      rollbackPartials: [],
      entityErrorRow: undefined,
    });

    // assert
    assert.deepStrictEqual(message, {
      status: "failed",
      name: "helper",
      reasons: ["authentication required"],
      version: "1.2.3",
      scope: "user",
      severity: "error",
      needsReload: false,
    });
  });

  test("classifies a cancelled authentication flow without exposing its cause", () => {
    // arrange
    const failure = Object.assign(new Error("device flow cancelled"), {
      name: "UserCanceledError",
    });

    // act
    const message = composeInstallFailureMessage({
      err: failure,
      plugin: "helper",
      scope: "project",
      version: undefined,
      rolledBackPartial: false,
      rollbackPartials: [],
      entityErrorRow: undefined,
    });

    // assert
    assert.deepStrictEqual(message, {
      status: "failed",
      name: "helper",
      reasons: ["authentication required"],
      scope: "project",
      severity: "error",
      needsReload: false,
    });
  });

  test("keeps a network errno failure on the generic runtime cause path", () => {
    // arrange
    const failure = Object.assign(new Error("network unreachable"), { code: "ENETUNREACH" });

    // act
    const message = composeInstallFailureMessage({
      err: failure,
      plugin: "helper",
      scope: "project",
      version: undefined,
      rolledBackPartial: false,
      rollbackPartials: [],
      entityErrorRow: undefined,
    });

    // assert
    assert.deepStrictEqual(message, {
      status: "failed",
      name: "helper",
      reasons: [],
      scope: "project",
      cause: failure,
      severity: "error",
      needsReload: false,
    });
  });

  test("keeps a generic Error as the failed-row cause", () => {
    // arrange
    const failure = new Error("state write failed");

    // act
    const message = composeInstallFailureMessage({
      err: failure,
      plugin: "helper",
      scope: "project",
      version: "5.0.0",
      rolledBackPartial: false,
      rollbackPartials: [],
      entityErrorRow: undefined,
    });

    // assert
    assert.deepStrictEqual(message, {
      status: "failed",
      name: "helper",
      reasons: [],
      version: "5.0.0",
      scope: "project",
      cause: failure,
      severity: "error",
      needsReload: false,
    });
  });

  test("omits a cause for a non-Error runtime throw", () => {
    // arrange
    const failure = "disk exploded";

    // act
    const message = composeInstallFailureMessage({
      err: failure,
      plugin: "helper",
      scope: "project",
      version: "6.0.0",
      rolledBackPartial: false,
      rollbackPartials: [],
      entityErrorRow: undefined,
    });

    // assert
    assert.deepStrictEqual(message, {
      status: "failed",
      name: "helper",
      reasons: [],
      version: "6.0.0",
      scope: "project",
      severity: "error",
      needsReload: false,
    });
  });
});

describe("formatOrchestratedCause", () => {
  test("returns a null throw without a cause trailer", () => {
    // arrange
    const failure = null;

    // act
    const cause = formatOrchestratedCause(failure);

    // assert
    assert.strictEqual(cause, "null");
  });

  test("formats the complete nested cause chain after the head", () => {
    // arrange
    const inner = new Error("inner failure");
    const middle = new Error("middle failure", { cause: inner });
    const outer = new Error("outer failure", { cause: middle });

    // act
    const cause = formatOrchestratedCause(outer);

    // assert
    assert.strictEqual(
      cause,
      "outer failure\n\ncause: outer failure -> middle failure -> inner failure",
    );
  });
});

describe("classifyEntityShapeError", () => {
  test("returns exact absence for a generic runtime error", () => {
    // arrange
    const failure = new Error("runtime failed");

    // act
    const entityErrorRow = classifyEntityShapeError(failure, {
      plugin: "helper",
      marketplace: "official",
      scope: "project",
    });

    // assert
    assert.strictEqual(entityErrorRow, undefined);
  });

  test("classifies an already-installed plugin on the requested subject", () => {
    // arrange
    const failure = new PluginShapeError({
      kind: "already-installed",
      plugin: "thrown-name",
      marketplace: "thrown-marketplace",
    });

    // act
    const entityErrorRow = classifyEntityShapeError(failure, {
      plugin: "helper",
      marketplace: "official",
      scope: "user",
    });

    // assert
    assert.deepStrictEqual(entityErrorRow, {
      kind: "entity-error",
      name: "helper",
      marketplace: "official",
      scope: "user",
      status: "failed",
      reasons: ["already installed"],
    });
  });

  test("classifies a plugin absent from the manifest on the requested subject", () => {
    // arrange
    const failure = new PluginShapeError({
      kind: "not-in-manifest",
      plugin: "thrown-name",
      marketplace: "thrown-marketplace",
    });

    // act
    const entityErrorRow = classifyEntityShapeError(failure, {
      plugin: "helper",
      marketplace: "official",
      scope: "project",
    });

    // assert
    assert.deepStrictEqual(entityErrorRow, {
      kind: "entity-error",
      name: "helper",
      marketplace: "official",
      scope: "project",
      status: "failed",
      reasons: ["not in manifest"],
    });
  });

  test("classifies a partially installable plugin with ordered deduplicated reasons", () => {
    // arrange
    const failure = new PluginShapeError({
      kind: "not-installable",
      plugin: "thrown-name",
      reasons: ["contains lspServers", "contains themes"],
      partialable: true,
      unsupportedKinds: ["hooks", "lspServers"],
    });

    // act
    const entityErrorRow = classifyEntityShapeError(failure, {
      plugin: "helper",
      marketplace: "official",
      scope: "project",
    });

    // assert
    assert.deepStrictEqual(entityErrorRow, {
      kind: "entity-error",
      name: "helper",
      marketplace: "official",
      scope: "project",
      status: "unavailable",
      reasons: ["unsupported hooks", "lsp", "unsupported component"],
      partialable: true,
    });
  });

  test("classifies a no-longer-installable plugin as structural unavailability", () => {
    // arrange
    const failure = new PluginShapeError({
      kind: "no-longer-installable",
      plugin: "thrown-name",
      reasons: ["source directory missing"],
      partialable: false,
      unsupportedKinds: [],
    });

    // act
    const entityErrorRow = classifyEntityShapeError(failure, {
      plugin: "helper",
      marketplace: "official",
      scope: "user",
    });

    // assert
    assert.deepStrictEqual(entityErrorRow, {
      kind: "entity-error",
      name: "helper",
      marketplace: "official",
      scope: "user",
      status: "unavailable",
      reasons: ["unsupported source"],
      partialable: false,
    });
  });
});

describe("narrowResolverReasons", () => {
  for (const { note, reason } of [
    {
      note: "hooks.json is not valid JSON: Unexpected token ]",
      reason: "unsupported hooks",
    },
    {
      note: "hooks.json failed schema validation: /hooks expected object",
      reason: "unsupported hooks",
    },
    { note: "unsupported hooks: regex matcher", reason: "unsupported hooks" },
    { note: "malformed hooks.json: missing hooks", reason: "unsupported hooks" },
    { note: "EACCES: permission denied", reason: "permission denied" },
    { note: "EPERM: operation not permitted", reason: "permission denied" },
    { note: "ENOENT: no such file", reason: "source missing" },
    { note: "ENOTDIR: path component is not a directory", reason: "source missing" },
    { note: "SyntaxError while reading manifest", reason: "unparseable" },
    { note: "Unexpected token } in JSON", reason: "unparseable" },
  ] as const) {
    test(`narrows ${note} to ${reason}`, () => {
      // arrange
      const reasons = [note];

      // act
      const narrowedReasons = narrowResolverReasons(reasons);

      // assert
      assert.deepStrictEqual(narrowedReasons, [reason]);
    });
  }

  test("maps the lspServers manifest-field carve-out to lsp", () => {
    // arrange
    const reasons = ["contains lspServers"];

    // act
    const narrowedReasons = narrowResolverReasons(reasons);

    // assert
    assert.deepStrictEqual(narrowedReasons, ["lsp"]);
  });

  test("maps a partial non-carve-out component through the component axis", () => {
    // arrange
    const reasons = ["contains monitors"];
    const unsupportedKinds = ["monitors"];

    // act
    const narrowedReasons = narrowResolverReasons(reasons, unsupportedKinds, true);

    // assert
    assert.deepStrictEqual(narrowedReasons, ["unsupported component"]);
  });

  test("maps a structural non-carve-out component through the source axis", () => {
    // arrange
    const reasons = ["contains monitors"];

    // act
    const narrowedReasons = narrowResolverReasons(reasons, [], false);

    // assert
    assert.deepStrictEqual(narrowedReasons, ["unsupported source"]);
  });

  test("gives malformed MCP precedence over an embedded parse-error phrase", () => {
    // arrange
    const reasons = ['malformed mcp reference: invalid JSON in "x.mcp.json": Unexpected token n'];

    // act
    const narrowedReasons = narrowResolverReasons(reasons);

    // assert
    assert.deepStrictEqual(narrowedReasons, ["malformed mcp"]);
  });

  test("maps a source note to unsupported source", () => {
    // arrange
    const reasons = ["source directory does not exist"];

    // act
    const narrowedReasons = narrowResolverReasons(reasons);

    // assert
    assert.deepStrictEqual(narrowedReasons, ["unsupported source"]);
  });

  test("uses unsupported source for an empty note", () => {
    // arrange
    const reasons = [""];

    // act
    const narrowedReasons = narrowResolverReasons(reasons);

    // assert
    assert.deepStrictEqual(narrowedReasons, ["unsupported source"]);
  });

  test("uses unsupported source when every optional input is omitted", () => {
    // arrange
    const reasons: string[] = [];

    // act
    const narrowedReasons = narrowResolverReasons(reasons);

    // assert
    assert.deepStrictEqual(narrowedReasons, ["unsupported source"]);
  });

  test("uses unsupported source for a wholly unclassifiable note", () => {
    // arrange
    const reasons = ["unclassified resolver detail"];

    // act
    const narrowedReasons = narrowResolverReasons(reasons);

    // assert
    assert.deepStrictEqual(narrowedReasons, ["unsupported source"]);
  });

  test("preserves typed-kind precedence and first-seen deduplication", () => {
    // arrange
    const reasons = ["contains lspServers", "contains monitors", "contains lspServers"];
    const unsupportedKinds = ["themes", "lspServers", "themes"];

    // act
    const narrowedReasons = narrowResolverReasons(reasons, unsupportedKinds, true);

    // assert
    assert.deepStrictEqual(narrowedReasons, ["unsupported component", "lsp"]);
  });
});

describe("classifyInstallFailure", () => {
  test("preserves an Error instance in the collapsed failure outcome", () => {
    // arrange
    const failure = new PluginShapeError({
      kind: "not-in-manifest",
      plugin: "helper",
      marketplace: "official",
    });

    // act
    const outcome = classifyInstallFailure(failure, "formatted cause");

    // assert
    assert.deepStrictEqual(outcome, {
      status: "failed",
      error: failure,
      cause: "formatted cause",
    });
  });

  test("wraps a non-Error input with the formatted cause", () => {
    // arrange
    const failure = { code: "opaque" };

    // act
    const outcome = classifyInstallFailure(failure, "formatted opaque failure");

    // assert
    assert.deepStrictEqual(outcome, {
      status: "failed",
      error: new Error("formatted opaque failure"),
      cause: "formatted opaque failure",
    });
  });
});
