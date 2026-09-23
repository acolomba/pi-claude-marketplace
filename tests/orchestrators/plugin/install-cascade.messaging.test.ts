import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  CASCADE_CONTEXT,
  cascadeFailureCause,
  composeCascadeFailureMessage,
  composeCascadeMemberRows,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts";
import {
  causeChainTrailer,
  DependencyCascadeError,
} from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
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
    fellBackToCurrentCopy: false,
    reEnabledFromRecord: false,
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
      alreadyInstalled: [{ key: "linter@tools", version: "3.0.0" }],
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

  test("EDEP-03 a re-enabled member renders an installed row naming the state change", () => {
    // arrange: `linter` was already installed and disabled; this run
    // re-materialized it through its own record (D-08-02). The row is
    // `installed`, not `skipped` -- the record changed and something was
    // materialized -- and it carries both facts this command is responsible
    // for: the dependency was already here, and it is enabled now.
    const rows = composeCascadeMemberRows({
      scope: "user",
      rootKey: ROOT_KEY,
      rootRow: ROOT_ROW,
      installed: [member({ key: "linter@tools", version: "3.0.0", reEnabledFromRecord: true })],
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
        "  ● linter@tools v3.0.0 (installed) {already installed, dependency enabled}",
        "",
        "/reload to pick up changes",
      ].join("\n"),
    });
  });

  test("EDEP-03 a left-alone member stays the bare idempotent skip", () => {
    // arrange: `linter` is already installed and ENABLED -- the control for
    // the re-enabled case above. An enabled record is a walk wall, so it
    // reaches only this loop and the skip stays the single benign token.
    const rows = composeCascadeMemberRows({
      scope: "user",
      rootKey: ROOT_KEY,
      rootRow: ROOT_ROW,
      installed: [],
      alreadyInstalled: [{ key: "linter@tools", version: "3.0.0" }],
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
        "  ⊘ linter@tools v3.0.0 (skipped) {already installed}",
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

  test("EDEP-03 a re-enabled member takes its alphabetical place beside the root, unchanged by the new arm", () => {
    // arrange: `aardvark@tools` sorts before `helper` -- the row order comes
    // from the canonical name-then-scope comparator, not from which loop
    // composed the row.
    const rows = composeCascadeMemberRows({
      scope: "user",
      rootKey: ROOT_KEY,
      rootRow: ROOT_ROW,
      installed: [member({ key: "aardvark@tools", version: "1.0.0", reEnabledFromRecord: true })],
      alreadyInstalled: [],
      probe: PROBE_BOTH_LOADED,
    });

    // act
    const names = rows.map((row) => row.name);

    // assert
    assert.deepStrictEqual(names, ["aardvark@tools", "helper"]);
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
      alreadyInstalled: [{ key: "linter@tools", version: undefined }],
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

  test("TAGS-02 / D-07-03 a member that fell back to the marketplace's current copy names it as a quiet note", () => {
    // arrange
    const rows = composeCascadeMemberRows({
      scope: "user",
      rootKey: ROOT_KEY,
      rootRow: ROOT_ROW,
      installed: [member({ fellBackToCurrentCopy: true })],
      alreadyInstalled: [],
      probe: PROBE_BOTH_LOADED,
    });

    // act
    const installedRow = rows.find((row) => row.name === "formatter@tools");
    const rootRow = rows.find((row) => row.name === "helper");

    // assert: an exact array equality, so a failure-class token riding along
    // would fail the assertion.
    assert.ok(installedRow?.status === "installed");
    assert.deepStrictEqual(installedRow.reasons, ["dependency current copy"]);
    assert.strictEqual(installedRow.severity, "info");
    // the requesting plugin's own row is untouched.
    assert.deepStrictEqual(rootRow, ROOT_ROW);
  });

  test("TAGS-02 / D-07-03 the fallback never overwrites a genuine companion degradation", () => {
    // arrange: the SAME fallback member also declares an unloaded companion --
    // the fallback names itself without raising or lowering the companion
    // probe's own verdict.
    const rows = composeCascadeMemberRows({
      scope: "user",
      rootKey: ROOT_KEY,
      rootRow: ROOT_ROW,
      installed: [member({ fellBackToCurrentCopy: true, declaresAgents: true })],
      alreadyInstalled: [],
      probe: PROBE_NO_AGENTS,
    });

    // act
    const installedRow = rows.find((row) => row.name === "formatter@tools");

    // assert
    assert.ok(installedRow?.status === "installed");
    assert.deepStrictEqual(installedRow.reasons, ["dependency current copy"]);
    assert.strictEqual(installedRow.severity, "warning");
  });

  test("TAGS-02 a member that did NOT fall back renders byte-identically to today's row", () => {
    // arrange
    const rows = composeCascadeMemberRows({
      scope: "user",
      rootKey: ROOT_KEY,
      rootRow: ROOT_ROW,
      installed: [member({ fellBackToCurrentCopy: false })],
      alreadyInstalled: [],
      probe: PROBE_BOTH_LOADED,
    });

    // act
    const installedRow = rows.find((row) => row.name === "formatter@tools");

    // assert: no `reasons` key at all -- not an empty array.
    assert.ok(installedRow?.status === "installed");
    assert.ok(!("reasons" in installedRow), "a non-fallback row carries no reasons key");
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

  test("XMKT-01 a foreign refusal names its declarer and root marketplace with both remedies", () => {
    const subject: CascadeFailureSubject = {
      kind: "closure",
      failure: {
        ok: false,
        reason: "cross-marketplace",
        key: "formatter@tools",
        requiredBy: "bridge@beta",
        marketplace: "tools",
        rootMarketplace: "official",
      },
    };

    const emitted = emit(failureRows(subject), BOTH_LOADED);

    assert.deepStrictEqual(emitted, {
      severity: "error",
      message: [
        "Some plugin operations have failed.",
        "",
        "● official [user]",
        "  ⊘ formatter@tools (failed) {cross-marketplace}",
        '    cause: Dependency "formatter@tools", declared by "bridge@beta", is from marketplace "tools", which root marketplace "official" does not allow. Install "formatter@tools" manually first, or add "tools" to allowCrossMarketplaceDependenciesOn in the marketplace.json for root marketplace "official".',
        "  ⊘ helper (failed) {dependency failed}",
      ].join("\n"),
    });
  });

  test("XMKT-01 a policy refusal on the root key emits one failed subject row", () => {
    const subject: CascadeFailureSubject = {
      kind: "closure",
      failure: {
        ok: false,
        reason: "cross-marketplace",
        key: ROOT_KEY,
        requiredBy: "bridge@beta",
        marketplace: "official",
        rootMarketplace: "alpha",
      },
    };

    const rows = failureRows(subject);
    const emitted = emit(rows, BOTH_LOADED);

    assert.strictEqual(rows.length, 1);
    assert.deepStrictEqual(emitted, {
      severity: "error",
      message: [
        "A plugin operation has failed.",
        "",
        "● official [user]",
        "  ⊘ helper (failed) {cross-marketplace}",
        '    cause: Dependency "helper@official", declared by "bridge@beta", is from marketplace "official", which root marketplace "alpha" does not allow. Install "helper@official" manually first, or add "official" to allowCrossMarketplaceDependenciesOn in the marketplace.json for root marketplace "alpha".',
      ].join("\n"),
    });
    assert.deepStrictEqual(
      rows.map((row) => row.needsReload),
      [false],
    );
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
  test("XMKT-01 carries the transitive declarer and original policy root into the thrown cause", () => {
    const subject: CascadeFailureSubject = {
      kind: "closure",
      failure: {
        ok: false,
        reason: "cross-marketplace",
        key: "formatter@tools",
        requiredBy: "bridge@beta",
        marketplace: "tools",
        rootMarketplace: "official",
      },
    };

    const thrown = cascadeFailureCause(subject, ROOT_KEY);
    const rows = failureRows(subject);
    const failed = rows.find((row) => row.name === "formatter@tools");

    assert.ok(thrown instanceof DependencyCascadeError);
    assert.strictEqual(thrown.key, "formatter@tools");
    assert.strictEqual(
      thrown.message,
      'Dependency "formatter@tools", declared by "bridge@beta", is from marketplace "tools", which root marketplace "official" does not allow. Install "formatter@tools" manually first, or add "tools" to allowCrossMarketplaceDependenciesOn in the marketplace.json for root marketplace "official".',
    );
    assert.ok(failed !== undefined && "cause" in failed);
    assert.strictEqual(failed.cause?.message, thrown.message);
    assert.deepStrictEqual(
      rows.map((row) => row.needsReload),
      [false, false],
    );
    assert.deepStrictEqual(
      rows.map((row) => row.severity),
      ["error", "error"],
    );
  });

  test("hands the orchestrator the same Error the rendered row carries", () => {
    // arrange
    const subject: CascadeFailureSubject = {
      kind: "constraint",
      failure: { kind: "no-matching-tag", key: "formatter@tools", range: "^2.0.0" },
    };

    // act
    const thrown = cascadeFailureCause(subject, ROOT_KEY);
    const rendered = failureRows(subject).find((row) => row.name === "formatter@tools");

    // assert: RESV-06 -- a constraint failure is DependencyCascadeError, keyed
    // to the failing dependency, so a reconcile-driven outcome can classify it
    // as {dependency failed}.
    assert.ok(thrown instanceof DependencyCascadeError);
    assert.strictEqual(thrown.key, "formatter@tools");
    assert.strictEqual(
      thrown.message,
      'Dependency "formatter@tools" has no release tag satisfying "^2.0.0".',
    );
    assert.ok(rendered !== undefined && "cause" in rendered);
    assert.strictEqual(rendered.cause?.message, thrown.message);
  });

  test("RESV-06 wraps a closure failure's cause in DependencyCascadeError keyed to the failing dependency", () => {
    // arrange
    const subject: CascadeFailureSubject = {
      kind: "closure",
      failure: { ok: false, reason: "not-found", key: "formatter@tools", requiredBy: ROOT_KEY },
    };

    // act
    const thrown = cascadeFailureCause(subject, ROOT_KEY);

    // assert
    assert.ok(thrown instanceof DependencyCascadeError);
    assert.strictEqual(thrown.key, "formatter@tools");
    assert.strictEqual(
      thrown.message,
      'Dependency "formatter@tools" is not declared by its marketplace.',
    );
  });

  test("RESV-06 hands the requesting plugin's own ledger failure through untouched", () => {
    // arrange: subject.key === rootKey -- the ledger's own error IS the fact,
    // so classification for a plugin's own (non-dependency) failure is
    // unaffected.
    const error = new Error("staging failed");
    const subject: CascadeFailureSubject = {
      kind: "member",
      key: ROOT_KEY,
      error,
      rollbackPartials: [],
    };

    // act
    const thrown = cascadeFailureCause(subject, ROOT_KEY);

    // assert
    assert.strictEqual(thrown, error);
  });

  test("RESV-06 wraps a dependency's own ledger failure in DependencyCascadeError with the cause-chain trailer byte-identical", () => {
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

    // assert: chaining `error` itself would repeat its message as two
    // consecutive links, so the wrapper reuses `error`'s own message and
    // moves straight to its cause -- the rendered trailer stays
    // byte-identical to `error`'s own.
    assert.ok(thrown instanceof DependencyCascadeError);
    assert.strictEqual(thrown.key, "formatter@tools");
    assert.strictEqual(causeChainTrailer(thrown), causeChainTrailer(error));
  });
});
