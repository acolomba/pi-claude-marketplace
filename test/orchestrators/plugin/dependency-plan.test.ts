import assert from "node:assert/strict";
import test from "node:test";

import { planDependencyMoves } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-plan.ts";

import type {
  DependencyPlanPorts,
  DependencyPlanWalk,
  PlanJudgement,
  PlannedCandidate,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-plan.ts";
import type {
  OutOfRangeMember,
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

function fresh(name: string): ResolvedCascadeMember {
  return { key: `${name}@mp`, name, marketplace: "mp", requiredBy: "app@mp", ranges: [] };
}

const PLANNED_NOTHING: DependencyPlanWalk = { kind: "planned", freshMembers: [], outOfRange: [] };

interface Recorded {
  readonly judged: string[];
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
    judge: (member) => {
      calls.judged.push(member.key);
      return (
        overrides.judge?.(member) ??
        Promise.resolve<PlanJudgement<PlannedCandidate>>({
          ok: true,
          prepared: { toVersion: "2.0.0" },
        })
      );
    },
    walk: (member, candidate, planned) => {
      calls.walked.push(`${member.key} ${[...planned].map(([key, v]) => `${key}=${v}`).join(",")}`);
      return overrides.walk?.(member, candidate, planned) ?? Promise.resolve(PLANNED_NOTHING);
    },
    preview: (member) => {
      calls.previewed.push(member.key);
      return overrides.preview?.(member) ?? Promise.resolve();
    },
  };
}

function start(
  overrides: Partial<Parameters<typeof planDependencyMoves>[0]> = {},
): Parameters<typeof planDependencyMoves>[0] {
  return {
    rootKey: "app@mp",
    active: new Set(["app@mp"]),
    freshMembers: [],
    outOfRange: [],
    ...overrides,
  };
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
  assert.deepStrictEqual(plan, { ok: true });
  assert.deepStrictEqual(bound.calls, {
    judged: ["lib@mp"],
    walked: ["lib@mp lib@mp=2.0.0"],
    previewed: ["helper@mp"],
  });
});

test("UPD-DEP-D1: refuses a fresh member the install's preflight refuses, naming it", async () => {
  // arrange
  const refusal = new Error("partially available");
  const bound = ports({ preview: () => Promise.reject(refusal) });

  // act
  const plan = await planDependencyMoves(
    start({ freshMembers: [fresh("helper")], outOfRange: [outOfRange("lib")] }),
    bound,
  );

  // assert
  assert.deepStrictEqual(plan, {
    ok: false,
    subject: { kind: "member", key: "helper@mp", error: refusal, rollbackPartials: [] },
  });
  assert.deepStrictEqual(bound.calls.judged, []);
});

test("UPD-DEP-D1: refuses a move update's preflight refuses, with RESV-05's subject and its cause", async () => {
  // arrange
  const bound = ports({ judge: () => Promise.resolve({ ok: false, cause: "held" }) });

  // act
  const plan = await planDependencyMoves(start({ outOfRange: [outOfRange("lib")] }), bound);

  // assert
  assert.deepStrictEqual(plan, {
    ok: false,
    subject: {
      kind: "constraint",
      failure: {
        kind: "range-conflict",
        why: "installed-unsatisfied",
        key: "lib@mp",
        range: "^2.0.0",
        recordedVersion: "1.0.0",
        moveRefusal: "held",
      },
    },
  });
  assert.deepStrictEqual(bound.calls.walked, []);
});

test("UPD-DEP-D1: refuses a move of a plugin whose own move is in progress up the call chain, without judging it", async () => {
  // arrange
  const bound = ports();

  // act
  const plan = await planDependencyMoves(
    start({ active: new Set(["app@mp", "lib@mp"]), outOfRange: [outOfRange("lib")] }),
    bound,
  );

  // assert
  assert.deepStrictEqual(
    !plan.ok &&
      plan.subject.kind === "constraint" &&
      plan.subject.failure.kind === "range-conflict" &&
      plan.subject.failure.why === "installed-unsatisfied" &&
      plan.subject.failure.moveRefusal,
    "a move of it is already in progress",
  );
  assert.deepStrictEqual(bound.calls.judged, []);
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
  const refusal = new Error("name conflict");
  const bound = ports({
    walk: () => Promise.resolve({ ...PLANNED_NOTHING, freshMembers: [fresh("base")] }),
    preview: (member) => (member.key === "base@mp" ? Promise.reject(refusal) : Promise.resolve()),
  });

  // act
  const plan = await planDependencyMoves(start({ outOfRange: [outOfRange("lib")] }), bound);

  // assert
  assert.deepStrictEqual(plan, {
    ok: false,
    subject: { kind: "member", key: "base@mp", error: refusal, rollbackPartials: [] },
  });
});

test("UPD-DEP-D1: plans a dependency a move's new closure moves once, at the version its first move lands", async () => {
  // arrange
  const bound = ports({
    walk: (member) =>
      Promise.resolve(
        member.key === "aaa@mp"
          ? { ...PLANNED_NOTHING, outOfRange: [outOfRange("zzz", { requiredBy: "aaa@mp" })] }
          : PLANNED_NOTHING,
      ),
  });

  // act
  const plan = await planDependencyMoves(
    start({ outOfRange: [outOfRange("aaa"), outOfRange("zzz")] }),
    bound,
  );

  // assert
  assert.deepStrictEqual(plan, { ok: true });
  assert.deepStrictEqual(bound.calls.judged, ["aaa@mp", "zzz@mp"]);
  assert.deepStrictEqual(bound.calls.walked, [
    "aaa@mp aaa@mp=2.0.0",
    "zzz@mp aaa@mp=2.0.0,zzz@mp=2.0.0",
  ]);
});

test("UPD-DEP-D1: refuses a dependency whose planned version another declaration rejects", async () => {
  // arrange
  const bound = ports({
    walk: (member) =>
      Promise.resolve(
        member.key === "aaa@mp"
          ? {
              ...PLANNED_NOTHING,
              outOfRange: [outOfRange("zzz", { ranges: ["^3.0.0"], range: "^3.0.0" })],
            }
          : PLANNED_NOTHING,
      ),
  });

  // act
  const plan = await planDependencyMoves(
    start({ outOfRange: [outOfRange("zzz"), outOfRange("aaa")] }),
    bound,
  );

  // assert
  assert.deepStrictEqual(plan, {
    ok: false,
    subject: {
      kind: "constraint",
      failure: {
        kind: "range-conflict",
        why: "installed-unsatisfied",
        key: "zzz@mp",
        range: "^3.0.0",
        recordedVersion: "1.0.0",
        moveRefusal: "version 2.0.0, which another move lands, does not satisfy it",
      },
    },
  });
});
