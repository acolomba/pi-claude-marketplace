import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createGitHubCloneNotes } from "../../../extensions/pi-claude-marketplace/orchestrators/github-transport.ts";
import {
  composeDisableRefusalCause,
  composeEnableCascadeRows,
  composeEnableMissingDependencyCause,
  DISABLE_CONTEXT,
  ENABLE_CONTEXT,
  narrowDisableFailure,
  narrowEnableFailure,
  staleGateDropped,
  type DisableMsg,
  type EnableCascadeMemberRow,
  type EnableMsg,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts";
import { PluginShapeError } from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { composePluginLines } from "../../../extensions/pi-claude-marketplace/shared/notification-grammar.ts";
import { resolveRows } from "../../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";
import { runWithNothingLoaded } from "../../shared/notification-run-seeds.ts";

import type { ResolvedRow } from "../../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";

test("exports the complete enable and disable command contexts", () => {
  // arrange
  const expectedDisableRenderKeys = ["disabled", "failed", "skipped"];
  const expectedEnableRenderKeys = ["failed", "installed", "partially-installed", "skipped"];

  // act
  const contextKeys = Object.keys(DISABLE_CONTEXT);
  const disableRenderKeys = Object.keys(DISABLE_CONTEXT.rowPolicies).sort();
  const enableRenderKeys = Object.keys(ENABLE_CONTEXT.rowPolicies).sort();

  // assert
  assert.deepStrictEqual(contextKeys, ["Messaging", "rowPolicies"]);
  assert.deepStrictEqual(Object.keys(ENABLE_CONTEXT), ["Messaging", "rowPolicies"]);
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
  const renderedRow = composePluginLines(row, "user")[0]!.slice(2);

  // assert
  assert.equal(renderedRow, "◍ alpha [project] v1.2.3 (disabled)");
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
  const renderedRow = composePluginLines(row, "user")[0]!.slice(2);

  // assert
  assert.equal(renderedRow, "⊘ beta v2.0.0 (failed) {permission denied, rollback partial}");
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
  const renderedRow = composePluginLines(row, "project")[0]!.slice(2);

  // assert
  assert.equal(renderedRow, "⊘ gamma [user] v3.0.0 (skipped) {already disabled}");
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
  const renderedRow = composePluginLines(row, "user")[0]!.slice(2);

  // assert
  assert.equal(renderedRow, "⊘ delta v4.0.0 (failed) {lsp}");
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
  const renderedRow = composePluginLines(row, "project")[0]!.slice(2);

  // assert
  assert.equal(renderedRow, "● epsilon v5.0.0 (installed)");
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
    reasons: ["malformed skill", "requires pi-subagents", "requires pi-mcp-adapter"],
  } as const satisfies ResolvedRow<EnableMsg>;

  // act
  const renderedRow = composePluginLines(row, "user")[0]!.slice(2);

  // assert
  assert.equal(
    renderedRow,
    "● eta [project] v6.0.0 (installed) {malformed skill, requires pi-subagents, requires pi-mcp-adapter}",
  );
  assert.deepStrictEqual(row, {
    status: "installed",
    severity: "warning",
    needsReload: true,
    name: "eta",
    version: "6.0.0",
    scope: "project",
    reasons: ["malformed skill", "requires pi-subagents", "requires pi-mcp-adapter"],
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
    reasons: ["lsp", "requires pi-mcp-adapter"],
  } as const satisfies ResolvedRow<EnableMsg>;

  // act
  const renderedRow = composePluginLines(row, "user")[0]!.slice(2);

  // assert
  assert.equal(renderedRow, "◉ theta v7.0.0 (partially-installed) {lsp, requires pi-mcp-adapter}");
  assert.deepStrictEqual(row, {
    status: "partially-installed",
    severity: "info",
    needsReload: true,
    name: "theta",
    version: "7.0.0",
    scope: "user",
    reasons: ["lsp", "requires pi-mcp-adapter"],
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
  const renderedRow = composePluginLines(row, "user")[0]!.slice(2);

  // assert
  assert.equal(renderedRow, "⊘ zeta [project] (skipped) {already enabled}");
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
  const reasons = narrowDisableFailure(cause);

  // assert
  assert.deepStrictEqual(reasons, ["permission denied"]);
});

test("narrowDisableFailure classifies ENOENT as source missing", () => {
  // arrange
  const cause: NodeJS.ErrnoException = new Error("source gone");
  cause.code = "ENOENT";

  // act
  const reasons = narrowDisableFailure(cause);

  // assert
  assert.deepStrictEqual(reasons, ["source missing"]);
});

test("narrowDisableFailure classifies EPERM as permission denied", () => {
  // arrange
  const cause: NodeJS.ErrnoException = new Error("operation denied");
  cause.code = "EPERM";

  // act
  const reasons = narrowDisableFailure(cause);

  // assert
  assert.deepStrictEqual(reasons, ["permission denied"]);
});

test("narrowDisableFailure classifies an unsupported errno as unreadable", () => {
  // arrange
  const cause: NodeJS.ErrnoException = new Error("input output failure");
  cause.code = "EIO";

  // act
  const reasons = narrowDisableFailure(cause);

  // assert
  assert.deepStrictEqual(reasons, ["unreadable"]);
});

test("narrowDisableFailure classifies a nested errno by the outer Error fallback", () => {
  // arrange
  const nested: NodeJS.ErrnoException = new Error("source gone");
  nested.code = "ENOENT";
  const cause = new Error("cascade failed", { cause: nested });

  // act
  const reasons = narrowDisableFailure(cause);

  // assert
  assert.deepStrictEqual(reasons, ["unreadable"]);
});

test("narrowEnableFailure gives a direct ENOENT precedence over its nested cause", () => {
  // arrange
  const nested: NodeJS.ErrnoException = new Error("access denied");
  nested.code = "EACCES";
  const cause: NodeJS.ErrnoException = new Error("source gone", { cause: nested });
  cause.code = "ENOENT";

  // act
  const reasons = narrowEnableFailure(cause);

  // assert
  assert.deepStrictEqual(reasons, ["source missing"]);
});

test("narrowEnableFailure classifies a nested ENOENT as source missing", () => {
  // arrange
  const nested: NodeJS.ErrnoException = new Error("source gone");
  nested.code = "ENOENT";
  const cause = new Error("enable failed", { cause: nested });

  // act
  const reasons = narrowEnableFailure(cause);

  // assert
  assert.deepStrictEqual(reasons, ["source missing"]);
});

test("narrowEnableFailure keeps an unsupported direct errno brace-less", () => {
  // arrange
  const cause: NodeJS.ErrnoException = new Error("access denied");
  cause.code = "EACCES";

  // act
  const reasons = narrowEnableFailure(cause);

  // assert
  assert.deepStrictEqual(reasons, []);
});

test("narrowEnableFailure keeps an unsupported nested errno brace-less", () => {
  // arrange
  const nested: NodeJS.ErrnoException = new Error("input output failure");
  nested.code = "EIO";
  const cause = new Error("enable failed", { cause: nested });

  // act
  const reasons = narrowEnableFailure(cause);

  // assert
  assert.deepStrictEqual(reasons, []);
});

test("narrowEnableFailure keeps a non-Error nested throw brace-less", () => {
  // arrange
  const cause = new Error("enable failed", { cause: "thrown string" });

  // act
  const reasons = narrowEnableFailure(cause);

  // assert
  assert.deepStrictEqual(reasons, []);
});

test("narrowEnableFailure keeps a plain Error brace-less", () => {
  // arrange
  const cause = new Error("enable failed");

  // act
  const reasons = narrowEnableFailure(cause);

  // assert
  assert.deepStrictEqual(reasons, []);
});

test("narrowEnableFailure classifies a missing clone directory as source missing", () => {
  // arrange
  const cause = new PluginShapeError({
    kind: "not-installable",
    plugin: "foo",
    reasons: ["source dir does not exist: /tmp/mp/plugins/foo"],
    partialable: false,
    unsupportedKinds: [],
  });

  // act
  const reasons = narrowEnableFailure(cause);

  // assert
  assert.deepStrictEqual(reasons, ["source missing"]);
});

test("narrowEnableFailure keeps an unrelated not-installable shape brace-less", () => {
  // arrange
  const cause = new PluginShapeError({
    kind: "not-installable",
    plugin: "foo",
    reasons: ["contains lspServers"],
    partialable: true,
    unsupportedKinds: ["lspServers"],
  });

  // act
  const reasons = narrowEnableFailure(cause);

  // assert
  assert.deepStrictEqual(reasons, []);
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
  const renderedRow = staleGateDropped(cause);

  // assert
  assert.equal(renderedRow, undefined);
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
  const renderedRow = staleGateDropped(cause);

  // assert
  assert.equal(renderedRow, undefined);
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
  const renderedRow = staleGateDropped(cause);

  // assert
  assert.equal(renderedRow, undefined);
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
  const renderedRow = staleGateDropped(cause);

  // assert
  assert.equal(renderedRow, undefined);
});

test("staleGateDropped ignores a plain Error", () => {
  // arrange
  const cause = new Error("enable failed");

  // act
  const renderedRow = staleGateDropped(cause);

  // assert
  assert.equal(renderedRow, undefined);
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
  const renderedRow = staleGateDropped(cause);

  // assert
  assert.deepStrictEqual(renderedRow, [
    "lsp",
    "unsupported hooks",
    "unsupported mcp",
    "unsupported component",
  ]);
});

test("ENABLE_CONTEXT declares complete row policies", () => {
  // act
  const policies = ENABLE_CONTEXT.rowPolicies;

  // assert
  assert.deepStrictEqual(policies, {
    installed: { markers: true, contentReasons: true },
    "partially-installed": { markers: true, contentReasons: true },
    skipped: { markers: false, contentReasons: true },
    failed: { markers: false, contentReasons: true },
  });
});

test("DISABLE_CONTEXT declares complete row policies", () => {
  // act
  const policies = DISABLE_CONTEXT.rowPolicies;

  // assert
  assert.deepStrictEqual(policies, {
    disabled: { markers: false, contentReasons: true },
    skipped: { markers: false, contentReasons: true },
    failed: { markers: false, contentReasons: true },
  });
});

describe("composeEnableCascadeRows", () => {
  test("a root with no cascade members composes to exactly the root row", () => {
    // arrange
    const rootRow = {
      status: "installed",
      name: "helper",
      dependencies: [],
      version: "1.0.0",
      severity: "info",
      needsReload: true,
    } satisfies EnableMsg;

    // act
    const rows = composeEnableCascadeRows({ scope: "user", rootRow, members: [] });

    // assert
    assert.deepStrictEqual(rows, [rootRow]);
  });

  test("sorts the root among its members by the canonical name-then-scope comparator", () => {
    // arrange
    const rootRow = {
      status: "installed",
      name: "helper",
      dependencies: [],
      version: "1.0.0",
      severity: "info",
      needsReload: true,
    } satisfies EnableMsg;
    const memberRow = {
      status: "installed",
      name: "formatter@tools",
      version: "2.1.0",
      dependencies: [],
      reasons: ["dependency enabled"],
      severity: "info",
      needsReload: true,
    } satisfies EnableCascadeMemberRow;

    // act
    const rows = composeEnableCascadeRows({ scope: "user", rootRow, members: [memberRow] });

    // assert
    assert.deepStrictEqual(rows, [memberRow, rootRow]);
  });

  test("D-SG-22: gives the root row its subject's clone note and each re-enabled member row its key's", () => {
    // arrange
    const notes = createGitHubCloneNotes();
    const rootClone = {
      note: "ssh-not-configured",
      url: "https://github.com/acme/helper.git",
    } as const;
    const memberClone = { note: "via-ssh", url: "git@github.com:acme/formatter.git" } as const;
    notes.record("helper@official", rootClone);
    notes.record("formatter@tools", memberClone);
    const rootRow = {
      status: "installed",
      name: "helper",
      dependencies: [],
      version: "1.0.0",
      severity: "info",
      needsReload: true,
    } satisfies EnableMsg;
    const clonedMember = {
      status: "installed",
      name: "formatter@tools",
      version: "2.1.0",
      dependencies: [],
      reasons: ["dependency enabled"],
      severity: "info",
      needsReload: true,
    } satisfies EnableCascadeMemberRow;
    const keptMember = { ...clonedMember, name: "linter@tools" } satisfies EnableCascadeMemberRow;
    const skippedMember = {
      status: "skipped",
      name: "helper@official",
      version: "1.0.0",
      reasons: ["already enabled"],
      severity: "info",
      needsReload: false,
    } satisfies EnableCascadeMemberRow;

    // act
    const rows = composeEnableCascadeRows({
      scope: "user",
      rootRow,
      members: [keptMember, clonedMember, skippedMember],
      clones: { notes, rootSubject: "helper@official" },
    });

    // assert
    assert.deepStrictEqual(rows, [
      { ...clonedMember, clone: memberClone },
      { ...rootRow, clone: rootClone },
      skippedMember,
      keptMember,
    ]);
  });

  test("carries a skipped already-enabled member row through unchanged", () => {
    // arrange
    const rootRow = {
      status: "skipped",
      name: "helper",
      reasons: ["already enabled"],
      severity: "info",
      needsReload: false,
    } satisfies EnableMsg;
    const memberRow = {
      status: "skipped",
      name: "formatter@tools",
      version: "2.1.0",
      reasons: ["already enabled"],
      severity: "info",
      needsReload: false,
    } satisfies EnableCascadeMemberRow;

    // act
    const rows = composeEnableCascadeRows({ scope: "user", rootRow, members: [memberRow] });

    // assert
    assert.deepStrictEqual(rows, [memberRow, rootRow]);
  });
});

test("the disable context renders the dependents-remain refusal reason", () => {
  // arrange
  const cause = new Error("Disable helper@official first, then shared-lib@official.");
  const row = {
    status: "failed",
    severity: "error",
    needsReload: false,
    name: "shared-lib",
    reasons: ["dependents remain"],
    cause,
  } as const satisfies DisableMsg;

  // act
  const [resolved] = resolveRows(
    [{ name: "official", scope: "user", plugins: [row] }],
    runWithNothingLoaded().softDeps,
    DISABLE_CONTEXT.rowPolicies,
  );
  const renderedRow = composePluginLines(resolved!.plugins[0]!, "user")[0]!.slice(2);

  // assert
  assert.equal(renderedRow, "⊘ shared-lib (failed) {dependents remain}");
});

describe("composeEnableMissingDependencyCause", () => {
  test("names the missing dependencies, then the target", () => {
    // act
    const cause = composeEnableMissingDependencyCause("app@official", [
      "lib@official",
      "util@tools",
    ]);

    // assert
    assert.equal(cause, "Install lib@official, util@tools first, then enable app@official.");
  });
});

describe("composeDisableRefusalCause", () => {
  test("names one dependent and the target, in disable order", () => {
    // act
    const cause = composeDisableRefusalCause("shared-lib@official", ["helper@official"]);

    // assert
    assert.equal(cause, "Disable helper@official first, then shared-lib@official.");
  });

  test("names two sorted dependents joined by comma, before the target", () => {
    // act
    const cause = composeDisableRefusalCause("shared-lib@official", [
      "alpha@official",
      "zeta@official",
    ]);

    // assert
    assert.equal(cause, "Disable alpha@official, zeta@official first, then shared-lib@official.");
    assert.ok(!cause.includes("&&"));
  });

  test("T-08-06: counts the dependents when one key could close the sentence's quote", () => {
    // act
    const cause = composeDisableRefusalCause("shared-lib@official", [
      'alpha" and disable "victim@official',
      "zeta@official",
    ]);

    // assert
    assert.equal(cause, "Disable 2 other plugins first, then shared-lib@official.");
    assert.ok(!cause.includes('alpha" and disable "victim@official'));
  });

  test("T-08-06: counts a single unrenderable dependent in the singular", () => {
    // act
    const cause = composeDisableRefusalCause("shared-lib@official", ["alpha@official@extra"]);

    // assert
    assert.equal(cause, "Disable 1 other plugin first, then shared-lib@official.");
    assert.ok(!cause.includes("alpha@official@extra"));
  });
});

describe("composeEnableCascadeRows clone notes", () => {
  test("D-SG-22: gives a partially installed or failed root row its subject's clone note", () => {
    // arrange
    const notes = createGitHubCloneNotes();
    const clone = { note: "via-https", url: "https://github.com/acme/helper.git" } as const;
    notes.record("helper@official", clone);
    const rootRows: readonly EnableMsg[] = [
      {
        status: "partially-installed",
        name: "helper",
        dependencies: [],
        reasons: ["lsp"],
        severity: "info",
        needsReload: true,
      },
      {
        status: "failed",
        name: "helper",
        reasons: [],
        severity: "error",
        needsReload: false,
      },
    ];

    // act
    const composed = rootRows.map((rootRow) =>
      composeEnableCascadeRows({
        scope: "user",
        rootRow,
        members: [],
        clones: { notes, rootSubject: "helper@official" },
      }),
    );

    // assert
    assert.deepStrictEqual(
      composed,
      rootRows.map((rootRow) => [{ ...rootRow, clone }]),
    );
  });

  test("D-SG-22: gives a failed root row the clone note of the cascade member that failed, labelled with its key", () => {
    // arrange
    const notes = createGitHubCloneNotes();
    const memberClone = {
      note: "ssh-not-configured",
      url: "https://github.com/acme/formatter.git",
      retries: ["git@github.com:acme/formatter.git"],
    } as const;
    notes.record("helper@official", { note: "via-ssh", url: "git@github.com:acme/helper.git" });
    notes.record("formatter@tools", memberClone);
    const rootRow: EnableMsg = {
      status: "failed",
      name: "helper",
      reasons: [],
      severity: "error",
      needsReload: false,
    };

    // act
    const rows = composeEnableCascadeRows({
      scope: "user",
      rootRow,
      members: [],
      clones: { notes, rootSubject: "helper@official", failingMember: "formatter@tools" },
    });

    // assert
    assert.deepStrictEqual(rows, [
      { ...rootRow, clone: { ...memberClone, plugin: "formatter@tools" } },
    ]);
  });

  test("D-SG-22: leaves a failed root row unchanged when the member that failed cloned nothing over GitHub", () => {
    // arrange
    const notes = createGitHubCloneNotes();
    notes.record("helper@official", { note: "via-ssh", url: "git@github.com:acme/helper.git" });
    const rootRow: EnableMsg = {
      status: "failed",
      name: "helper",
      reasons: [],
      severity: "error",
      needsReload: false,
    };

    // act
    const [row] = composeEnableCascadeRows({
      scope: "user",
      rootRow,
      members: [],
      clones: { notes, rootSubject: "helper@official", failingMember: "formatter@tools" },
    });

    // assert
    assert.equal(row, rootRow);
  });

  test("D-SG-22: leaves a skipped root row, and a root whose subject cloned nothing, unchanged", () => {
    // arrange
    const notes = createGitHubCloneNotes();
    notes.record("helper@official", { note: "via-ssh", url: "git@github.com:acme/helper.git" });
    const skipped: EnableMsg = {
      status: "skipped",
      name: "helper",
      reasons: ["already enabled"],
      severity: "info",
      needsReload: false,
    };
    const installed: EnableMsg = {
      status: "installed",
      name: "quiet",
      dependencies: [],
      severity: "info",
      needsReload: true,
    };

    // act
    const [skippedRows, quietRows] = [
      composeEnableCascadeRows({
        scope: "user",
        rootRow: skipped,
        members: [],
        clones: { notes, rootSubject: "helper@official" },
      }),
      composeEnableCascadeRows({
        scope: "user",
        rootRow: installed,
        members: [],
        clones: { notes, rootSubject: "quiet@official" },
      }),
    ];

    // assert
    assert.deepStrictEqual(
      [skippedRows?.[0] === skipped, quietRows?.[0] === installed],
      [true, true],
    );
  });
});
