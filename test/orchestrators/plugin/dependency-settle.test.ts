import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  runDependencySteps,
  settleDependencies,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts";
import {
  DependencyCascadeError,
  InvalidGitHubBaseUrlError,
} from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { discoveryWarning } from "../../../extensions/pi-claude-marketplace/shared/staging-warnings.ts";

import type {
  DependencyMoveRequest,
  DependencyPlan,
  DependencyPlanStep,
  PlannedDependencyMove,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-plan.ts";
import type {
  DependencySettlePorts,
  DependencyStepPorts,
  SettleCascadeRun,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts";
import type { CascadeFailureSubject } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts";
import type { PlannedCascadeMember } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts";
import type {
  MovedDependency,
  UpdateDependencyRow,
} from "../../../extensions/pi-claude-marketplace/orchestrators/types.ts";
import type { McpConfigNotice } from "../../../extensions/pi-claude-marketplace/shared/notification-types.ts";

function lib(requesters: DependencyMoveRequest["requesters"]): DependencyMoveRequest {
  return { key: "lib@mp", name: "lib", marketplace: "mp", recordedVersion: "1.0.0", requesters };
}

const LIB = lib([{ key: "app@mp", ranges: ["^2.0.0"] }]);
const LIB_MOVE: PlannedDependencyMove = { request: LIB, version: "2.0.0" };
const HELPER: PlannedCascadeMember = {
  kind: "install",
  member: { key: "helper@mp", name: "helper", marketplace: "mp", requiredBy: "app@mp", ranges: [] },
};
const SUBJECT: CascadeFailureSubject = {
  kind: "member",
  key: "helper@mp",
  error: new Error("helper broke"),
  rollbackPartials: [],
};

function installedRow(name: string): UpdateDependencyRow {
  return {
    status: "installed",
    name,
    dependencies: [],
    version: "1.0.0",
    severity: "info",
    needsReload: true,
  };
}

function updatedRow(name: string): UpdateDependencyRow {
  return {
    status: "updated",
    name,
    from: "1.0.0",
    to: "2.0.0",
    dependencies: [],
    severity: "info",
    needsReload: true,
  };
}

function pinRefreshRow(name: string): UpdateDependencyRow {
  return { ...updatedRow(name), reasons: ["already disabled"], needsReload: false };
}

function failedRow(name: string, cause: Error): UpdateDependencyRow {
  return { status: "failed", name, version: "1.0.0", reasons: [], cause, severity: "error" };
}

function moved(row: UpdateDependencyRow): MovedDependency {
  const [name = "", marketplace = ""] = row.name.split("@");
  return { key: row.name, name, marketplace, row };
}

const REFUSAL_CAUSE = new DependencyCascadeError("helper broke", "helper@mp");
const LIB_DID_NOT_MOVE = new DependencyCascadeError(
  'Dependency "lib@mp" did not move into ^2.0.0.',
  "lib@mp",
);

/** Step ports that record each call and answer from the given doubles. */
function stepPorts(doubles: {
  readonly materialize?: (members: readonly PlannedCascadeMember[]) => Promise<SettleCascadeRun>;
  readonly move?: DependencyStepPorts["move"];
}): DependencyStepPorts & { readonly calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    materialize: (members) => {
      calls.push(`materialize ${members.map((entry) => entry.member.key).join()}`);
      return (
        doubles.materialize?.(members) ??
        Promise.resolve({
          kind: "installed",
          rows: members.map((entry) => installedRow(entry.member.key)),
        })
      );
    },
    move: (move) => {
      calls.push(`move ${move.request.key} ${move.version}`);
      return (
        doubles.move?.(move) ??
        Promise.resolve({ landed: true, rows: [updatedRow(move.request.key)] })
      );
    },
    refusal: (subject) => {
      calls.push(`refusal ${subject.kind}`);
      return { rows: [failedRow("helper@mp", REFUSAL_CAUSE)], cause: REFUSAL_CAUSE };
    },
  };
}

const STEPS: readonly DependencyPlanStep[] = [
  { kind: "materialize", members: [HELPER] },
  { kind: "move", move: LIB_MOVE },
];

const ADAPTER_NOTICE: McpConfigNotice = {
  kind: "comments-dropped",
  scope: "project",
  file: "mcp-adapter.json",
};
const LEGACY_NOTICE: McpConfigNotice = {
  kind: "comments-dropped",
  scope: "project",
  file: "mcp.json",
};
const PACKAGE_WARNING = discoveryWarning("Plugin dependency install failed (npm): no output");
const ZCORE: PlannedCascadeMember = {
  kind: "install",
  member: { ...HELPER.member, key: "zcore@mp", name: "zcore" },
};
const PLAIN: PlannedCascadeMember = {
  kind: "install",
  member: { ...HELPER.member, key: "plain@mp", name: "plain" },
};

/** A closure slice that installs its members, raising the notice `notices` names per member. */
function installingWithNotices(
  notices: Readonly<Record<string, McpConfigNotice>>,
): (members: readonly PlannedCascadeMember[]) => Promise<SettleCascadeRun> {
  return (members) => {
    const raised = members.flatMap((entry) => {
      const notice = notices[entry.member.key];
      return notice === undefined ? [] : [notice];
    });
    return Promise.resolve({
      kind: "installed",
      rows: members.map((entry) => installedRow(entry.member.key)),
      ...(raised.length > 0 && { mcpConfigNotices: raised }),
    });
  };
}

describe("runDependencySteps", () => {
  test("UPD-DEP-D1: runs every step in order and lists each change that landed", async () => {
    // arrange
    const ports = stepPorts({});

    // act
    const ran = await runDependencySteps(STEPS, ports);

    // assert
    assert.deepStrictEqual(ran, {
      ok: true,
      landed: [moved(installedRow("helper@mp")), moved(updatedRow("lib@mp"))],
    });
    assert.deepStrictEqual(ports.calls, ["materialize helper@mp", "move lib@mp 2.0.0"]);
  });

  test("UPD-DEP-D1: a move that does not land stops the rest and lists the changes that landed", async () => {
    // arrange
    const kept = failedRow("lib@mp", new Error("version 1.5.0 is not version 2.0.0"));
    const ports = stepPorts({ move: () => Promise.resolve({ landed: false, rows: [kept] }) });

    // act
    const ran = await runDependencySteps(
      [...STEPS, { kind: "materialize", members: [HELPER] }],
      ports,
    );

    // assert
    assert.deepStrictEqual(ran, {
      ok: false,
      landed: [moved(installedRow("helper@mp")), moved(kept)],
      cause: LIB_DID_NOT_MOVE,
    });
    assert.deepStrictEqual(ports.calls, ["materialize helper@mp", "move lib@mp 2.0.0"]);
  });

  test("IN-N2: a move that does not land names each range it did not move into once", async () => {
    // arrange
    const ports = stepPorts({ move: () => Promise.resolve({ landed: false, rows: [] }) });
    const request = lib([
      { key: "aaa@mp", ranges: ["^2.0.0"] },
      { key: "app@mp", ranges: ["^2.0.0"] },
    ]);

    // act
    const ran = await runDependencySteps(
      [{ kind: "move", move: { request, version: "2.0.0" } }],
      ports,
    );

    // assert
    assert.deepStrictEqual(ran, { ok: false, landed: [], cause: LIB_DID_NOT_MOVE });
  });

  test("UPD-DEP-D1: a closure slice the cascade refuses stops the rest with the refusal's row", async () => {
    // arrange
    const ports = stepPorts({
      materialize: () => Promise.resolve({ kind: "refused", subject: SUBJECT }),
    });

    // act
    const ran = await runDependencySteps(STEPS, ports);

    // assert
    assert.deepStrictEqual(ran, {
      ok: false,
      landed: [moved(failedRow("helper@mp", REFUSAL_CAUSE))],
      cause: REFUSAL_CAUSE,
    });
    assert.deepStrictEqual(ports.calls, ["materialize helper@mp", "refusal member"]);
  });

  test("UPD-DEP-D1: a move that throws fails as a move that did not land, its row carrying what it threw with paths redacted", async () => {
    // arrange
    const thrown = new Error("EACCES: permission denied, copyfile '/home/u/.pi/x/notes.md'");
    const ports = stepPorts({ move: () => Promise.reject(thrown) });

    // act
    const ran = await runDependencySteps(STEPS, ports);

    // assert
    assert.ok(!ran.ok);
    assert.deepStrictEqual(ran.cause, LIB_DID_NOT_MOVE);
    assert.deepStrictEqual(
      ran.landed.map((entry) => [
        entry.key,
        entry.row.status,
        entry.row.status === "failed" ? entry.row.cause?.message : undefined,
      ]),
      [
        ["helper@mp", "installed", undefined],
        ["lib@mp", "failed", "EACCES: permission denied, copyfile '[redacted path]'"],
      ],
    );
  });

  test("UPD-DEP-D1: a closure slice that throws fails with what it threw", async () => {
    // arrange
    const thrown = new Error("state lock held");
    const ports = stepPorts({ materialize: () => Promise.reject(thrown) });

    // act
    const ran = await runDependencySteps(STEPS, ports);

    // assert
    assert.deepStrictEqual(ran, { ok: false, landed: [], cause: thrown });
    assert.deepStrictEqual(ports.calls, ["materialize helper@mp"]);
  });

  test("WR-2: a disabled dependency's re-enable takes the place of its pin refresh", async () => {
    // arrange
    const ddd: PlannedDependencyMove = {
      request: { ...LIB, key: "ddd@mp", name: "ddd" },
      version: "2.0.0",
    };
    const reEnable: PlannedCascadeMember = {
      kind: "re-enable",
      member: { ...HELPER.member, key: "ddd@mp", name: "ddd" },
    };
    const ports = stepPorts({
      move: (move) => Promise.resolve({ landed: true, rows: [pinRefreshRow(move.request.key)] }),
    });

    // act
    const ran = await runDependencySteps(
      [
        { kind: "move", move: ddd },
        { kind: "materialize", members: [reEnable] },
      ],
      ports,
    );

    // assert
    assert.deepStrictEqual(ran, { ok: true, landed: [moved(installedRow("ddd@mp"))] });
  });

  test("WR-2 / GHB-03: an invalid GitHub base override after a pin refresh landed is the move's failure", async () => {
    // arrange
    const invalid = new InvalidGitHubBaseUrlError(
      "PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL",
      "scheme",
    );
    const ddd: PlannedDependencyMove = {
      request: { ...LIB, key: "ddd@mp", name: "ddd" },
      version: "2.0.0",
    };
    const ports = stepPorts({
      move: (move) =>
        move.request.key === "ddd@mp"
          ? Promise.resolve({ landed: true, rows: [pinRefreshRow("ddd@mp")] })
          : Promise.reject(invalid),
    });

    // act
    const ran = await runDependencySteps(
      [
        { kind: "move", move: ddd },
        { kind: "move", move: LIB_MOVE },
      ],
      ports,
    );

    // assert
    assert.ok(!ran.ok);
    assert.deepStrictEqual(
      ran.landed.map((entry) => [entry.key, entry.row.status]),
      [
        ["ddd@mp", "updated"],
        ["lib@mp", "failed"],
      ],
    );
  });

  test("GHB-03: an invalid GitHub base override before any change landed fails the command", async () => {
    // arrange
    const invalid = new InvalidGitHubBaseUrlError(
      "PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL",
      "scheme",
    );
    const ports = stepPorts({ move: () => Promise.reject(invalid) });

    // act & assert
    await assert.rejects(runDependencySteps([{ kind: "move", move: LIB_MOVE }], ports), invalid);
  });

  test("D-PL1-16: the notices of every closure slice that landed ride the result in step order, and a slice or move with none adds none", async () => {
    // arrange
    const ports = stepPorts({
      materialize: installingWithNotices({
        "helper@mp": ADAPTER_NOTICE,
        "zcore@mp": LEGACY_NOTICE,
      }),
    });

    // act
    const ran = await runDependencySteps(
      [
        { kind: "materialize", members: [HELPER] },
        { kind: "move", move: LIB_MOVE },
        { kind: "materialize", members: [PLAIN] },
        { kind: "materialize", members: [ZCORE] },
      ],
      ports,
    );

    // assert
    assert.deepStrictEqual(ran, {
      ok: true,
      landed: [
        moved(installedRow("helper@mp")),
        moved(updatedRow("lib@mp")),
        moved(installedRow("plain@mp")),
        moved(installedRow("zcore@mp")),
      ],
      mcpConfigNotices: [ADAPTER_NOTICE, LEGACY_NOTICE],
    });
  });

  test("D-PL10-16: a moved dependency keeps its warning owner through the step result", async () => {
    // arrange
    const warning = discoveryWarning("dependency skill collision");
    const ports = stepPorts({
      move: () =>
        Promise.resolve({
          landed: true,
          rows: [updatedRow("lib@mp")],
          stagingDiagnostics: [
            {
              plugin: "lib",
              scope: "project",
              verb: "updated",
              warnings: [warning],
            },
          ],
          mcpConfigNotices: [ADAPTER_NOTICE],
        }),
    });

    // act
    const ran = await runDependencySteps([{ kind: "move", move: LIB_MOVE }], ports);

    // assert
    assert.deepStrictEqual(ran, {
      ok: true,
      landed: [moved(updatedRow("lib@mp"))],
      mcpConfigNotices: [ADAPTER_NOTICE],
      stagingDiagnostics: [
        {
          plugin: "lib",
          scope: "project",
          verb: "updated",
          warnings: [warning],
        },
      ],
    });
  });

  test("a materialized closure keeps its dependency warning owner", async () => {
    // arrange
    const ports = stepPorts({
      materialize: (members) =>
        Promise.resolve({
          kind: "installed",
          rows: members.map((entry) => installedRow(entry.member.key)),
          stagingDiagnostics: [
            {
              plugin: "helper",
              scope: "project",
              verb: "installed",
              warnings: [PACKAGE_WARNING],
            },
          ],
        } as SettleCascadeRun),
    });

    // act
    const ran = await runDependencySteps([{ kind: "materialize", members: [HELPER] }], ports);

    // assert
    assert.deepStrictEqual(ran, {
      ok: true,
      landed: [moved(installedRow("helper@mp"))],
      stagingDiagnostics: [
        {
          plugin: "helper",
          scope: "project",
          verb: "installed",
          warnings: [PACKAGE_WARNING],
        },
      ],
    });
  });

  test("D-PL1-16: a move that throws after a slice landed keeps that slice's notices on the failure", async () => {
    // arrange
    const ports = stepPorts({
      materialize: installingWithNotices({ "helper@mp": ADAPTER_NOTICE }),
      move: () => Promise.reject(new Error("clone failed")),
    });

    // act
    const ran = await runDependencySteps(STEPS, ports);

    // assert
    assert.deepStrictEqual(
      [ran.ok, ran.landed.map((entry) => entry.row.status), ran.mcpConfigNotices],
      [false, ["installed", "failed"], [ADAPTER_NOTICE]],
    );
  });

  test("D-PL1-16: a slice that throws after an earlier slice landed keeps the earlier slice's notices", async () => {
    // arrange
    const thrown = new Error("state lock held");
    const ports = stepPorts({
      materialize: (members) =>
        members[0]?.member.key === "helper@mp"
          ? installingWithNotices({ "helper@mp": ADAPTER_NOTICE })(members)
          : Promise.reject(thrown),
    });

    // act
    const ran = await runDependencySteps(
      [
        { kind: "materialize", members: [HELPER] },
        { kind: "materialize", members: [ZCORE] },
      ],
      ports,
    );

    // assert
    assert.deepStrictEqual(ran, {
      ok: false,
      landed: [moved(installedRow("helper@mp"))],
      cause: thrown,
      mcpConfigNotices: [ADAPTER_NOTICE],
    });
  });

  test("GHB-03: an invalid GitHub base override after a change landed is the move's failure", async () => {
    // arrange
    const invalid = new InvalidGitHubBaseUrlError(
      "PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL",
      "scheme",
    );
    const ports = stepPorts({ move: () => Promise.reject(invalid) });

    // act
    const ran = await runDependencySteps(STEPS, ports);

    // assert
    assert.ok(!ran.ok);
    assert.deepStrictEqual(ran.cause, LIB_DID_NOT_MOVE);
    assert.deepStrictEqual(
      ran.landed.map((entry) => [entry.key, entry.row.status]),
      [
        ["helper@mp", "installed"],
        ["lib@mp", "failed"],
      ],
    );
  });
});

/** Settle ports over `steps`, recording the order of every port call. */
function settlePorts(doubles: {
  readonly firstRun: DependencySettlePorts["firstRun"];
  readonly plan?: DependencySettlePorts["plan"];
  readonly steps?: DependencyStepPorts & { readonly calls: string[] };
}): DependencySettlePorts & { readonly calls: string[] } {
  const steps = doubles.steps ?? stepPorts({});
  const calls = steps.calls;
  return {
    calls,
    firstRun: () => {
      calls.push("first run");
      return doubles.firstRun();
    },
    plan: () => {
      calls.push("plan");
      return doubles.plan?.() ?? Promise.reject(new Error("no plan scripted"));
    },
    steps,
    sweepPlanClones: () => {
      calls.push("sweep");
      return Promise.resolve();
    },
  };
}

const PLAN: DependencyPlan = {
  ok: true,
  steps: [{ kind: "move", move: LIB_MOVE }],
  final: { members: [HELPER], alreadyInstalled: [] },
};

describe("settleDependencies", () => {
  test("UPD-DEP-D1: a closure with nothing out of range settles in its first run, with no plan", async () => {
    // arrange
    const ports = settlePorts({
      firstRun: () => Promise.resolve({ kind: "installed", rows: [installedRow("zcore@mp")] }),
    });

    // act
    const settled = await settleDependencies(ports);

    // assert
    assert.deepStrictEqual(settled, { kind: "settled", rows: [installedRow("zcore@mp")] });
    assert.deepStrictEqual(ports.calls, ["first run"]);
  });

  test("D-PL1-16: a first run that installs a dependency with notices settles with its notices", async () => {
    // arrange
    const ports = settlePorts({
      firstRun: () =>
        Promise.resolve({
          kind: "installed",
          rows: [installedRow("zcore@mp")],
          mcpConfigNotices: [ADAPTER_NOTICE],
        }),
    });

    // act
    const settled = await settleDependencies(ports);

    // assert
    assert.deepStrictEqual(settled, {
      kind: "settled",
      rows: [installedRow("zcore@mp")],
      mcpConfigNotices: [ADAPTER_NOTICE],
    });
  });

  test("a first run keeps its dependency warning owner in the settlement", async () => {
    // arrange
    const ports = settlePorts({
      firstRun: () =>
        Promise.resolve({
          kind: "installed",
          rows: [installedRow("zcore@mp")],
          stagingDiagnostics: [
            {
              plugin: "zcore",
              scope: "project",
              verb: "installed",
              warnings: [PACKAGE_WARNING],
            },
          ],
        } as SettleCascadeRun),
    });

    // act
    const settled = await settleDependencies(ports);

    // assert
    assert.deepStrictEqual(settled, {
      kind: "settled",
      rows: [installedRow("zcore@mp")],
      stagingDiagnostics: [
        {
          plugin: "zcore",
          scope: "project",
          verb: "installed",
          warnings: [PACKAGE_WARNING],
        },
      ],
    });
  });

  test("D-PL1-16: a planned settle carries the notices of its final closure", async () => {
    // arrange
    const ports = settlePorts({
      firstRun: () => Promise.resolve({ kind: "planned" }),
      plan: () => Promise.resolve(PLAN),
      steps: stepPorts({ materialize: installingWithNotices({ "helper@mp": ADAPTER_NOTICE }) }),
    });

    // act
    const settled = await settleDependencies(ports);

    // assert
    assert.deepStrictEqual(settled, {
      kind: "settled",
      rows: [updatedRow("lib@mp"), installedRow("helper@mp")],
      mcpConfigNotices: [ADAPTER_NOTICE],
    });
  });

  test("D-PL1-16: a settle that refuses after a slice landed carries that slice's notices", async () => {
    // arrange
    const kept = failedRow("lib@mp", new Error("did not land"));
    const ports = settlePorts({
      firstRun: () => Promise.resolve({ kind: "planned" }),
      plan: () =>
        Promise.resolve({
          ok: true,
          steps: [
            { kind: "materialize", members: [HELPER] },
            { kind: "move", move: LIB_MOVE },
          ],
          final: { members: [], alreadyInstalled: [] },
        }),
      steps: stepPorts({
        materialize: installingWithNotices({ "helper@mp": ADAPTER_NOTICE }),
        move: () => Promise.resolve({ landed: false, rows: [kept] }),
      }),
    });

    // act
    const settled = await settleDependencies(ports);

    // assert
    assert.deepStrictEqual(settled, {
      kind: "refused",
      rows: [installedRow("helper@mp"), kept],
      cause: LIB_DID_NOT_MOVE,
      mcpConfigNotices: [ADAPTER_NOTICE],
    });
  });

  test("UPD-DEP-D1: a first run the cascade refuses refuses the settle with the failing row", async () => {
    // arrange
    const ports = settlePorts({
      firstRun: () => Promise.resolve({ kind: "refused", subject: SUBJECT }),
    });

    // act
    const settled = await settleDependencies(ports);

    // assert
    assert.deepStrictEqual(settled, {
      kind: "refused",
      rows: [failedRow("helper@mp", REFUSAL_CAUSE)],
      cause: REFUSAL_CAUSE,
    });
    assert.deepStrictEqual(ports.calls, ["first run", "refusal member"]);
  });

  test("UPD-DEP-D1: a planned settle runs the plan's steps, then its final closure, then sweeps", async () => {
    // arrange
    const ports = settlePorts({
      firstRun: () => Promise.resolve({ kind: "planned" }),
      plan: () => Promise.resolve(PLAN),
    });

    // act
    const settled = await settleDependencies(ports);

    // assert
    assert.deepStrictEqual(settled, {
      kind: "settled",
      rows: [updatedRow("lib@mp"), installedRow("helper@mp")],
    });
    assert.deepStrictEqual(ports.calls, [
      "first run",
      "plan",
      "move lib@mp 2.0.0",
      "materialize helper@mp",
      "sweep",
    ]);
  });

  test("UPD-DEP-D1: a plan with an empty final closure materializes nothing after its steps", async () => {
    // arrange
    const ports = settlePorts({
      firstRun: () => Promise.resolve({ kind: "planned" }),
      plan: () => Promise.resolve({ ...PLAN, final: { members: [], alreadyInstalled: [] } }),
    });

    // act
    const settled = await settleDependencies(ports);

    // assert
    assert.deepStrictEqual(settled, { kind: "settled", rows: [updatedRow("lib@mp")] });
    assert.deepStrictEqual(ports.calls, ["first run", "plan", "move lib@mp 2.0.0", "sweep"]);
  });

  test("UPD-DEP-D1: a refused plan changes nothing and refuses with the failing row", async () => {
    // arrange
    const ports = settlePorts({
      firstRun: () => Promise.resolve({ kind: "planned" }),
      plan: () => Promise.resolve({ ok: false, subject: SUBJECT }),
    });

    // act
    const settled = await settleDependencies(ports);

    // assert
    assert.deepStrictEqual(settled, {
      kind: "refused",
      rows: [failedRow("helper@mp", REFUSAL_CAUSE)],
      cause: REFUSAL_CAUSE,
    });
    assert.deepStrictEqual(ports.calls, ["first run", "plan", "refusal member", "sweep"]);
  });

  test("UPD-DEP-D1: a step that fails refuses the settle with every change that landed, and sweeps", async () => {
    // arrange
    const kept = failedRow("lib@mp", new Error("did not land"));
    const ports = settlePorts({
      firstRun: () => Promise.resolve({ kind: "planned" }),
      plan: () => Promise.resolve(PLAN),
      steps: stepPorts({ move: () => Promise.resolve({ landed: false, rows: [kept] }) }),
    });

    // act
    const settled = await settleDependencies(ports);

    // assert
    assert.deepStrictEqual(settled, { kind: "refused", rows: [kept], cause: LIB_DID_NOT_MOVE });
    assert.deepStrictEqual(ports.calls, ["first run", "plan", "move lib@mp 2.0.0", "sweep"]);
  });

  test("UPD-DEP-D1 / CR-N2: a plan that throws refuses the settle with what it threw", async () => {
    // arrange
    const thrown = new Error("marketplace.json is not valid JSON");
    const ports = settlePorts({
      firstRun: () => Promise.resolve({ kind: "planned" }),
      plan: () => Promise.reject(thrown),
    });

    // act
    const settled = await settleDependencies(ports);

    // assert
    assert.deepStrictEqual(settled, { kind: "refused", rows: [], cause: thrown });
    assert.deepStrictEqual(ports.calls, ["first run", "plan", "sweep"]);
  });

  test("GHB-03: a plan that meets an invalid GitHub base override fails the command", async () => {
    // arrange
    const invalid = new InvalidGitHubBaseUrlError("PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL", "query");
    const ports = settlePorts({
      firstRun: () => Promise.resolve({ kind: "planned" }),
      plan: () => Promise.reject(invalid),
    });

    // act & assert
    await assert.rejects(settleDependencies(ports), invalid);
    assert.deepStrictEqual(ports.calls, ["first run", "plan", "sweep"]);
  });
});
