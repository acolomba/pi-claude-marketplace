// The FIFO state server hands exactly one payload to each reader open.
//
// A reader that gets two payloads concatenated produces a JSON parse failure
// deep inside whichever orchestrator is under test, which reads as a flake
// rather than as the harness defect it is. This gate pins the contract at the
// harness itself.
//
// The 200 ms stall is the subject of the test, not a wait for convergence.
// `readFile` is an `open`, then an `fstat`, then a read loop, and a loaded
// runner can deschedule it between those syscalls -- which is the window a
// server that reopens the same inode for write would use to cancel this
// reader's EOF. Holding the fd open across an explicit gap makes that
// interleaving certain instead of rare.

import assert from "node:assert/strict";
import { constants } from "node:fs";
import { mkdtemp, open, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { setTimeout } from "node:timers/promises";

import {
  FIFO_SKIP,
  createStateFifo,
  startFifoStateServer,
} from "../orchestrators/plugin/state-fifo.ts";

import type { FifoStateServer } from "../orchestrators/plugin/state-fifo.ts";

test(
  "the state FIFO server delivers exactly one payload per reader open",
  { skip: FIFO_SKIP, timeout: 60_000 },
  async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "state-fifo-pairing-"));
    let server: FifoStateServer | undefined;

    try {
      const statePath = path.join(dir, "state.json");
      createStateFifo(statePath);

      const first = '{"schemaVersion":2,"marketplaces":{}}\n';
      const second = '{"schemaVersion":2,"marketplaces":{},"x":1}\n';
      server = startFifoStateServer({ statePath, payloads: [first, second] });
      await server.ready;

      const handle = await open(statePath, constants.O_RDONLY);
      await setTimeout(200);
      const firstRead = await handle.readFile("utf8");
      await handle.close();

      // Asserted here, between the two reads, on purpose. A server that serves
      // both payloads to one reader then exits leaves no writer behind, so the
      // second read would block until the test's own timeout. Checking the
      // first payload before issuing the second read keeps that failure fast.
      assert.equal(firstRead, first, "one reader open must receive exactly one payload");

      const secondRead = await readFile(statePath, "utf8");
      assert.equal(secondRead, second);

      assert.deepEqual(await server.complete, { code: 0, signal: null });
      assert.deepEqual(server.messages, ["ready", "served:1", "served:2"]);
      assert.equal((await stat(statePath)).isFIFO(), true);
      assert.deepEqual(
        await readdir(dir),
        ["state.json"],
        "a clean run consumes every spare FIFO it created",
      );
    } finally {
      server?.kill();
      await rm(dir, { recursive: true, force: true });
    }
  },
);
