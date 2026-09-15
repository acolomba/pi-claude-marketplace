import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  CASCADE_CONTEXT,
  cascadeFailureCause,
  composeCascadeFailureMessage,
  composeCascadeMemberRows,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts";
import { notifyWithContext } from "../../../extensions/pi-claude-marketplace/shared/notify-context.ts";

import type {
  CascadeFailureSubject,
  CascadeInstalledRow,
  CascadeMsg,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts";
import type { InstallMsg } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts";
import type {
  NotificationContext,
  SoftDepStatus,
  ToolInventory,
  ToolInventoryItem,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

/**
 * tests/orchestrators/plugin/install-cascade.messaging.test.ts -- the
 * dependency cascade's rendered-byte contract (RESV-01 / RESV-06).
 *
 * Every case drives the composed rows through `notifyWithContext` and the
 * cascade's own `CommandContext`, then compares the WHOLE emitted notification
 * rather than one row of it. That is deliberate: a filtered assertion would
 * conceal a second block, a missing member row, or a reload trailer that fired
 * when nothing landed. The expected strings here are the same bytes
 * `docs/output-catalog.md` records for the matching catalog state, which the
 * catalog contract independently drives through the dispatcher.
 */

const BOTH_LOADED: readonly ToolInventoryItem[] = [{ name: "subagent" }, { name: "mcp" }];
const MCP_ONLY: readonly ToolInventoryItem[] = [{ name: "mcp" }];
const PROBE_BOTH_LOADED: SoftDepStatus = { piSubagentsLoaded: true, piMcpAdapterLoaded: true };
const PROBE_NO_AGENTS: SoftDepStatus = { piSubagentsLoaded: false, piMcpAdapterLoaded: true };

/** One captured emission: the composed body plus the severity argument. */
interface Emission {
  readonly message: string;
  readonly severity: "info" | "warning" | "error";
}

/**
 * Drive one cascade block through the real dispatch seam and capture what
 * reached the host. `info` is reported as the word rather than as the absent
 * second argument so a case states its severity in the same shape whatever it
 * expects.
 */
function emit(rows: readonly CascadeMsg[], tools: readonly ToolInventoryItem[]): Emission {
  const captured: Emission[] = [];
  const ctx: NotificationContext = {
    ui: {
      notify: (message: string, severity?: "info" | "warning" | "error"): void => {
        captured.push({ message, severity: severity ?? "info" });
      },
    },
  };
  const pi: ToolInventory = { getAllTools: () => tools };

  notifyWithContext(
    ctx,
    pi,
    CASCADE_CONTEXT,
    [{ name: "official", scope: "user", plugins: rows }],
    undefined,
    "single",
  );

  const [emitted] = captured;
  assert.ok(emitted !== undefined, "a cascade block emits exactly one notification");
  assert.strictEqual(captured.length, 1, "a cascade block emits exactly one notification");
  return emitted;
}

const ROOT_KEY = "helper@official";
const ROOT_ROW: InstallMsg = {
  status: "installed",
  name: "helper",
  dependencies: [],
  version: "1.0.0",
  severity: "info",
  needsReload: true,
};

function member(overrides: Partial<CascadeInstalledRow> = {}): CascadeInstalledRow {
  return {
    key: "formatter@tools",
    version: "2.1.0",
    declaresAgents: false,
    declaresMcp: false,
    ...overrides,
  };
}

function failureRows(subject: CascadeFailureSubject): readonly CascadeMsg[] {
  return composeCascadeFailureMessage({
    scope: "user",
    rootKey: ROOT_KEY,
    rootName: "helper",
    subject,
  });
}

describe("CASCADE_CONTEXT", () => {
  test("adds exactly the RESV-05 skip arm to install's own render map", () => {
    // arrange
    const expectedArms = [
      "disabled",
      "failed",
      "installed",
      "partially-available",
      "partially-installed",
      "skipped",
      "unavailable",
    ];

    // act
    const shape = {
      label: CASCADE_CONTEXT.Messaging.label,
      renderArms: Object.keys(CASCADE_CONTEXT.render).sort(),
    };

    // assert
    assert.deepStrictEqual(shape, { label: "Plugin install", renderArms: expectedArms });
  });
});

describe("composeCascadeMemberRows", () => {
  test("a plugin that declares nothing renders the single row it always did", () => {
    // arrange
    const rows = composeCascadeMemberRows({
      scope: "user",
      rootKey: ROOT_KEY,
      rootRow: ROOT_ROW,
      installed: [],
      alreadyInstalled: [],
      probe: PROBE_BOTH_LOADED,
    });

    // act
    const emitted = emit(rows, BOTH_LOADED);

    // assert
    assert.deepStrictEqual(emitted, {
      severity: "info",
      message: [
        "● official [user]",
        "  ● helper v1.0.0 (installed)",
        "",
        "/reload to pick up changes",
      ].join("\n"),
    });
  });

  test("RESV-01 / RESV-05 one row per member, with the skip readable apart from the install", () => {
    // arrange
    const rows = composeCascadeMemberRows({
      scope: "user",
      rootKey: ROOT_KEY,
      rootRow: ROOT_ROW,
      installed: [member()],
      alreadyInstalled: [{ key: "linter@tools", version: "3.0.0", disabled: false }],
      probe: PROBE_BOTH_LOADED,
    });

    // act
    const emitted = emit(rows, BOTH_LOADED);

    // assert: the catalog's `dependency-cascade-success` bytes.
    assert.deepStrictEqual(emitted, {
      severity: "info",
      message: [
        "● official [user]",
        "  ● formatter@tools v2.1.0 (installed)",
        "  ● helper v1.0.0 (installed)",
        "  ⊘ linter@tools v3.0.0 (skipped) {already installed}",
        "",
        "/reload to pick up changes",
      ].join("\n"),
    });
  });

  test("RESV-05 a skipped member whose record is disabled names it and raises the block", () => {
    // arrange: a disabled record keeps its inventory and its name reservations
    // while its artifacts are off disk, so the requesting plugin installed
    // against a dependency that materialized nothing. Reported as the bare
    // idempotent skip, the block tells the user everything is fine.
    const rows = composeCascadeMemberRows({
      scope: "user",
      rootKey: ROOT_KEY,
      rootRow: ROOT_ROW,
      installed: [],
      alreadyInstalled: [{ key: "linter@tools", version: "3.0.0", disabled: true }],
      probe: PROBE_BOTH_LOADED,
    });

    // act
    const emitted = emit(rows, BOTH_LOADED);

    // assert
    assert.deepStrictEqual(emitted, {
      severity: "warning",
      message: [
        "A plugin operation needs attention.",
        "",
        "● official [user]",
        "  ● helper v1.0.0 (installed)",
        "  ⊘ linter@tools v3.0.0 (skipped) {already installed, dependency disabled}",
        "",
        "/reload to pick up changes",
      ].join("\n"),
    });
  });

  test("the root's own closure entry renders once, not twice", () => {
    // arrange: the cascade's phase array ENDS at the root, so the root is a
    // member of `installed` as well as the subject of `rootRow`.
    const rows = composeCascadeMemberRows({
      scope: "user",
      rootKey: ROOT_KEY,
      rootRow: ROOT_ROW,
      installed: [member({ key: ROOT_KEY, version: "1.0.0" }), member()],
      alreadyInstalled: [],
      probe: PROBE_BOTH_LOADED,
    });

    // act
    const names = rows.map((row) => row.name);

    // assert
    assert.deepStrictEqual(names, ["formatter@tools", "helper"]);
  });

  test("SEV-01 a member's unloaded companion marks its own row and raises the block", () => {
    // arrange
    const rows = composeCascadeMemberRows({
      scope: "user",
      rootKey: ROOT_KEY,
      rootRow: ROOT_ROW,
      installed: [member({ declaresAgents: true, declaresMcp: true })],
      alreadyInstalled: [],
      probe: PROBE_NO_AGENTS,
    });

    // act
    const emitted = emit(rows, MCP_ONLY);

    // assert
    assert.deepStrictEqual(emitted, {
      severity: "warning",
      message: [
        "A plugin operation needs attention.",
        "",
        "● official [user]",
        "  ● formatter@tools v2.1.0 (installed) {requires pi-subagents}",
        "  ● helper v1.0.0 (installed)",
        "",
        "/reload to pick up changes",
      ].join("\n"),
    });
  });

  test("RESV-05 a skipped member the snapshot records no version for renders bare", () => {
    // arrange
    const rows = composeCascadeMemberRows({
      scope: "user",
      rootKey: ROOT_KEY,
      rootRow: ROOT_ROW,
      installed: [],
      alreadyInstalled: [{ key: "linter@tools", version: undefined, disabled: false }],
      probe: PROBE_BOTH_LOADED,
    });

    // act
    const emitted = emit(rows, BOTH_LOADED);

    // assert
    assert.deepStrictEqual(emitted, {
      severity: "info",
      message: [
        "● official [user]",
        "  ● helper v1.0.0 (installed)",
        "  ⊘ linter@tools (skipped) {already installed}",
        "",
        "/reload to pick up changes",
      ].join("\n"),
    });
  });
});

describe("composeCascadeFailureMessage", () => {
  test("RESV-04 a cycle renders the whole chain including the repeated key", () => {
    // arrange
    const subject: CascadeFailureSubject = {
      kind: "closure",
      failure: {
        ok: false,
        reason: "cycle",
        chain: [ROOT_KEY, "formatter@tools", "linter@tools", "formatter@tools"],
      },
    };

    // act
    const emitted = emit(failureRows(subject), BOTH_LOADED);

    // assert: the catalog's `dependency-cycle` bytes.
    assert.deepStrictEqual(emitted, {
      severity: "error",
      message: [
        "Some plugin operations have failed.",
        "",
        "● official [user]",
        "  ⊘ formatter@tools (failed) {dependency cycle}",
        "    cause: Dependency cycle: helper@official -> formatter@tools -> linter@tools -> formatter@tools.",
        "  ⊘ helper (failed) {dependency failed}",
      ].join("\n"),
    });
  });

  test("a cycle the walk reported with no chain still renders one coherent row", () => {
    // arrange
    const subject: CascadeFailureSubject = {
      kind: "closure",
      failure: { ok: false, reason: "cycle", chain: [] },
    };

    // act
    const emitted = emit(failureRows(subject), BOTH_LOADED);

    // assert: the subject falls back to the root, so the block names the plugin
    // the user typed rather than rendering a nameless row.
    assert.deepStrictEqual(emitted, {
      severity: "error",
      message: [
        "A plugin operation has failed.",
        "",
        "● official [user]",
        "  ⊘ helper (failed) {dependency cycle}",
        "    cause: Dependency cycle: .",
      ].join("\n"),
    });
  });

  test("RESV-02 an unadded marketplace names the marketplace and the command that adds it", () => {
    // arrange
    const subject: CascadeFailureSubject = {
      kind: "closure",
      failure: {
        ok: false,
        reason: "marketplace-not-added",
        key: "formatter@tools",
        marketplace: "tools",
        requiredBy: ROOT_KEY,
      },
    };

    // act
    const emitted = emit(failureRows(subject), BOTH_LOADED);

    // assert: the catalog's `dependency-marketplace-not-added` bytes.
    assert.deepStrictEqual(emitted, {
      severity: "error",
      message: [
        "Some plugin operations have failed.",
        "",
        "● official [user]",
        "  ⊘ formatter@tools (failed) {dependency marketplace not added}",
        '    cause: Dependency "formatter@tools" requires marketplace "tools", which is not added. Run marketplace add <source> to add it.',
        "  ⊘ helper (failed) {dependency failed}",
      ].join("\n"),
    });
  });

  test("a dependency its marketplace does not declare reuses the inherited token", () => {
    // arrange
    const subject: CascadeFailureSubject = {
      kind: "closure",
      failure: { ok: false, reason: "not-found", key: "formatter@tools", requiredBy: ROOT_KEY },
    };

    // act
    const emitted = emit(failureRows(subject), BOTH_LOADED);

    // assert: the catalog's `dependency-not-in-manifest` bytes.
    assert.deepStrictEqual(emitted, {
      severity: "error",
      message: [
        "Some plugin operations have failed.",
        "",
        "● official [user]",
        "  ⊘ formatter@tools (failed) {not in manifest}",
        '    cause: Dependency "formatter@tools" is not declared by its marketplace.',
        "  ⊘ helper (failed) {dependency failed}",
      ].join("\n"),
    });
  });

  test("an unusable declaration on the requesting plugin renders one row, not two", () => {
    // arrange
    const subject: CascadeFailureSubject = {
      kind: "closure",
      failure: {
        ok: false,
        reason: "unusable-declaration",
        key: ROOT_KEY,
        detail: "dependencies.0: Invalid input",
      },
    };

    // act
    const emitted = emit(failureRows(subject), BOTH_LOADED);

    // assert: the catalog's `dependency-unusable-declaration` bytes. One
    // subject cannot be the reason for itself, so there is no second row.
    assert.deepStrictEqual(emitted, {
      severity: "error",
      message: [
        "A plugin operation has failed.",
        "",
        "● official [user]",
        "  ⊘ helper (failed) {invalid manifest}",
        '    cause: Plugin "helper@official" declares an unusable dependency (dependencies.0: Invalid input).',
      ].join("\n"),
    });
  });

  test("RESV-03 contradictory declarations name the joined declared ranges", () => {
    // arrange
    const subject: CascadeFailureSubject = {
      kind: "constraint",
      failure: {
        kind: "range-conflict",
        why: "contradictory-declarations",
        key: "formatter@tools",
        range: "^1.0.0 ^2.0.0",
        detail: "inputs 1 and 2 do not overlap",
      },
    };

    // act
    const emitted = emit(failureRows(subject), BOTH_LOADED);

    // assert: the catalog's `dependency-version-conflict` bytes.
    assert.deepStrictEqual(emitted, {
      severity: "error",
      message: [
        "Some plugin operations have failed.",
        "",
        "● official [user]",
        "  ⊘ formatter@tools (failed) {version conflict}",
        '    cause: Dependency "formatter@tools" has contradictory version constraints "^1.0.0 ^2.0.0" (inputs 1 and 2 do not overlap).',
        "  ⊘ helper (failed) {dependency failed}",
      ].join("\n"),
    });
  });

  test("RESV-05 an unsatisfied installed copy carries its recorded version beside the token", () => {
    // arrange
    const subject: CascadeFailureSubject = {
      kind: "constraint",
      failure: {
        kind: "range-conflict",
        why: "installed-unsatisfied",
        key: "formatter@tools",
        range: "^2.0.0",
        recordedVersion: "1.0.0",
      },
    };

    // act
    const emitted = emit(failureRows(subject), BOTH_LOADED);

    // assert: the catalog's `dependency-installed-version-conflict` bytes.
    assert.deepStrictEqual(emitted, {
      severity: "error",
      message: [
        "Some plugin operations have failed.",
        "",
        "● official [user]",
        "  ⊘ formatter@tools v1.0.0 (failed) {already installed, version conflict}",
        '    cause: Dependency "formatter@tools" is installed at version 1.0.0, which does not satisfy "^2.0.0".',
        "  ⊘ helper (failed) {dependency failed}",
      ].join("\n"),
    });
  });

  test("RESV-03 a constraint no release tag satisfies names the constraint", () => {
    // arrange
    const subject: CascadeFailureSubject = {
      kind: "constraint",
      failure: { kind: "no-matching-tag", key: "formatter@tools", range: "^2.0.0" },
    };

    // act
    const emitted = emit(failureRows(subject), BOTH_LOADED);

    // assert: the catalog's `dependency-no-matching-version` bytes.
    assert.deepStrictEqual(emitted, {
      severity: "error",
      message: [
        "Some plugin operations have failed.",
        "",
        "● official [user]",
        "  ⊘ formatter@tools (failed) {no matching version}",
        '    cause: Dependency "formatter@tools" has no release tag satisfying "^2.0.0".',
        "  ⊘ helper (failed) {dependency failed}",
      ].join("\n"),
    });
  });

  test("RESV-03 a classified listing failure reuses the probe's own transport token", () => {
    // arrange
    const subject: CascadeFailureSubject = {
      kind: "constraint",
      failure: {
        kind: "tag-listing-failed",
        key: "formatter@tools",
        range: "^2.0.0",
        cause: new Error("401"),
        classification: "authentication required",
      },
    };

    // act
    const emitted = emit(failureRows(subject), BOTH_LOADED);

    // assert: the catalog's `dependency-tag-listing-failed` bytes.
    assert.deepStrictEqual(emitted, {
      severity: "error",
      message: [
        "Some plugin operations have failed.",
        "",
        "● official [user]",
        "  ⊘ formatter@tools (failed) {authentication required}",
        '    cause: Dependency "formatter@tools" could not be checked against "^2.0.0" (authentication required).',
        "  ⊘ helper (failed) {dependency failed}",
      ].join("\n"),
    });
  });

  test("RESV-03 an unclassifiable listing failure falls back to the inherited unreadable", () => {
    // arrange
    const subject: CascadeFailureSubject = {
      kind: "constraint",
      failure: {
        kind: "tag-listing-failed",
        key: "formatter@tools",
        range: "^2.0.0",
        cause: new Error("boom"),
        classification: undefined,
      },
    };

    // act
    const emitted = emit(failureRows(subject), BOTH_LOADED);

    // assert
    assert.deepStrictEqual(emitted, {
      severity: "error",
      message: [
        "Some plugin operations have failed.",
        "",
        "● official [user]",
        "  ⊘ formatter@tools (failed) {unreadable}",
        '    cause: Dependency "formatter@tools" could not be checked against "^2.0.0" (tag listing failed).',
        "  ⊘ helper (failed) {dependency failed}",
      ].join("\n"),
    });
  });

  test("RESV-03 an unreadable range is attributed to the declaration, not the document", () => {
    // arrange
    const subject: CascadeFailureSubject = {
      kind: "constraint",
      failure: {
        kind: "range-invalid",
        key: "formatter@tools",
        range: "nope",
        detail: "input 1 of 1 is not a valid version range",
      },
    };

    // act
    const emitted = emit(failureRows(subject), BOTH_LOADED);

    // assert: the catalog's `dependency-invalid-version-constraint` bytes.
    assert.deepStrictEqual(emitted, {
      severity: "error",
      message: [
        "Some plugin operations have failed.",
        "",
        "● official [user]",
        "  ⊘ formatter@tools (failed) {invalid version constraint}",
        '    cause: Dependency "formatter@tools" declares an unparseable version constraint "nope" (input 1 of 1 is not a valid version range).',
        "  ⊘ helper (failed) {dependency failed}",
      ].join("\n"),
    });
  });

  test("RESV-03 a combination past a cap names the cap that tripped", () => {
    // arrange
    const subject: CascadeFailureSubject = {
      kind: "constraint",
      failure: {
        kind: "range-too-complex",
        key: "formatter@tools",
        range: "1.0.0||1.0.1",
        detail: "total input 5400 characters exceeds the 4096 character cap",
      },
    };

    // act
    const emitted = emit(failureRows(subject), BOTH_LOADED);

    // assert: the catalog's `dependency-constraint-too-complex` bytes.
    assert.deepStrictEqual(emitted, {
      severity: "error",
      message: [
        "Some plugin operations have failed.",
        "",
        "● official [user]",
        "  ⊘ formatter@tools (failed) {constraint too complex}",
        '    cause: Dependency "formatter@tools" declares version constraints too complex to combine (total input 5400 characters exceeds the 4096 character cap).',
        "  ⊘ helper (failed) {dependency failed}",
      ].join("\n"),
    });
  });

  test("RESV-06 a member whose own ledger threw carries the ledger's error and no brace", () => {
    // arrange
    const subject: CascadeFailureSubject = {
      kind: "member",
      key: "formatter@tools",
      error: new Error("failed to stage skill a-fmt: EACCES"),
      rollbackPartials: [],
    };

    // act
    const emitted = emit(failureRows(subject), BOTH_LOADED);

    // assert: the catalog's `dependency-install-failed` bytes.
    assert.deepStrictEqual(emitted, {
      severity: "error",
      message: [
        "Some plugin operations have failed.",
        "",
        "● official [user]",
        "  ⊘ formatter@tools (failed)",
        "    cause: failed to stage skill a-fmt: EACCES",
        "  ⊘ helper (failed) {dependency failed}",
      ].join("\n"),
    });
  });

  test("RESV-06 a member whose rollback could not finish names the phases it left behind", () => {
    // arrange
    const subject: CascadeFailureSubject = {
      kind: "member",
      key: "formatter@tools",
      error: new Error("failed to stage skill a-fmt: EACCES"),
      rollbackPartials: [
        {
          phase: "skills",
          msg: "EACCES removing a-fmt",
          cause: new Error("EACCES removing a-fmt"),
        },
        { phase: "agents", msg: "removal reported no error" },
      ],
    };

    // act
    const emitted = emit(failureRows(subject), BOTH_LOADED);

    // assert
    assert.deepStrictEqual(emitted, {
      severity: "error",
      message: [
        "Some plugin operations have failed.",
        "",
        "● official [user]",
        "  ⊘ formatter@tools (failed) {rollback partial}",
        "    cause: failed to stage skill a-fmt: EACCES",
        "    [skills] (rollback failed)",
        "      cause: EACCES removing a-fmt",
        "    [agents] (rollback failed)",
        "  ⊘ helper (failed) {dependency failed}",
      ].join("\n"),
    });
  });
});

describe("cascadeFailureCause", () => {
  test("hands the orchestrator the same Error the rendered row carries", () => {
    // arrange
    const subject: CascadeFailureSubject = {
      kind: "constraint",
      failure: { kind: "no-matching-tag", key: "formatter@tools", range: "^2.0.0" },
    };

    // act
    const thrown = cascadeFailureCause(subject, ROOT_KEY);
    const rendered = failureRows(subject).find((row) => row.name === "formatter@tools");

    // assert
    assert.strictEqual(
      thrown.message,
      'Dependency "formatter@tools" has no release tag satisfying "^2.0.0".',
    );
    assert.ok(rendered !== undefined && "cause" in rendered);
    assert.strictEqual(rendered.cause?.message, thrown.message);
  });

  test("hands a member failure its own ledger error, chain intact", () => {
    // arrange
    const error = new Error("staging failed", { cause: new Error("EACCES") });
    const subject: CascadeFailureSubject = {
      kind: "member",
      key: "formatter@tools",
      error,
      rollbackPartials: [],
    };

    // act
    const thrown = cascadeFailureCause(subject, ROOT_KEY);

    // assert
    assert.strictEqual(thrown, error);
  });
});
