// tests/platform/removal-ops-contract.ts
//
// The one contract both `RemovalOps` participants answer: the real adapter
// (`createRemovalOps`, driven against a temporary directory from
// `tests/shared/fs-utils.test.ts`) and the in-memory `createRemovalOpsFake`.
// A fake that drifts from the adapter is a fake that proves nothing about the
// production path, so neither participant gets its own private definition of
// "removed".
//
// Categories the project's test rules name, and where each one lands here:
//
//   - missing values: an unforced removal and a rename of an absent source
//     both reject with ENOENT; a forced removal of an absent path resolves.
//   - overwrite: a rename onto an occupied destination replaces its contents.
//   - ordering: two chained renames, where the second can only succeed if it
//     observed the first.
//   - deletion: a file, and a populated tree through a recursive removal.
//   - validation: kind strictness -- a non-recursive removal of a directory
//     rejects with ERR_FS_EISDIR.
//   - aliasing: inapplicable. Both verbs take and return only strings and
//     `void`, so no participant can hand back a reference a caller could
//     mutate into its state.
//   - path containment: deliberately absent. Containment is the caller's
//     obligation through `assertPathInside` (NFR-10); the port replaces the
//     syscall and carries no path authority of its own, so a contract case
//     asserting containment here would pin a promise the port does not make.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

import type { RemovalOps } from "../../extensions/pi-claude-marketplace/shared/fs-utils.ts";

export interface RemovalOpsContractParticipant {
  readonly removalOps: RemovalOps;
  /** A present regular file holding `FILE_CONTENTS`. */
  readonly filePath: string;
  /** A present directory holding `nestedPath`. */
  readonly treePath: string;
  /** A present regular file inside `treePath`. */
  readonly nestedPath: string;
  /** A second present regular file, holding `OCCUPIED_CONTENTS`. */
  readonly occupiedPath: string;
  /** A path nothing has created. */
  readonly absentPath: string;
  /** A second path nothing has created. */
  readonly spareDestination: string;
  present(target: string): Promise<boolean>;
  readFile(target: string): Promise<string | null>;
}

export type RemovalOpsFactory = (
  t: TestContext,
) => RemovalOpsContractParticipant | Promise<RemovalOpsContractParticipant>;

interface RemovalOpsContractCase {
  readonly name: string;
  readonly run: (createRemovalOps: RemovalOpsFactory, t: TestContext) => Promise<void>;
}

export const FILE_CONTENTS = "file-a\n";
export const OCCUPIED_CONTENTS = "file-b\n";
export const NESTED_CONTENTS = "nested-a\n";

export const REMOVAL_OPS_CASE_NAMES = [
  "removes a present file",
  "removes a populated directory through a recursive removal",
  "resolves when a forced removal targets an absent path",
  "rejects an unforced removal of an absent path",
  "rejects a non-recursive removal of a directory",
  "renames a file onto an absent destination",
  "renames a file over an occupied destination",
  "rejects a rename whose source is absent",
  "applies two chained renames in order",
] as const;

function observeVoid(promise: Promise<void>): Promise<unknown> {
  return promise;
}

function assertErrno(error: unknown, code: string): true {
  assert.ok(error instanceof Error);
  assert.strictEqual((error as Error & { code?: string }).code, code);
  return true;
}

export const removalOpsContractCases = [
  {
    name: "removes a present file",
    run: async (createRemovalOps, t) => {
      // arrange
      const participant = await createRemovalOps(t);

      // act
      await participant.removalOps.rm(participant.filePath, { force: true });

      // assert
      assert.strictEqual(await participant.present(participant.filePath), false);
    },
  },
  {
    name: "removes a populated directory through a recursive removal",
    run: async (createRemovalOps, t) => {
      // arrange
      const participant = await createRemovalOps(t);

      // act
      await participant.removalOps.rm(participant.treePath, { recursive: true, force: true });

      // assert
      assert.deepStrictEqual(
        [
          await participant.present(participant.treePath),
          await participant.present(participant.nestedPath),
        ],
        [false, false],
      );
    },
  },
  {
    name: "resolves when a forced removal targets an absent path",
    run: async (createRemovalOps, t) => {
      // arrange
      const participant = await createRemovalOps(t);

      // act
      const removal = await observeVoid(
        participant.removalOps.rm(participant.absentPath, { recursive: true, force: true }),
      );

      // assert
      assert.strictEqual(removal, undefined);
    },
  },
  {
    name: "rejects an unforced removal of an absent path",
    run: async (createRemovalOps, t) => {
      // arrange
      const participant = await createRemovalOps(t);

      // act
      const removal = participant.removalOps.rm(participant.absentPath, {});

      // assert
      await assert.rejects(removal, (error: unknown) => assertErrno(error, "ENOENT"));
    },
  },
  {
    name: "rejects a non-recursive removal of a directory",
    run: async (createRemovalOps, t) => {
      // arrange
      const participant = await createRemovalOps(t);

      // act
      const removal = participant.removalOps.rm(participant.treePath, { force: true });

      // assert
      await assert.rejects(removal, (error: unknown) => assertErrno(error, "ERR_FS_EISDIR"));
      assert.strictEqual(await participant.present(participant.nestedPath), true);
    },
  },
  {
    name: "renames a file onto an absent destination",
    run: async (createRemovalOps, t) => {
      // arrange
      const participant = await createRemovalOps(t);

      // act
      await participant.removalOps.rename(participant.filePath, participant.absentPath);

      // assert
      assert.deepStrictEqual(
        [
          await participant.present(participant.filePath),
          await participant.readFile(participant.absentPath),
        ],
        [false, FILE_CONTENTS],
      );
    },
  },
  {
    name: "renames a file over an occupied destination",
    run: async (createRemovalOps, t) => {
      // arrange
      const participant = await createRemovalOps(t);

      // act
      await participant.removalOps.rename(participant.filePath, participant.occupiedPath);

      // assert
      assert.deepStrictEqual(
        [
          await participant.present(participant.filePath),
          await participant.readFile(participant.occupiedPath),
        ],
        [false, FILE_CONTENTS],
      );
    },
  },
  {
    name: "rejects a rename whose source is absent",
    run: async (createRemovalOps, t) => {
      // arrange
      const participant = await createRemovalOps(t);

      // act
      const renaming = participant.removalOps.rename(
        participant.absentPath,
        participant.spareDestination,
      );

      // assert
      await assert.rejects(renaming, (error: unknown) => assertErrno(error, "ENOENT"));
    },
  },
  {
    name: "applies two chained renames in order",
    run: async (createRemovalOps, t) => {
      // arrange
      const participant = await createRemovalOps(t);

      // act
      await participant.removalOps.rename(participant.filePath, participant.absentPath);
      await participant.removalOps.rename(participant.absentPath, participant.spareDestination);

      // assert
      assert.deepStrictEqual(
        [
          await participant.present(participant.filePath),
          await participant.present(participant.absentPath),
          await participant.readFile(participant.spareDestination),
        ],
        [false, false, FILE_CONTENTS],
      );
    },
  },
] satisfies readonly RemovalOpsContractCase[];

export function registerRemovalOpsContract(createRemovalOps: RemovalOpsFactory): void {
  for (const contractCase of removalOpsContractCases) {
    test(contractCase.name, async (t) => {
      // arrange
      const runCase = contractCase.run;

      // act
      const completed = runCase(createRemovalOps, t);

      // assert
      await completed;
    });
  }
}
