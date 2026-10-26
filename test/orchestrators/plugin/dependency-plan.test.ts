import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  planDependencyGraph,
  renderRequestedRanges,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-plan.ts";

import type {
  DependencyMoveRequest,
  DependencyPlanPorts,
  PlanJudgement,
  PlannedCandidate,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-plan.ts";
import type {
  DependencyGraph,
  FreshGraphNode,
  GraphRequester,
  GraphWalkFailure,
  RecordedGraphNode,
  ResolvedCascadeMember,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts";

const APP_ASKS_2: readonly GraphRequester[] = [{ key: "app@mp", ranges: ["^2.0.0"] }];

function member(name: string): ResolvedCascadeMember {
  return { key: `${name}@mp`, name, marketplace: "mp", requiredBy: "app@mp", ranges: [] };
}

/** A recorded plugin the walk stopped at, at `version`. */
function wall(
  name: string,
  version: string | undefined,
  requesters: readonly GraphRequester[],
): RecordedGraphNode {
  return {
    kind: "recorded",
    member: member(name),
    requesters,
    dependsOn: [],
    version,
    disabled: false,
    walked: false,
  };
}

/** A recorded plugin the walk read through: moving, or disabled. */
function walked(
  name: string,
  requesters: readonly GraphRequester[],
  options: { readonly dependsOn?: readonly string[]; readonly disabled?: boolean } = {},
): RecordedGraphNode {
  return {
    kind: "recorded",
    member: member(name),
    requesters,
    dependsOn: options.dependsOn ?? [],
    version: "1.0.0",
    disabled: options.disabled ?? false,
    walked: true,
  };
}

function fresh(name: string, dependsOn: readonly string[] = []): FreshGraphNode {
  return { kind: "fresh", member: member(name), requesters: [], dependsOn };
}

/** The graph of installing `app@mp`. */
function graph(nodes: DependencyGraph["nodes"], rootDependsOn: readonly string[]): DependencyGraph {
  return { kind: "graph", root: member("app"), rootDependsOn, nodes };
}

function request(
  name: string,
  requesters: readonly GraphRequester[] = APP_ASKS_2,
  excludedVersions?: readonly string[],
): DependencyMoveRequest {
  return {
    key: `${name}@mp`,
    name,
    marketplace: "mp",
    recordedVersion: "1.0.0",
    requesters,
    ...(excludedVersions !== undefined && { excludedVersions }),
  };
}

/** A walk that failed on `fff@mp`'s contradictory ranges, which `declarers` declare. */
function contradiction(declarers: readonly string[]): GraphWalkFailure {
  return {
    kind: "constraint-failed",
    failure: {
      kind: "range-conflict",
      why: "contradictory-declarations",
      key: "fff@mp",
      range: "^1.0.0, ^2.0.0",
      detail: "no version satisfies all 2 declared ranges",
    },
    declarers,
  };
}

interface Calls {
  readonly walks: string[];
  readonly judged: DependencyMoveRequest[];
  readonly previewed: string[];
}

/**
 * Ports over a scripted world. `walks` answers each walk by the moves it
 * reads, written `key=version,...` in the order the plan chose them.
 * `versions` answers each judged key; a key it lacks, or a version the
 * request rules out, cannot move.
 */
function ports(world: {
  readonly walks: Readonly<Record<string, DependencyGraph | GraphWalkFailure>>;
  readonly versions?: (request: DependencyMoveRequest) => string | undefined;
  readonly preview?: (member: ResolvedCascadeMember) => Promise<void>;
  /** GV-01: each version lands at a release tag, its commit appended. */
  readonly tagged?: boolean;
}): DependencyPlanPorts<PlannedCandidate> & { readonly calls: Calls } {
  const calls: Calls = { walks: [], judged: [], previewed: [] };
  return {
    calls,
    walk: (moving) => {
      const signature = [...moving].map(([key, prepared]) => `${key}=${prepared.toVersion}`).join();
      calls.walks.push(signature);
      const answer = world.walks[signature];
      assert.ok(answer !== undefined, `no walk scripted for "${signature}"`);
      return Promise.resolve(answer);
    },
    judge: (judged) => {
      calls.judged.push(judged);
      const version = world.versions?.(judged);
      return Promise.resolve<PlanJudgement<PlannedCandidate>>(
        version === undefined || judged.excludedVersions?.includes(version) === true
          ? { ok: false, cause: "version 1.5.0 falls outside the range" }
          : { ok: true, prepared: landedAt(version, world.tagged === true) },
      );
    },
    preview: (previewed) => {
      calls.previewed.push(previewed.key);
      return world.preview?.(previewed) ?? Promise.resolve();
    },
  };
}

const TAG_COMMIT = "0123456789ab";

/** The candidate a judge lands, at a release tag when `tagged` (GV-01). */
function landedAt(version: string, tagged: boolean): PlannedCandidate {
  return tagged
    ? { toVersion: `${version}-${TAG_COMMIT}`, resolvedVersion: version }
    : { toVersion: version };
}

function refusal(key: string, range: string, moveRefusal: string) {
  return {
    ok: false,
    subject: {
      kind: "constraint",
      failure: {
        kind: "range-conflict",
        why: "installed-unsatisfied",
        key,
        range,
        recordedVersion: "1.0.0",
        moveRefusal,
      },
    },
  } as const;
}

describe("planDependencyGraph", () => {
  test("UPD-DEP-D1: keeps every recorded dependency every range admits and leaves the closure to the install", async () => {
    // arrange
    const bound = ports({
      walks: {
        "": graph(
          [wall("lib", "2.1.0", APP_ASKS_2), wall("old", undefined, APP_ASKS_2), fresh("helper")],
          ["lib@mp", "old@mp", "helper@mp"],
        ),
      },
    });

    // act
    const plan = await planDependencyGraph(bound, { deferMoveDependencies: false });

    // assert
    assert.deepStrictEqual(plan, {
      ok: true,
      steps: [],
      final: {
        members: [
          { kind: "install", member: member("helper") },
          { kind: "install", member: member("app") },
        ],
        alreadyInstalled: [member("lib"), member("old")],
      },
    });
    assert.deepStrictEqual(bound.calls, { walks: [""], judged: [], previewed: ["helper@mp"] });
  });

  test("UPD-DEP-D1: moves a dependency the graph's ranges reject to the version its judge lands", async () => {
    // arrange
    const bound = ports({
      walks: {
        "": graph([wall("lib", "1.0.0", APP_ASKS_2)], ["lib@mp"]),
        "lib@mp=2.0.0": graph([walked("lib", APP_ASKS_2)], ["lib@mp"]),
      },
      versions: () => "2.0.0",
    });

    // act
    const plan = await planDependencyGraph(bound, { deferMoveDependencies: false });

    // assert
    assert.deepStrictEqual(plan, {
      ok: true,
      steps: [{ kind: "move", move: { request: request("lib"), version: "2.0.0" } }],
      final: { members: [{ kind: "install", member: member("app") }], alreadyInstalled: [] },
    });
    assert.deepStrictEqual(bound.calls.walks, ["", "lib@mp=2.0.0"]);
    assert.deepStrictEqual(bound.calls.judged, [request("lib")]);
  });

  test("UPD-DEP-D1 / WR-N1: judges a dependency again when a moved dependency's new version narrows its range", async () => {
    // arrange
    const narrowed: readonly GraphRequester[] = [
      { key: "app@mp", ranges: ["^1.2.0"] },
      { key: "fff@mp", ranges: ["<1.5.0"] },
    ];
    const moved = graph(
      [
        walked("bbb", narrowed),
        fresh("fff", ["bbb@mp"]),
        walked("aaa", APP_ASKS_2, { dependsOn: ["fff@mp"] }),
      ],
      ["aaa@mp", "bbb@mp"],
    );
    const bound = ports({
      walks: {
        "": graph(
          [
            wall("aaa", "1.0.0", APP_ASKS_2),
            wall("bbb", "1.0.0", [{ key: "app@mp", ranges: ["^1.2.0"] }]),
          ],
          ["aaa@mp", "bbb@mp"],
        ),
        "aaa@mp=2.0.0,bbb@mp=1.9.0": moved,
        "bbb@mp=1.4.0,aaa@mp=2.0.0": moved,
      },
      versions: (judged) => {
        if (judged.key === "aaa@mp") {
          return "2.0.0";
        }

        return judged.requesters.length === 2 ? "1.4.0" : "1.9.0";
      },
    });

    // act
    const plan = await planDependencyGraph(bound, { deferMoveDependencies: false });

    // assert
    assert.deepStrictEqual(plan, {
      ok: true,
      steps: [
        { kind: "move", move: { request: request("bbb", narrowed), version: "1.4.0" } },
        { kind: "materialize", members: [{ kind: "install", member: member("fff") }] },
        { kind: "move", move: { request: request("aaa"), version: "2.0.0" } },
      ],
      final: { members: [{ kind: "install", member: member("app") }], alreadyInstalled: [] },
    });
    assert.deepStrictEqual(bound.calls.walks, [
      "",
      "aaa@mp=2.0.0,bbb@mp=1.9.0",
      "bbb@mp=1.4.0,aaa@mp=2.0.0",
    ]);
    assert.deepStrictEqual(
      bound.calls.judged.map((judged) => [judged.key, judged.requesters.length]),
      [
        ["aaa@mp", 1],
        ["bbb@mp", 1],
        ["bbb@mp", 2],
      ],
    );
  });

  test("UPD-DEP-D1 / IN-2: drops a move a moved dependency's new version no longer needs, and reports that dependency as installed", async () => {
    // arrange
    const bound = ports({
      walks: {
        "": graph(
          [
            wall("aaa", "1.0.0", APP_ASKS_2),
            wall("lib", "1.0.0", [{ key: "app@mp", ranges: ["^2.0.0"] }]),
          ],
          ["aaa@mp"],
        ),
        "aaa@mp=2.0.0,lib@mp=2.0.0": graph(
          [
            walked("lib", [{ key: "aaa@mp", ranges: ["^1.0.0"] }]),
            walked("aaa", APP_ASKS_2, { dependsOn: ["lib@mp"] }),
          ],
          ["aaa@mp"],
        ),
        "aaa@mp=2.0.0": graph(
          [
            wall("lib", "1.0.0", [{ key: "aaa@mp", ranges: ["^1.0.0"] }]),
            walked("aaa", APP_ASKS_2, { dependsOn: ["lib@mp"] }),
          ],
          ["aaa@mp"],
        ),
      },
      versions: () => "2.0.0",
    });

    // act
    const plan = await planDependencyGraph(bound, { deferMoveDependencies: false });

    // assert
    assert.deepStrictEqual(plan, {
      ok: true,
      steps: [{ kind: "move", move: { request: request("aaa"), version: "2.0.0" } }],
      final: {
        members: [{ kind: "install", member: member("app") }],
        alreadyInstalled: [member("lib")],
      },
    });
    assert.deepStrictEqual(bound.calls.walks, ["", "aaa@mp=2.0.0,lib@mp=2.0.0", "aaa@mp=2.0.0"]);
  });

  test("UPD-DEP-D1 / WR-N4: moves a disabled dependency, then enables it before the move that needs it", async () => {
    // arrange
    const bound = ports({
      walks: {
        "": graph(
          [wall("aaa", "1.0.0", APP_ASKS_2), walked("ddd", APP_ASKS_2, { disabled: true })],
          ["aaa@mp", "ddd@mp"],
        ),
        "aaa@mp=2.0.0,ddd@mp=2.0.0": graph(
          [
            walked("ddd", [{ key: "aaa@mp", ranges: [] }, ...APP_ASKS_2], { disabled: true }),
            walked("aaa", APP_ASKS_2, { dependsOn: ["ddd@mp"] }),
          ],
          ["aaa@mp", "ddd@mp"],
        ),
      },
      versions: () => "2.0.0",
    });

    // act
    const plan = await planDependencyGraph(bound, { deferMoveDependencies: false });

    // assert
    assert.deepStrictEqual(plan, {
      ok: true,
      steps: [
        {
          kind: "move",
          move: {
            request: request("ddd", [{ key: "aaa@mp", ranges: [] }, ...APP_ASKS_2]),
            version: "2.0.0",
          },
        },
        { kind: "materialize", members: [{ kind: "re-enable", member: member("ddd") }] },
        { kind: "move", move: { request: request("aaa"), version: "2.0.0" } },
      ],
      final: { members: [{ kind: "install", member: member("app") }], alreadyInstalled: [] },
    });
  });

  test("MISS-01: a deferring plan leaves a move's needs out and lands only what the root reaches without a move", async () => {
    // arrange
    const bound = ports({
      walks: {
        "": graph([wall("aaa", "1.0.0", APP_ASKS_2), fresh("ggg")], ["aaa@mp", "ggg@mp"]),
        "aaa@mp=2.0.0": graph(
          [
            wall("kept", "1.0.0", []),
            fresh("fff", ["kept@mp"]),
            walked("aaa", APP_ASKS_2, { dependsOn: ["fff@mp"] }),
            fresh("ggg"),
          ],
          ["aaa@mp", "ggg@mp"],
        ),
      },
      versions: () => "2.0.0",
    });

    // act
    const plan = await planDependencyGraph(bound, { deferMoveDependencies: true });

    // assert
    assert.deepStrictEqual(plan, {
      ok: true,
      steps: [{ kind: "move", move: { request: request("aaa"), version: "2.0.0" } }],
      final: {
        members: [
          { kind: "install", member: member("ggg") },
          { kind: "install", member: member("app") },
        ],
        alreadyInstalled: [],
      },
    });
  });

  test("UPD-DEP-D1: an update's plan lands its final closure without a root", async () => {
    // arrange
    const bound = ports({
      walks: { "": { ...graph([fresh("helper")], ["helper@mp"]), root: undefined } },
    });

    // act
    const plan = await planDependencyGraph(bound, { deferMoveDependencies: false });

    // assert
    assert.deepStrictEqual(plan, {
      ok: true,
      steps: [],
      final: { members: [{ kind: "install", member: member("helper") }], alreadyInstalled: [] },
    });
  });

  test("UPD-DEP-D1: refuses a dependency no version moves into range, before anything else is judged", async () => {
    // arrange
    const requesters: readonly GraphRequester[] = [
      { key: "aaa@mp", ranges: ["^2.0.0"] },
      { key: "app@mp", ranges: ["^2.0.0"] },
    ];
    const bound = ports({
      walks: {
        "": graph([wall("lib", "1.0.0", requesters), wall("zzz", "1.0.0", APP_ASKS_2)], []),
      },
    });

    // act
    const plan = await planDependencyGraph(bound, { deferMoveDependencies: false });

    // assert
    assert.deepStrictEqual(
      plan,
      refusal("lib@mp", "^2.0.0", "version 1.5.0 falls outside the range"),
    );
    assert.deepStrictEqual(bound.calls.judged, [request("lib", requesters)]);
  });

  test("UPD-DEP-D1: refuses a closure the walk cannot resolve", async () => {
    // arrange
    const failure = { ok: false, reason: "cycle", chain: ["app@mp", "aaa@mp", "app@mp"] } as const;
    const bound = ports({ walks: { "": { kind: "closure-failed", failure, declarers: [] } } });

    // act
    const plan = await planDependencyGraph(bound, { deferMoveDependencies: false });

    // assert
    assert.deepStrictEqual(plan, { ok: false, subject: { kind: "closure", failure } });
  });

  test("UPD-DEP-D1 / CR-N1: refuses ranges the walk finds contradictory when the pick they involve has no other version", async () => {
    // arrange
    const failed = contradiction(["aaa@mp", "app@mp"]);
    const bound = ports({
      walks: {
        "": graph([wall("aaa", "1.0.0", APP_ASKS_2)], ["aaa@mp"]),
        "aaa@mp=2.0.0": failed,
      },
      versions: () => "2.0.0",
    });

    // act
    const plan = await planDependencyGraph(bound, { deferMoveDependencies: false });

    // assert
    assert.deepStrictEqual(plan, {
      ok: false,
      subject: { kind: "constraint", failure: failed.failure },
    });
    assert.deepStrictEqual(bound.calls.judged, [
      request("aaa"),
      request("aaa", APP_ASKS_2, ["2.0.0"]),
    ]);
    assert.deepStrictEqual(bound.calls.previewed, []);
  });

  test("WR-1: rules out a pick whose declarations the walk finds contradictory and moves it to the next version", async () => {
    // arrange
    const asked: readonly GraphRequester[] = [
      { key: "app@mp", ranges: [">=2.0.0"] },
      { key: "fff@mp", ranges: ["~2.0.0"] },
    ];
    const bound = ports({
      walks: {
        "": graph([wall("yyy", "1.0.0", [{ key: "app@mp", ranges: [">=2.0.0"] }])], ["yyy@mp"]),
        "yyy@mp=3.0.0": contradiction(["app@mp", "yyy@mp"]),
        "yyy@mp=2.0.0": graph(
          [walked("yyy", asked), fresh("fff", ["yyy@mp"])],
          ["yyy@mp", "fff@mp"],
        ),
      },
      versions: (judged) => (judged.excludedVersions === undefined ? "3.0.0" : "2.0.0"),
    });

    // act
    const plan = await planDependencyGraph(bound, { deferMoveDependencies: false });

    // assert
    assert.deepStrictEqual(plan, {
      ok: true,
      steps: [
        { kind: "move", move: { request: request("yyy", asked, ["3.0.0"]), version: "2.0.0" } },
      ],
      final: {
        members: [
          { kind: "install", member: member("fff") },
          { kind: "install", member: member("app") },
        ],
        alreadyInstalled: [],
      },
    });
    assert.deepStrictEqual(bound.calls.walks, ["", "yyy@mp=3.0.0", "yyy@mp=2.0.0"]);
  });

  test("WR-1 / GV-01: rules out a pick at a release tag by the tag's version", async () => {
    // arrange
    const asked: readonly GraphRequester[] = [
      { key: "app@mp", ranges: [">=2.0.0"] },
      { key: "fff@mp", ranges: ["~2.0.0"] },
    ];
    const bound = ports({
      walks: {
        "": graph([wall("yyy", "1.0.0", [{ key: "app@mp", ranges: [">=2.0.0"] }])], ["yyy@mp"]),
        [`yyy@mp=3.0.0-${TAG_COMMIT}`]: contradiction(["app@mp", "yyy@mp"]),
        [`yyy@mp=2.0.0-${TAG_COMMIT}`]: graph(
          [walked("yyy", asked), fresh("fff", ["yyy@mp"])],
          ["yyy@mp", "fff@mp"],
        ),
      },
      versions: (judged) => (judged.excludedVersions === undefined ? "3.0.0" : "2.0.0"),
      tagged: true,
    });

    // act
    const plan = await planDependencyGraph(bound, { deferMoveDependencies: false });

    // assert
    assert.ok(plan.ok);
    assert.deepStrictEqual(plan.steps, [
      {
        kind: "move",
        move: { request: request("yyy", asked, ["3.0.0"]), version: `2.0.0-${TAG_COMMIT}` },
      },
    ]);
  });

  test("GV-01: keeps a recorded dependency whose release tag version every range admits", async () => {
    // arrange: the recorded commit form is a prerelease `^2.0.0` rejects.
    const atTag: RecordedGraphNode = {
      ...wall("lib", `2.1.0-${TAG_COMMIT}`, APP_ASKS_2),
      resolvedVersion: "2.1.0",
    };
    const bound = ports({ walks: { "": graph([atTag], ["lib@mp"]) } });

    // act
    const plan = await planDependencyGraph(bound, { deferMoveDependencies: false });

    // assert
    assert.ok(plan.ok);
    assert.deepStrictEqual([plan.steps, bound.calls.judged], [[], []]);
  });

  test("WR-1: rules out the pick whose range leaves a dependency no version, and settles without it", async () => {
    // arrange
    const strict: readonly GraphRequester[] = [{ key: "aaa@mp", ranges: ["^9.0.0"] }];
    const bound = ports({
      walks: {
        "": graph([wall("aaa", "1.0.0", APP_ASKS_2)], ["aaa@mp"]),
        "aaa@mp=2.1.0": graph(
          [wall("lib", "1.0.0", strict), walked("aaa", APP_ASKS_2, { dependsOn: ["lib@mp"] })],
          ["aaa@mp"],
        ),
        "aaa@mp=2.0.0": graph([walked("aaa", APP_ASKS_2)], ["aaa@mp"]),
      },
      versions: (judged) => {
        if (judged.key === "lib@mp") {
          return undefined;
        }

        return judged.excludedVersions === undefined ? "2.1.0" : "2.0.0";
      },
    });

    // act
    const plan = await planDependencyGraph(bound, { deferMoveDependencies: false });

    // assert
    assert.deepStrictEqual(plan, {
      ok: true,
      steps: [
        {
          kind: "move",
          move: { request: request("aaa", APP_ASKS_2, ["2.1.0"]), version: "2.0.0" },
        },
      ],
      final: { members: [{ kind: "install", member: member("app") }], alreadyInstalled: [] },
    });
  });

  test("WR-1: refuses with the conflict that ruled out a pick's last version once none is left", async () => {
    // arrange
    const first = contradiction(["lib@mp"]);
    const bound = ports({
      walks: {
        "": graph([wall("lib", "1.0.0", APP_ASKS_2)], ["lib@mp"]),
        "lib@mp=3.0.0": first,
        "lib@mp=2.0.0": contradiction(["lib@mp", "app@mp"]),
      },
      versions: (judged) => {
        const excluded = judged.excludedVersions ?? [];
        return ["3.0.0", "2.0.0"].find((version) => !excluded.includes(version));
      },
    });

    // act
    const plan = await planDependencyGraph(bound, { deferMoveDependencies: false });

    // assert
    assert.deepStrictEqual(plan, {
      ok: false,
      subject: { kind: "constraint", failure: first.failure },
    });
    assert.deepStrictEqual(
      bound.calls.judged.map((judged) => judged.excludedVersions),
      [undefined, ["3.0.0"], ["3.0.0", "2.0.0"]],
    );
  });

  test("WR-1: a dependency whose versions a conflict ruled out refuses with that conflict", async () => {
    // arrange
    const first = contradiction(["lib@mp"]);
    const both: readonly GraphRequester[] = [...APP_ASKS_2, { key: "fff@mp", ranges: ["<2.0.0"] }];
    const bound = ports({
      walks: {
        "": graph([wall("lib", "1.0.0", APP_ASKS_2)], ["lib@mp"]),
        "lib@mp=3.0.0": first,
        "lib@mp=2.0.0": graph([walked("lib", both), fresh("fff", ["lib@mp"])], ["lib@mp"]),
      },
      versions: (judged) => {
        if (judged.requesters.length > 1) {
          return undefined;
        }

        return judged.excludedVersions === undefined ? "3.0.0" : "2.0.0";
      },
    });

    // act
    const plan = await planDependencyGraph(bound, { deferMoveDependencies: false });

    // assert
    assert.deepStrictEqual(plan, {
      ok: false,
      subject: { kind: "constraint", failure: first.failure },
    });
  });

  test("WR-4: settles a chain of moves deeper than any fixed number of rounds", async () => {
    // arrange
    const links = Array.from({ length: 12 }, (_, index) => `a${index + 1}`);
    const asks = (index: number): readonly GraphRequester[] => [
      { key: index === 0 ? "app@mp" : `${links[index - 1]}@mp`, ranges: ["^2.0.0"] },
    ];
    const walks: Record<string, DependencyGraph> = {};
    for (let depth = 0; depth <= links.length; depth++) {
      const moved = links.slice(0, depth);
      const signature = moved.map((name) => `${name}@mp=2.0.0`).join();
      walks[signature] = graph(
        links
          .slice(0, Math.min(depth + 1, links.length))
          .map((name, index) =>
            index < depth
              ? walked(name, asks(index), { dependsOn: [`${links[index + 1]}@mp`] })
              : wall(name, "1.0.0", asks(index)),
          ),
        ["a1@mp"],
      );
    }

    const bound = ports({ walks, versions: () => "2.0.0" });

    // act
    const plan = await planDependencyGraph(bound, { deferMoveDependencies: false });

    // assert
    assert.ok(plan.ok);
    assert.deepStrictEqual(
      plan.steps.map((step) => (step.kind === "move" ? step.move.request.key : step.kind)),
      links.map((name) => `${name}@mp`),
    );
    assert.strictEqual(bound.calls.walks.length, links.length + 1);
  });

  test("UPD-DEP-D1: refuses a graph whose choices never settle", async () => {
    // arrange
    const bound = ports({
      walks: {
        "": graph([wall("lib", "1.0.0", APP_ASKS_2)], ["lib@mp"]),
        "lib@mp=2.0.0": graph([walked("lib", [])], ["lib@mp"]),
      },
      versions: () => "2.0.0",
    });

    // act
    const plan = await planDependencyGraph(bound, { deferMoveDependencies: false });

    // assert
    assert.deepStrictEqual(
      plan,
      refusal(
        "lib@mp",
        "^2.0.0",
        "its version does not settle: each version chosen for it changes what the other dependencies need",
      ),
    );
    assert.deepStrictEqual(bound.calls.walks, ["", "lib@mp=2.0.0"]);
  });

  test("UPD-DEP-D1: refuses the first fresh dependency the install's preflight refuses", async () => {
    // arrange
    const error = new Error('Plugin "helper" is not installable: contains outputStyles');
    const bound = ports({
      walks: { "": graph([fresh("helper"), fresh("other")], ["helper@mp", "other@mp"]) },
      preview: (previewed) =>
        previewed.key === "helper@mp" ? Promise.reject(error) : Promise.resolve(),
    });

    // act
    const plan = await planDependencyGraph(bound, { deferMoveDependencies: false });

    // assert
    assert.deepStrictEqual(plan, {
      ok: false,
      subject: { kind: "member", key: "helper@mp", error, rollbackPartials: [] },
    });
    assert.deepStrictEqual(bound.calls.previewed, ["helper@mp"]);
  });
});

describe("renderRequestedRanges", () => {
  test("IN-N2: names each range once, in requester order", () => {
    // act
    const rendered = renderRequestedRanges([
      { key: "aaa@mp", ranges: ["^2.0.0"] },
      { key: "app@mp", ranges: ["^2.0.0", ">=2.1.0"] },
    ]);

    // assert
    assert.strictEqual(rendered, "^2.0.0, >=2.1.0");
  });
});
