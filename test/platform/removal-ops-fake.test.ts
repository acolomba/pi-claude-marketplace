import assert from "node:assert/strict";
import { describe, test, type TestContext } from "node:test";

import {
  FILE_CONTENTS,
  NESTED_CONTENTS,
  OCCUPIED_CONTENTS,
  REMOVAL_OPS_CASE_NAMES,
  registerRemovalOpsContract,
  removalOpsContractCases,
  type RemovalOpsContractParticipant,
  type RemovalOpsFactory,
} from "./removal-ops-contract.ts";
import { createRemovalOpsFake } from "./removal-ops-fake.ts";

const MEMORY_ROOT = "/memory/removal";
const FILE_PATH = `${MEMORY_ROOT}/file-a.md`;
const TREE_PATH = `${MEMORY_ROOT}/tree`;
const NESTED_PATH = `${TREE_PATH}/nested-a.md`;
const OCCUPIED_PATH = `${MEMORY_ROOT}/file-b.md`;
const ABSENT_PATH = `${MEMORY_ROOT}/absent`;

function seededFake(): ReturnType<typeof createRemovalOpsFake> {
  return createRemovalOpsFake({
    boundary: "memory",
    files: [
      [FILE_PATH, FILE_CONTENTS],
      [OCCUPIED_PATH, OCCUPIED_CONTENTS],
      [NESTED_PATH, NESTED_CONTENTS],
    ],
    directories: [TREE_PATH],
  });
}

function createFakeParticipant(): RemovalOpsContractParticipant {
  const removal = seededFake();

  return {
    removalOps: removal.removalOps,
    filePath: FILE_PATH,
    treePath: TREE_PATH,
    nestedPath: NESTED_PATH,
    absentPath: ABSENT_PATH,
    present: (target) => Promise.resolve(removal.present(target)),
  };
}

/** A fake whose `rm` reports success and removes nothing. */
function createSilentRemovalParticipant(): RemovalOpsContractParticipant {
  const participant = createFakeParticipant();

  return {
    ...participant,
    removalOps: {
      ...participant.removalOps,
      async rm() {
        await Promise.resolve();
      },
    },
  };
}

describe("createRemovalOpsFake", () => {
  registerRemovalOpsContract(async () => {
    await Promise.resolve();
    return createFakeParticipant();
  });

  test("refuses construction without the explicit memory boundary", () => {
    // act & assert
    assert.throws(() => Reflect.apply(createRemovalOpsFake, undefined, [{ boundary: "disk" }]), {
      name: "Error",
      message: "createRemovalOpsFake requires the explicit memory boundary",
    });
  });

  test("rejects only the faulted target and leaves its siblings removable", async () => {
    // arrange
    const faultedRemoval = Object.assign(new Error("staging cleanup denied"), { code: "EACCES" });
    const removal = createRemovalOpsFake({
      boundary: "memory",
      files: [
        [FILE_PATH, FILE_CONTENTS],
        [OCCUPIED_PATH, OCCUPIED_CONTENTS],
      ],
      rmErrors: [[FILE_PATH, faultedRemoval]],
    });

    // act
    const faulted = removal.removalOps.rm(FILE_PATH, { recursive: true, force: true });
    await removal.removalOps.rm(OCCUPIED_PATH, { recursive: true, force: true });

    // assert
    await assert.rejects(faulted, (error: unknown) => {
      assert.strictEqual(error, faultedRemoval);
      return true;
    });
    assert.deepStrictEqual(
      [removal.present(FILE_PATH), removal.present(OCCUPIED_PATH)],
      [true, false],
    );
  });

  test("records every call in the order it received them", async () => {
    // arrange
    const removal = seededFake();

    // act
    await removal.removalOps.rm(TREE_PATH, { recursive: true, force: true });
    await removal.removalOps.rm(OCCUPIED_PATH, { force: true });

    // assert
    assert.deepStrictEqual(removal.calls, {
      rm: [
        { target: TREE_PATH, options: { recursive: true, force: true } },
        { target: OCCUPIED_PATH, options: { force: true } },
      ],
    });
  });
});

test("the silent-removal fake fails exactly the contract's removal invariants", async (t) => {
  // arrange
  const failures: string[] = [];
  const createSilentRemovalOps: RemovalOpsFactory = async (_t: TestContext) => {
    await Promise.resolve();
    return createSilentRemovalParticipant();
  };

  // act
  for (const contractCase of removalOpsContractCases) {
    try {
      await contractCase.run(createSilentRemovalOps, t);
    } catch (error) {
      if (!(error instanceof assert.AssertionError)) {
        throw error;
      }

      failures.push(contractCase.name);
    }
  }

  // assert
  assert.deepStrictEqual(
    removalOpsContractCases.map((contractCase) => contractCase.name),
    REMOVAL_OPS_CASE_NAMES,
  );
  assert.deepStrictEqual(failures, [
    "removes a present file",
    "removes a populated directory through a recursive removal",
    "rejects an unforced removal of an absent path",
    "rejects a non-recursive removal of a directory",
  ]);
});
