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
const SPARE_PATH = `${MEMORY_ROOT}/spare`;

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
    occupiedPath: OCCUPIED_PATH,
    absentPath: ABSENT_PATH,
    spareDestination: SPARE_PATH,
    present: (target) => Promise.resolve(removal.present(target)),
    readFile: (target) => Promise.resolve(removal.readFile(target)),
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
    // arrange
    const unboundedOptions = { boundary: "disk" } as unknown as Parameters<
      typeof createRemovalOpsFake
    >[0];

    // act
    const construction = (): unknown => createRemovalOpsFake(unboundedOptions);

    // assert
    assert.throws(construction, {
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

  test("rejects only the faulted rename source", async () => {
    // arrange
    const faultedRename = Object.assign(new Error("backup restore denied"), { code: "EPERM" });
    const removal = createRemovalOpsFake({
      boundary: "memory",
      files: [
        [FILE_PATH, FILE_CONTENTS],
        [OCCUPIED_PATH, OCCUPIED_CONTENTS],
      ],
      renameErrors: [[FILE_PATH, faultedRename]],
    });

    // act
    const faulted = removal.removalOps.rename(FILE_PATH, ABSENT_PATH);
    await removal.removalOps.rename(OCCUPIED_PATH, SPARE_PATH);

    // assert
    await assert.rejects(faulted, (error: unknown) => {
      assert.strictEqual(error, faultedRename);
      return true;
    });
    assert.deepStrictEqual(
      [removal.readFile(FILE_PATH), removal.readFile(ABSENT_PATH), removal.readFile(SPARE_PATH)],
      [FILE_CONTENTS, null, OCCUPIED_CONTENTS],
    );
  });

  test("records every call in the order it received them", async () => {
    // arrange
    const removal = seededFake();

    // act
    await removal.removalOps.rename(FILE_PATH, SPARE_PATH);
    await removal.removalOps.rm(TREE_PATH, { recursive: true, force: true });
    await removal.removalOps.rm(OCCUPIED_PATH, { force: true });

    // assert
    assert.deepStrictEqual(removal.calls, {
      rm: [
        { target: TREE_PATH, options: { recursive: true, force: true } },
        { target: OCCUPIED_PATH, options: { force: true } },
      ],
      rename: [{ from: FILE_PATH, to: SPARE_PATH }],
    });
  });

  test("renames a directory with the entries it contains", async () => {
    // arrange
    const removal = seededFake();

    // act
    await removal.removalOps.rename(TREE_PATH, SPARE_PATH);

    // assert
    assert.deepStrictEqual(
      [
        removal.present(TREE_PATH),
        removal.present(NESTED_PATH),
        removal.present(SPARE_PATH),
        removal.readFile(`${SPARE_PATH}/nested-a.md`),
      ],
      [false, false, true, NESTED_CONTENTS],
    );
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
