import assert from "node:assert/strict";
import test from "node:test";

import { planDependencyMoves } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-plan.ts";

import type {
  DependencyMoveRequest,
  DependencyPlanPorts,
  DependencyPlanStart,
  DependencyPlanWalk,
  PlanJudgement,
  PlannedCandidate,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-plan.ts";
import type {
  OutOfRangeMember,
  RecordedCascadeMember,
  ResolvedCascadeMember,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts";

function outOfRange(name: string, overrides: Partial<OutOfRangeMember> = {}): OutOfRangeMember {
  return {
    key: `${name}@mp`,
    name,
    marketplace: "mp",
    requiredBy: "app@mp",
    ranges: ["^2.0.0"],
    range: "^2.0.0",
    recordedVersion: "1.0.0",
    ...overrides,
  };
}

function recorded(name: string, ranges: readonly string[] = ["^2.0.0"]): RecordedCascadeMember {
  return { key: `${name}@mp`, ranges };
}

function request(
  name: string,
  requesters: DependencyMoveRequest["requesters"] = [{ key: "app@mp", ranges: ["^2.0.0"] }],
): DependencyMoveRequest {
  return { key: `${name}@mp`, name, marketplace: "mp", recordedVersion: "1.0.0", requesters };
}

function fresh(name: string): ResolvedCascadeMember {
  return { key: `${name}@mp`, name, marketplace: "mp", requiredBy: "app@mp", ranges: [] };
}

/** A walk that adds nothing: no fresh members, no moves, no recorded members. */
function walked(overrides: Partial<Extract<DependencyPlanWalk, { kind: "planned" }>> = {}) {
  return {
    kind: "planned",
    freshMembers: [],
    outOfRange: [],
    recordedMembers: [],
    ...overrides,
  } satisfies DependencyPlanWalk;
}

interface Recorded {
  readonly judged: DependencyMoveRequest[];
  readonly walked: string[];
  readonly previewed: string[];
}

/** Ports that admit every move at 2.0.0, walk to nothing, and preview cleanly, recording each call. */
function ports(
  overrides: Partial<DependencyPlanPorts<PlannedCandidate>> = {},
): DependencyPlanPorts<PlannedCandidate> & { readonly calls: Recorded } {
  const calls: Recorded = { judged: [], walked: [], previewed: [] };
  return {
    calls,
    judge: (moveRequest) => {
      calls.judged.push(moveRequest);
      return (
        overrides.judge?.(moveRequest) ??
        Promise.resolve<PlanJudgement<PlannedCandidate>>({
          ok: true,
          prepared: { toVersion: "2.0.0" },
        })
      );
    },
    walk: (moveRequest, candidate, planned) => {
      calls.walked.push(
        `${moveRequest.key} ${[...planned].map(([key, v]) => `${key}=${v}`).join(",")}`,
      );
      return overrides.walk?.(moveRequest, candidate, planned) ?? Promise.resolve(walked());
    },
    preview: (member) => {
      calls.previewed.push(member.key);
      return overrides.preview?.(member) ?? Promise.resolve();
    },
  };
}

function start(overrides: Partial<DependencyPlanStart> = {}): DependencyPlanStart {
  return {
    rootKey: "app@mp",
    freshMembers: [],
    outOfRange: [],
    recordedMembers: [],
    ...overrides,
  };
}

/** The refusal RESV-05 reports for a recorded dependency that cannot move. */
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

test("UPD-DEP-D1: holds when every fresh member previews and every move lands a version in range", async () => {
  // arrange
  const bound = ports();

  // act
  const plan = await planDependencyMoves(
    start({ freshMembers: [fresh("helper")], outOfRange: [outOfRange("lib")] }),
    bound,
  );

  // assert
  assert.deepStrictEqual(plan, {
    ok: true,
    moves: [{ request: request("lib"), version: "2.0.0" }],
  });
  assert.deepStrictEqual(bound.calls, {
    judged: [request("lib")],
    walked: ["lib@mp lib@mp=2.0.0"],
    previewed: ["helper@mp"],
  });
});

test("UPD-DEP-D1: refuses a fresh member the install's preflight refuses, naming it", async () => {
  // arrange
  const cause = new Error("partially available");
  const bound = ports({ preview: () => Promise.reject(cause) });

  // act
  const plan = await planDependencyMoves(
    start({ freshMembers: [fresh("helper")], outOfRange: [outOfRange("lib")] }),
    bound,
  );

  // assert
  assert.deepStrictEqual(plan, {
    ok: false,
    subject: { kind: "member", key: "helper@mp", error: cause, rollbackPartials: [] },
  });
  assert.deepStrictEqual(bound.calls.judged, []);
});

test("UPD-DEP-D1: refuses a move update's preflight refuses, with RESV-05's subject and its cause", async () => {
  // arrange
  const bound = ports({ judge: () => Promise.resolve({ ok: false, cause: "held" }) });

  // act
  const plan = await planDependencyMoves(start({ outOfRange: [outOfRange("lib")] }), bound);

  // assert
  assert.deepStrictEqual(plan, refusal("lib@mp", "^2.0.0", "held"));
  assert.deepStrictEqual(bound.calls.walked, []);
});

test("UPD-DEP-D1: refuses a move of the plugin the operation installs or updates, without judging it", async () => {
  // arrange
  const bound = ports({
    walk: (moveRequest) =>
      Promise.resolve(
        moveRequest.key === "lib@mp"
          ? walked({ outOfRange: [outOfRange("app", { requiredBy: "lib@mp" })] })
          : walked(),
      ),
  });

  // act
  const plan = await planDependencyMoves(start({ outOfRange: [outOfRange("lib")] }), bound);

  // assert
  assert.deepStrictEqual(plan, refusal("app@mp", "^2.0.0", "a move of it is already in progress"));
  assert.deepStrictEqual(
    bound.calls.judged.map((judged) => judged.key),
    ["lib@mp"],
  );
});

test("UPD-DEP-D1: refuses a move whose new closure fails the walk", async () => {
  // arrange
  const failure = {
    ok: false,
    reason: "not-found",
    key: "ghost@mp",
    missing: "ghost@mp",
    requiredBy: "lib@mp",
  } as const;
  const bound = ports({ walk: () => Promise.resolve({ kind: "closure-failed", failure }) });

  // act
  const plan = await planDependencyMoves(start({ outOfRange: [outOfRange("lib")] }), bound);

  // assert
  assert.deepStrictEqual(plan, { ok: false, subject: { kind: "closure", failure } });
});

test("UPD-DEP-D1: refuses a move whose new closure fails a constraint", async () => {
  // arrange
  const failure = { kind: "no-matching-tag", key: "base@mp", range: "^3.0.0" } as const;
  const bound = ports({ walk: () => Promise.resolve({ kind: "constraint-failed", failure }) });

  // act
  const plan = await planDependencyMoves(start({ outOfRange: [outOfRange("lib")] }), bound);

  // assert
  assert.deepStrictEqual(plan, { ok: false, subject: { kind: "constraint", failure } });
});

test("UPD-DEP-D1: previews the fresh members a move's new closure adds", async () => {
  // arrange
  const cause = new Error("name conflict");
  const bound = ports({
    walk: () => Promise.resolve(walked({ freshMembers: [fresh("base")] })),
    preview: (member) => (member.key === "base@mp" ? Promise.reject(cause) : Promise.resolve()),
  });

  // act
  const plan = await planDependencyMoves(start({ outOfRange: [outOfRange("lib")] }), bound);

  // assert
  assert.deepStrictEqual(plan, {
    ok: false,
    subject: { kind: "member", key: "base@mp", error: cause, rollbackPartials: [] },
  });
});

test("UPD-DEP-D1: judges a shared dependency once, with every range known, and moves it before the plugin that needs it", async () => {
  // arrange: the root asks for aaa and zzz at ^2.0.0; aaa 2.0.0 asks for zzz at >=2.0.0.
  const bound = ports({
    walk: (moveRequest) =>
      Promise.resolve(
        moveRequest.key === "aaa@mp"
          ? walked({
              outOfRange: [outOfRange("zzz", { requiredBy: "aaa@mp", ranges: [">=2.0.0"] })],
              recordedMembers: [recorded("zzz", [">=2.0.0"])],
            })
          : walked(),
      ),
  });
  const zzz = request("zzz", [
    { key: "app@mp", ranges: ["^2.0.0"] },
    { key: "aaa@mp", ranges: [">=2.0.0"] },
  ]);

  // act
  const plan = await planDependencyMoves(
    start({
      outOfRange: [outOfRange("aaa"), outOfRange("zzz")],
      recordedMembers: [recorded("aaa"), recorded("zzz")],
    }),
    bound,
  );

  // assert
  assert.deepStrictEqual(plan, {
    ok: true,
    moves: [
      { request: zzz, version: "2.0.0" },
      { request: request("aaa"), version: "2.0.0" },
    ],
  });
  assert.deepStrictEqual(bound.calls.judged, [request("aaa"), zzz]);
  assert.deepStrictEqual(bound.calls.walked, [
    "aaa@mp aaa@mp=2.0.0",
    "zzz@mp aaa@mp=2.0.0,zzz@mp=2.0.0",
  ]);
});

test("UPD-DEP-D1: keeps the order the walks reach the moves when no move needs another first", async () => {
  // arrange: aaa's new version accepts zzz's recorded version.
  const bound = ports({
    walk: (moveRequest) =>
      Promise.resolve(
        moveRequest.key === "aaa@mp"
          ? walked({ recordedMembers: [recorded("zzz", ["*"])] })
          : walked(),
      ),
  });

  // act
  const plan = await planDependencyMoves(
    start({ outOfRange: [outOfRange("aaa"), outOfRange("zzz")] }),
    bound,
  );

  // assert
  assert.deepStrictEqual(plan, {
    ok: true,
    moves: [
      { request: request("aaa"), version: "2.0.0" },
      { request: request("zzz"), version: "2.0.0" },
    ],
  });
});

test("UPD-DEP-D1: refuses a dependency whose planned version a range found later rejects, naming that range", async () => {
  // arrange: zzz is planned at 2.0.0 before aaa's new version asks for ^3.0.0.
  const bound = ports({
    walk: (moveRequest) =>
      Promise.resolve(
        moveRequest.key === "aaa@mp"
          ? walked({
              outOfRange: [outOfRange("zzz", { requiredBy: "aaa@mp", ranges: ["^3.0.0"] })],
              recordedMembers: [recorded("zzz", ["^3.0.0"])],
            })
          : walked(),
      ),
  });

  // act
  const plan = await planDependencyMoves(
    start({ outOfRange: [outOfRange("zzz"), outOfRange("aaa")] }),
    bound,
  );

  // assert
  assert.deepStrictEqual(
    plan,
    refusal(
      "zzz@mp",
      "^2.0.0, ^3.0.0",
      "version 2.0.0, which another move lands, does not satisfy it",
    ),
  );
});

test("UPD-DEP-D1: refuses a move whose planned version the root's own range rejects", async () => {
  // arrange: the root accepts zzz 1.x, and aaa's new version moves it to 2.0.0.
  const bound = ports({
    walk: (moveRequest) =>
      Promise.resolve(
        moveRequest.key === "aaa@mp"
          ? walked({
              outOfRange: [outOfRange("zzz", { requiredBy: "aaa@mp" })],
              recordedMembers: [recorded("zzz")],
            })
          : walked(),
      ),
  });

  // act
  const plan = await planDependencyMoves(
    start({ outOfRange: [outOfRange("aaa")], recordedMembers: [recorded("zzz", ["^1.0.0"])] }),
    bound,
  );

  // assert
  assert.deepStrictEqual(
    plan,
    refusal(
      "zzz@mp",
      "^2.0.0, ^1.0.0",
      "version 2.0.0, which another move lands, does not satisfy it",
    ),
  );
});

test("UPD-DEP-D1: refuses two moves whose new versions each need the other moved first", async () => {
  // arrange
  const bound = ports({
    walk: (moveRequest) =>
      Promise.resolve(
        walked({
          recordedMembers: [recorded(moveRequest.key === "aaa@mp" ? "zzz" : "aaa")],
        }),
      ),
  });

  // act
  const plan = await planDependencyMoves(
    start({ outOfRange: [outOfRange("aaa"), outOfRange("zzz")] }),
    bound,
  );

  // assert
  assert.deepStrictEqual(
    plan,
    refusal("aaa@mp", "^2.0.0", 'it and "zzz@mp" each need the other moved first'),
  );
});

test("UPD-DEP-D1: moves a dependency two moved plugins need once, before both", async () => {
  // arrange
  const bound = ports({
    walk: (moveRequest) =>
      Promise.resolve(
        moveRequest.key === "zzz@mp" ? walked() : walked({ recordedMembers: [recorded("zzz")] }),
      ),
  });

  // act
  const plan = await planDependencyMoves(
    start({ outOfRange: [outOfRange("aaa"), outOfRange("bbb"), outOfRange("zzz")] }),
    bound,
  );

  // assert
  assert.deepStrictEqual(plan.ok && plan.moves.map((move) => move.request.key), [
    "zzz@mp",
    "aaa@mp",
    "bbb@mp",
  ]);
});
