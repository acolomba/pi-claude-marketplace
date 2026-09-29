import assert from "node:assert/strict";
import test from "node:test";

import {
  DISABLE_CONTEXT,
  ENABLE_CONTEXT,
  narrowDisableFailure,
  narrowEnableFailure,
  staleGateDropped,
  type DisableMsg,
  type EnableMsg,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts";
import { PluginShapeError } from "../../../extensions/pi-claude-marketplace/shared/errors.ts";

import type { ResolvedRow } from "../../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";

test("exports the complete enable and disable command contexts", () => {
  // arrange
  const expectedDisableRenderKeys = ["disabled", "failed", "skipped"];
  const expectedEnableRenderKeys = ["failed", "installed", "partially-installed", "skipped"];

  // act
  const contextKeys = Object.keys(DISABLE_CONTEXT);
  const disableRenderKeys = Object.keys(DISABLE_CONTEXT.render).sort();
  const enableRenderKeys = Object.keys(ENABLE_CONTEXT.render).sort();

  // assert
  assert.deepStrictEqual(contextKeys, ["Messaging", "render", "markers"]);
  assert.deepStrictEqual(Object.keys(ENABLE_CONTEXT), ["Messaging", "render", "markers"]);
  assert.deepStrictEqual(DISABLE_CONTEXT.Messaging, { label: "Plugin disable" });
  assert.deepStrictEqual(ENABLE_CONTEXT.Messaging, { label: "Plugin enable" });
  assert.deepStrictEqual(disableRenderKeys, expectedDisableRenderKeys);
  assert.deepStrictEqual(enableRenderKeys, expectedEnableRenderKeys);
});

test("the disable context renders a complete bare disabled transition", () => {
  // arrange
  const row = {
    status: "disabled",
    severity: "info",
    needsReload: true,
    name: "alpha",
    version: "1.2.3",
    scope: "project",
    reasons: [],
  } as const satisfies ResolvedRow<DisableMsg>;

  // act
  const actual = DISABLE_CONTEXT.render.disabled(row, "user");

  // assert
  assert.equal(actual, "◍ alpha [project] v1.2.3 (disabled)");
  assert.deepStrictEqual(row, {
    status: "disabled",
    severity: "info",
    needsReload: true,
    name: "alpha",
    version: "1.2.3",
    scope: "project",
    reasons: [],
  });
  assert.equal(Object.hasOwn(row, "description"), false);
  assert.equal(Object.hasOwn(row, "hint"), false);
});

test("the disable context renders a complete failed row without leaking its failure detail", () => {
  // arrange
  const failure = {
    cause: { causeChain: ["unstage failed"], truncated: false },
    leaks: [],
    rollbackPartial: [],
  };
  const row = {
    status: "failed",
    severity: "error",
    needsReload: false,
    name: "beta",
    version: "2.0.0",
    scope: "user",
    reasons: ["permission denied", "rollback partial"],
    failure,
  } as const satisfies ResolvedRow<DisableMsg>;

  // act
  const actual = DISABLE_CONTEXT.render.failed(row, "user");

  // assert
  assert.equal(actual, "⊘ beta v2.0.0 (failed) {permission denied, rollback partial}");
  assert.deepStrictEqual(row, {
    status: "failed",
    severity: "error",
    needsReload: false,
    name: "beta",
    version: "2.0.0",
    scope: "user",
    reasons: ["permission denied", "rollback partial"],
    failure,
  });
  assert.equal(Object.hasOwn(row, "hint"), false);
});

test("the disable context renders a complete idempotent skipped row", () => {
  // arrange
  const row = {
    status: "skipped",
    severity: "info",
    needsReload: false,
    name: "gamma",
    version: "3.0.0",
    scope: "user",
    reasons: ["already disabled"],
  } as const satisfies ResolvedRow<DisableMsg>;

  // act
  const actual = DISABLE_CONTEXT.render.skipped(row, "project");

  // assert
  assert.equal(actual, "⊘ gamma [user] v3.0.0 (skipped) {already disabled}");
  assert.deepStrictEqual(row, {
    status: "skipped",
    severity: "info",
    needsReload: false,
    name: "gamma",
    version: "3.0.0",
    scope: "user",
    reasons: ["already disabled"],
  });
  assert.equal(Object.hasOwn(row, "failure"), false);
});

test("the enable context renders a complete failed stale-gate row body", () => {
  // arrange
  const failure = {
    cause: { causeChain: ["plugin delta is not installable"], truncated: false },
    leaks: [],
    rollbackPartial: [],
  };
  const row = {
    status: "failed",
    severity: "error",
    needsReload: false,
    name: "delta",
    version: "4.0.0",
    scope: "user",
    reasons: ["lsp"],
    hint: "stale-gate-update",
    failure,
  } as const satisfies ResolvedRow<EnableMsg>;

  // act
  const actual = ENABLE_CONTEXT.render.failed(row, "user");

  // assert
  assert.equal(actual, "⊘ delta v4.0.0 (failed) {lsp}");
  assert.deepStrictEqual(row, {
    status: "failed",
    severity: "error",
    needsReload: false,
    name: "delta",
    version: "4.0.0",
    scope: "user",
    reasons: ["lsp"],
    hint: "stale-gate-update",
    failure,
  });
});

test("the enable context renders a complete bare installed transition", () => {
  // arrange
  const row = {
    status: "installed",
    severity: "info",
    needsReload: true,
    name: "epsilon",
    version: "5.0.0",
    reasons: [],
  } as const satisfies ResolvedRow<EnableMsg>;

  // act
  const actual = ENABLE_CONTEXT.render.installed(row, "project");

  // assert
  assert.equal(actual, "● epsilon v5.0.0 (installed)");
  assert.deepStrictEqual(row, {
    status: "installed",
    severity: "info",
    needsReload: true,
    name: "epsilon",
    version: "5.0.0",
    reasons: [],
  });
  assert.equal(Object.hasOwn(row, "description"), false);
  assert.equal(Object.hasOwn(row, "scope"), false);
});

test("the enable context renders installed content reasons before the resolved markers", () => {
  // arrange
  const row = {
    status: "installed",
    severity: "warning",
    needsReload: true,
    name: "eta",
    version: "6.0.0",
    scope: "project",
    reasons: ["malformed skill", "requires pi-subagents", "requires pi-mcp"],
  } as const satisfies ResolvedRow<EnableMsg>;

  // act
  const actual = ENABLE_CONTEXT.render.installed(row, "user");

  // assert
  assert.equal(
    actual,
    "● eta [project] v6.0.0 (installed) {malformed skill, requires pi-subagents, requires pi-mcp}",
  );
  assert.deepStrictEqual(row, {
    status: "installed",
    severity: "warning",
    needsReload: true,
    name: "eta",
    version: "6.0.0",
    scope: "project",
    reasons: ["malformed skill", "requires pi-subagents", "requires pi-mcp"],
  });
});

test("the enable context renders a partially-installed row with its resolved marker", () => {
  // arrange
  const row = {
    status: "partially-installed",
    severity: "info",
    needsReload: true,
    name: "theta",
    version: "7.0.0",
    scope: "user",
    reasons: ["lsp", "requires pi-mcp"],
  } as const satisfies ResolvedRow<EnableMsg>;

  // act
  const actual = ENABLE_CONTEXT.render["partially-installed"](row, "user");

  // assert
  assert.equal(actual, "◉ theta v7.0.0 (partially-installed) {lsp, requires pi-mcp}");
  assert.deepStrictEqual(row, {
    status: "partially-installed",
    severity: "info",
    needsReload: true,
    name: "theta",
    version: "7.0.0",
    scope: "user",
    reasons: ["lsp", "requires pi-mcp"],
  });
  assert.equal(Object.hasOwn(row, "description"), false);
});

test("the enable context renders a complete idempotent skipped row with optional fields omitted", () => {
  // arrange
  const row = {
    status: "skipped",
    severity: "info",
    needsReload: false,
    name: "zeta",
    scope: "project",
    reasons: ["already enabled"],
  } as const satisfies ResolvedRow<EnableMsg>;

  // act
  const actual = ENABLE_CONTEXT.render.skipped(row, "user");

  // assert
  assert.equal(actual, "⊘ zeta [project] (skipped) {already enabled}");
  assert.deepStrictEqual(row, {
    status: "skipped",
    severity: "info",
    needsReload: false,
    name: "zeta",
    scope: "project",
    reasons: ["already enabled"],
  });
  assert.equal(Object.hasOwn(row, "failure"), false);
  assert.equal(Object.hasOwn(row, "version"), false);
});

test("narrowDisableFailure classifies EACCES as permission denied", () => {
  // arrange
  const cause: NodeJS.ErrnoException = new Error("access denied");
  cause.code = "EACCES";

  // act
  const actual = narrowDisableFailure(cause);

  // assert
  assert.deepStrictEqual(actual, ["permission denied"]);
});

test("narrowDisableFailure classifies ENOENT as source missing", () => {
  // arrange
  const cause: NodeJS.ErrnoException = new Error("source gone");
  cause.code = "ENOENT";

  // act
  const actual = narrowDisableFailure(cause);

  // assert
  assert.deepStrictEqual(actual, ["source missing"]);
});

test("narrowDisableFailure classifies EPERM as permission denied", () => {
  // arrange
  const cause: NodeJS.ErrnoException = new Error("operation denied");
  cause.code = "EPERM";

  // act
  const actual = narrowDisableFailure(cause);

  // assert
  assert.deepStrictEqual(actual, ["permission denied"]);
});

test("narrowDisableFailure classifies an unsupported errno as unreadable", () => {
  // arrange
  const cause: NodeJS.ErrnoException = new Error("input output failure");
  cause.code = "EIO";

  // act
  const actual = narrowDisableFailure(cause);

  // assert
  assert.deepStrictEqual(actual, ["unreadable"]);
});

test("narrowDisableFailure classifies a nested errno by the outer Error fallback", () => {
  // arrange
  const nested: NodeJS.ErrnoException = new Error("source gone");
  nested.code = "ENOENT";
  const cause = new Error("cascade failed", { cause: nested });

  // act
  const actual = narrowDisableFailure(cause);

  // assert
  assert.deepStrictEqual(actual, ["unreadable"]);
});

test("narrowEnableFailure gives a direct ENOENT precedence over its nested cause", () => {
  // arrange
  const nested: NodeJS.ErrnoException = new Error("access denied");
  nested.code = "EACCES";
  const cause: NodeJS.ErrnoException = new Error("source gone", { cause: nested });
  cause.code = "ENOENT";

  // act
  const actual = narrowEnableFailure(cause);

  // assert
  assert.deepStrictEqual(actual, ["source missing"]);
});

test("narrowEnableFailure classifies a nested ENOENT as source missing", () => {
  // arrange
  const nested: NodeJS.ErrnoException = new Error("source gone");
  nested.code = "ENOENT";
  const cause = new Error("enable failed", { cause: nested });

  // act
  const actual = narrowEnableFailure(cause);

  // assert
  assert.deepStrictEqual(actual, ["source missing"]);
});

test("narrowEnableFailure keeps an unsupported direct errno brace-less", () => {
  // arrange
  const cause: NodeJS.ErrnoException = new Error("access denied");
  cause.code = "EACCES";

  // act
  const actual = narrowEnableFailure(cause);

  // assert
  assert.deepStrictEqual(actual, []);
});

test("narrowEnableFailure keeps an unsupported nested errno brace-less", () => {
  // arrange
  const nested: NodeJS.ErrnoException = new Error("input output failure");
  nested.code = "EIO";
  const cause = new Error("enable failed", { cause: nested });

  // act
  const actual = narrowEnableFailure(cause);

  // assert
  assert.deepStrictEqual(actual, []);
});

test("narrowEnableFailure keeps a non-Error nested throw brace-less", () => {
  // arrange
  const cause = new Error("enable failed", { cause: "thrown string" });

  // act
  const actual = narrowEnableFailure(cause);

  // assert
  assert.deepStrictEqual(actual, []);
});

test("narrowEnableFailure keeps a plain Error brace-less", () => {
  // arrange
  const cause = new Error("enable failed");

  // act
  const actual = narrowEnableFailure(cause);

  // assert
  assert.deepStrictEqual(actual, []);
});

test("staleGateDropped ignores an empty unsupported-kind list", () => {
  // arrange
  const cause = new PluginShapeError({
    kind: "not-installable",
    plugin: "alpha",
    reasons: ["contains no named kind"],
    partialable: true,
    unsupportedKinds: [],
  });

  // act
  const actual = staleGateDropped(cause);

  // assert
  assert.equal(actual, undefined);
});

test("staleGateDropped ignores a missing unsupported-kind list", () => {
  // arrange
  const cause = new PluginShapeError({
    kind: "not-installable",
    plugin: "beta",
    reasons: ["contains no typed kind"],
    partialable: true,
  });

  // act
  const actual = staleGateDropped(cause);

  // assert
  assert.equal(actual, undefined);
});

test("staleGateDropped ignores a no-longer-installable shape", () => {
  // arrange
  const cause = new PluginShapeError({
    kind: "no-longer-installable",
    plugin: "gamma",
    reasons: ["contains lspServers"],
    partialable: true,
    unsupportedKinds: ["lspServers"],
  });

  // act
  const actual = staleGateDropped(cause);

  // assert
  assert.equal(actual, undefined);
});

test("staleGateDropped ignores a non-partialable structural failure", () => {
  // arrange
  const cause = new PluginShapeError({
    kind: "not-installable",
    plugin: "delta",
    reasons: ["source dir does not exist"],
    partialable: false,
    unsupportedKinds: [],
  });

  // act
  const actual = staleGateDropped(cause);

  // assert
  assert.equal(actual, undefined);
});

test("staleGateDropped ignores a plain Error", () => {
  // arrange
  const cause = new Error("enable failed");

  // act
  const actual = staleGateDropped(cause);

  // assert
  assert.equal(actual, undefined);
});

test("staleGateDropped preserves first-seen unsupported-kind order and deduplicates reasons", () => {
  // arrange
  const cause = new PluginShapeError({
    kind: "not-installable",
    plugin: "epsilon",
    reasons: ["contains lspServers", "contains hooks", "contains mcpServers"],
    partialable: true,
    unsupportedKinds: ["lspServers", "hooks", "mcpServers", "commands", "lspServers"],
  });

  // act
  const actual = staleGateDropped(cause);

  // assert
  assert.deepStrictEqual(actual, ["lsp", "unsupported hooks", "unsupported component"]);
});
