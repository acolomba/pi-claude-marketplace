import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import {
  loadAgentsIndex,
  saveAgentsIndex,
} from "../../extensions/pi-claude-marketplace/persistence/agents-index-io.ts";
import { AGENTS_INDEX_ENTRY_VALIDATOR } from "../../extensions/pi-claude-marketplace/persistence/agents-index-schema.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type { LoadedAgentsIndex } from "../../extensions/pi-claude-marketplace/persistence/agents-index-io.ts";
import type { AgentsIndex } from "../../extensions/pi-claude-marketplace/persistence/agents-index-schema.ts";

const ADJACENT_VERSION_INDEX = { schemaVersion: 2, agents: [] } as const;
// @ts-expect-error adjacent versions are rejected by the public runtime validator
const INVALID_AGENTS_INDEX: AgentsIndex = ADJACENT_VERSION_INDEX;

describe("loadAgentsIndex", () => {
  test("returns the complete empty version-1 view when the file is missing", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(os.tmpdir(), "agents-index-missing-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const locations = locationsFor("project", directory);
    const expectedIndex: LoadedAgentsIndex = {
      schemaVersion: 1,
      agents: [],
      corruptions: [],
    };

    // act
    const index = await loadAgentsIndex(locations);

    // assert
    assert.deepStrictEqual(index, expectedIndex);
    assert.strictEqual(Object.isFrozen(index.agents), true);
    assert.strictEqual(Object.isFrozen(index.corruptions), true);
  });

  test("loads an empty version-1 document", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(os.tmpdir(), "agents-index-empty-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const locations = locationsFor("project", directory);
    const indexPath = path.join(locations.extensionRoot, "agents-index.json");
    const expectedIndex: LoadedAgentsIndex = {
      schemaVersion: 1,
      agents: [],
      corruptions: [],
    };
    await mkdir(locations.extensionRoot, { recursive: true });
    await writeFile(indexPath, '{"schemaVersion":1,"agents":[]}', "utf8");

    // act
    const index = await loadAgentsIndex(locations);

    // assert
    assert.deepStrictEqual(index, expectedIndex);
    assert.strictEqual(Object.isFrozen(index.agents), true);
    assert.strictEqual(Object.isFrozen(index.corruptions), true);
  });

  test("loads a complete row with an original model", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(os.tmpdir(), "agents-index-single-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const locations = locationsFor("project", directory);
    const indexPath = path.join(locations.extensionRoot, "agents-index.json");
    const expectedIndex: LoadedAgentsIndex = {
      schemaVersion: 1,
      agents: [
        {
          plugin: "calendar",
          marketplace: "work-tools",
          sourceAgent: "scheduler",
          generatedName: "work-tools-calendar-scheduler",
          sourcePath: "/plugins/calendar/agents/scheduler.md",
          targetPath: "/project/agents/work-tools-calendar-scheduler.md",
          sourceHash: "hash-scheduler",
          originalModel: "sonnet",
          droppedFields: ["permissionMode"],
          droppedTools: ["NotebookEdit"],
          warnings: ["permissionMode was dropped"],
        },
      ],
      corruptions: [],
    };
    await mkdir(locations.extensionRoot, { recursive: true });
    await writeFile(
      indexPath,
      JSON.stringify({
        schemaVersion: 1,
        agents: [
          {
            plugin: "calendar",
            marketplace: "work-tools",
            sourceAgent: "scheduler",
            generatedName: "work-tools-calendar-scheduler",
            sourcePath: "/plugins/calendar/agents/scheduler.md",
            targetPath: "/project/agents/work-tools-calendar-scheduler.md",
            sourceHash: "hash-scheduler",
            originalModel: "sonnet",
            droppedFields: ["permissionMode"],
            droppedTools: ["NotebookEdit"],
            warnings: ["permissionMode was dropped"],
          },
        ],
      }),
      "utf8",
    );

    // act
    const index = await loadAgentsIndex(locations);

    // assert
    assert.deepStrictEqual(index, expectedIndex);
    assert.strictEqual(Object.isFrozen(index.agents), true);
    assert.strictEqual(Object.isFrozen(index.corruptions), true);
  });

  test("loads several rows when the optional original model is absent", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(os.tmpdir(), "agents-index-multiple-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const locations = locationsFor("project", directory);
    const indexPath = path.join(locations.extensionRoot, "agents-index.json");
    const expectedIndex: LoadedAgentsIndex = {
      schemaVersion: 1,
      agents: [
        {
          plugin: "calendar",
          marketplace: "work-tools",
          sourceAgent: "scheduler",
          generatedName: "work-tools-calendar-scheduler",
          sourcePath: "/plugins/calendar/agents/scheduler.md",
          targetPath: "/project/agents/work-tools-calendar-scheduler.md",
          sourceHash: "hash-scheduler",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
        {
          plugin: "mail",
          marketplace: "work-tools",
          sourceAgent: "triage",
          generatedName: "work-tools-mail-triage",
          sourcePath: "/plugins/mail/agents/triage.md",
          targetPath: "/project/agents/work-tools-mail-triage.md",
          sourceHash: "hash-triage",
          droppedFields: ["skills"],
          droppedTools: ["WebFetch"],
          warnings: ["skills were dropped"],
        },
      ],
      corruptions: [],
    };
    await mkdir(locations.extensionRoot, { recursive: true });
    await writeFile(
      indexPath,
      JSON.stringify({
        schemaVersion: 1,
        agents: [
          {
            plugin: "calendar",
            marketplace: "work-tools",
            sourceAgent: "scheduler",
            generatedName: "work-tools-calendar-scheduler",
            sourcePath: "/plugins/calendar/agents/scheduler.md",
            targetPath: "/project/agents/work-tools-calendar-scheduler.md",
            sourceHash: "hash-scheduler",
            droppedFields: [],
            droppedTools: [],
            warnings: [],
          },
          {
            plugin: "mail",
            marketplace: "work-tools",
            sourceAgent: "triage",
            generatedName: "work-tools-mail-triage",
            sourcePath: "/plugins/mail/agents/triage.md",
            targetPath: "/project/agents/work-tools-mail-triage.md",
            sourceHash: "hash-triage",
            droppedFields: ["skills"],
            droppedTools: ["WebFetch"],
            warnings: ["skills were dropped"],
          },
        ],
      }),
      "utf8",
    );

    // act
    const index = await loadAgentsIndex(locations);

    // assert
    assert.deepStrictEqual(index, expectedIndex);
    assert.strictEqual(Object.isFrozen(index.agents), true);
    assert.strictEqual(Object.isFrozen(index.corruptions), true);
  });

  test("retains malformed JSON as the parse failure cause", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(os.tmpdir(), "agents-index-json-error-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const locations = locationsFor("project", directory);
    const indexPath = path.join(locations.extensionRoot, "agents-index.json");
    await mkdir(locations.extensionRoot, { recursive: true });
    await writeFile(indexPath, "not json", "utf8");

    // act & assert
    await assert.rejects(
      () => loadAgentsIndex(locations),
      (error: unknown) => {
        assert.ok(error instanceof TypeError);
        assert.ok(error.cause instanceof SyntaxError);
        assert.strictEqual(
          error.message,
          `Failed to parse agents-index at ${indexPath}: ${error.cause.message}`,
        );
        return true;
      },
    );
  });

  test("rejects an adjacent agents-index schema version", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(os.tmpdir(), "agents-index-version-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const locations = locationsFor("project", directory);
    const indexPath = path.join(locations.extensionRoot, "agents-index.json");
    await mkdir(locations.extensionRoot, { recursive: true });
    await writeFile(indexPath, '{"schemaVersion":2,"agents":[]}', "utf8");

    // act & assert
    await assert.rejects(
      () => loadAgentsIndex(locations),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.deepStrictEqual(
          { name: error.name, message: error.message },
          {
            name: "Error",
            message: `Unsupported agents-index schema at ${indexPath}: expected schemaVersion 1.`,
          },
        );
        return true;
      },
    );
  });

  test("rejects a non-object agents-index envelope", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(os.tmpdir(), "agents-index-envelope-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const locations = locationsFor("project", directory);
    const indexPath = path.join(locations.extensionRoot, "agents-index.json");
    await mkdir(locations.extensionRoot, { recursive: true });
    await writeFile(indexPath, '"agents-index"', "utf8");

    // act & assert
    await assert.rejects(
      () => loadAgentsIndex(locations),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.deepStrictEqual(
          { name: error.name, message: error.message },
          {
            name: "Error",
            message: `Unsupported agents-index schema at ${indexPath}: expected schemaVersion 1.`,
          },
        );
        return true;
      },
    );
  });

  test("rejects a version-1 envelope without the agents array", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(os.tmpdir(), "agents-index-array-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const locations = locationsFor("project", directory);
    const indexPath = path.join(locations.extensionRoot, "agents-index.json");
    await mkdir(locations.extensionRoot, { recursive: true });
    await writeFile(indexPath, '{"schemaVersion":1}', "utf8");

    // act & assert
    await assert.rejects(
      () => loadAgentsIndex(locations),
      (error: unknown) => {
        assert.ok(error instanceof TypeError);
        assert.deepStrictEqual(
          { name: error.name, message: error.message },
          {
            name: "TypeError",
            message: `Invalid agents-index at ${indexPath}: 'agents' field must be an array.`,
          },
        );
        return true;
      },
    );
  });

  test("propagates an ordinary filesystem read failure", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(os.tmpdir(), "agents-index-read-error-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const locations = locationsFor("project", directory);
    const indexPath = path.join(locations.extensionRoot, "agents-index.json");
    await mkdir(indexPath, { recursive: true });

    // act & assert
    await assert.rejects(
      () => loadAgentsIndex(locations),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.deepStrictEqual(
          {
            name: error.name,
            code: (error as NodeJS.ErrnoException).code,
            syscall: (error as NodeJS.ErrnoException).syscall,
          },
          { name: "Error", code: "EISDIR", syscall: "read" },
        );
        return true;
      },
    );
  });

  test("drops one corrupt row without discarding valid adjacent rows", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(os.tmpdir(), "agents-index-row-error-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const locations = locationsFor("project", directory);
    const indexPath = path.join(locations.extensionRoot, "agents-index.json");
    const expectedIndex: LoadedAgentsIndex = {
      schemaVersion: 1,
      agents: [
        {
          plugin: "calendar",
          marketplace: "work-tools",
          sourceAgent: "scheduler",
          generatedName: "work-tools-calendar-scheduler",
          sourcePath: "/plugins/calendar/agents/scheduler.md",
          targetPath: "/project/agents/work-tools-calendar-scheduler.md",
          sourceHash: "hash-scheduler",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
        {
          plugin: "mail",
          marketplace: "work-tools",
          sourceAgent: "triage",
          generatedName: "work-tools-mail-triage",
          sourcePath: "/plugins/mail/agents/triage.md",
          targetPath: "/project/agents/work-tools-mail-triage.md",
          sourceHash: "hash-triage",
          droppedFields: [],
          droppedTools: ["WebFetch"],
          warnings: ["WebFetch was dropped"],
        },
      ],
      corruptions: [
        `${indexPath}.agents[1]: row failed schema validation (entry dropped) -- <root>: must have required properties generatedName`,
      ],
    };
    await mkdir(locations.extensionRoot, { recursive: true });
    await writeFile(
      indexPath,
      JSON.stringify({
        schemaVersion: 1,
        agents: [
          {
            plugin: "calendar",
            marketplace: "work-tools",
            sourceAgent: "scheduler",
            generatedName: "work-tools-calendar-scheduler",
            sourcePath: "/plugins/calendar/agents/scheduler.md",
            targetPath: "/project/agents/work-tools-calendar-scheduler.md",
            sourceHash: "hash-scheduler",
            droppedFields: [],
            droppedTools: [],
            warnings: [],
          },
          {
            plugin: "broken",
            marketplace: "work-tools",
            sourceAgent: "missing-name",
            sourcePath: "/plugins/broken/agents/missing-name.md",
            targetPath: "/project/agents/work-tools-broken-missing-name.md",
            sourceHash: "hash-broken",
            droppedFields: [],
            droppedTools: [],
            warnings: [],
          },
          {
            plugin: "mail",
            marketplace: "work-tools",
            sourceAgent: "triage",
            generatedName: "work-tools-mail-triage",
            sourcePath: "/plugins/mail/agents/triage.md",
            targetPath: "/project/agents/work-tools-mail-triage.md",
            sourceHash: "hash-triage",
            droppedFields: [],
            droppedTools: ["WebFetch"],
            warnings: ["WebFetch was dropped"],
          },
        ],
      }),
      "utf8",
    );

    // act
    const index = await loadAgentsIndex(locations);

    // assert
    assert.deepStrictEqual(index, expectedIndex);
    assert.strictEqual(Object.isFrozen(index.agents), true);
    assert.strictEqual(Object.isFrozen(index.corruptions), true);
  });

  test("uses the complete no-detail fallback for an invalid row", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(os.tmpdir(), "agents-index-no-detail-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const locations = locationsFor("project", directory);
    const indexPath = path.join(locations.extensionRoot, "agents-index.json");
    const expectedIndex: LoadedAgentsIndex = {
      schemaVersion: 1,
      agents: [],
      corruptions: [
        `${indexPath}.agents[0]: row failed schema validation (entry dropped) -- (no detail available)`,
      ],
    };
    t.mock.method(AGENTS_INDEX_ENTRY_VALIDATOR, "Errors", () => []);
    await mkdir(locations.extensionRoot, { recursive: true });
    await writeFile(indexPath, '{"schemaVersion":1,"agents":[{}]}', "utf8");

    // act
    const index = await loadAgentsIndex(locations);

    // assert
    assert.deepStrictEqual(index, expectedIndex);
    assert.strictEqual(Object.isFrozen(index.agents), true);
    assert.strictEqual(Object.isFrozen(index.corruptions), true);
  });
});

describe("saveAgentsIndex", () => {
  test("atomically writes exact JSON bytes and creates the parent tree", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(os.tmpdir(), "agents-index-save-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const locations = locationsFor("project", directory);
    const indexPath = path.join(locations.extensionRoot, "agents-index.json");
    const index: AgentsIndex = {
      schemaVersion: 1,
      agents: [
        {
          plugin: "review",
          marketplace: "developer-tools",
          sourceAgent: "reviewer",
          generatedName: "developer-tools-review-reviewer",
          sourcePath: "/plugins/review/agents/reviewer.md",
          targetPath: "/project/agents/developer-tools-review-reviewer.md",
          sourceHash: "hash-reviewer",
          droppedFields: [],
          droppedTools: ["Task"],
          warnings: ["Task was dropped"],
        },
      ],
    };
    const expectedJsonBytes =
      '{\n  "schemaVersion": 1,\n  "agents": [\n    {\n      "plugin": "review",\n      "marketplace": "developer-tools",\n      "sourceAgent": "reviewer",\n      "generatedName": "developer-tools-review-reviewer",\n      "sourcePath": "/plugins/review/agents/reviewer.md",\n      "targetPath": "/project/agents/developer-tools-review-reviewer.md",\n      "sourceHash": "hash-reviewer",\n      "droppedFields": [],\n      "droppedTools": [\n        "Task"\n      ],\n      "warnings": [\n        "Task was dropped"\n      ]\n    }\n  ]\n}\n';
    const expectedLoadedIndex: LoadedAgentsIndex = {
      schemaVersion: 1,
      agents: [
        {
          plugin: "review",
          marketplace: "developer-tools",
          sourceAgent: "reviewer",
          generatedName: "developer-tools-review-reviewer",
          sourcePath: "/plugins/review/agents/reviewer.md",
          targetPath: "/project/agents/developer-tools-review-reviewer.md",
          sourceHash: "hash-reviewer",
          droppedFields: [],
          droppedTools: ["Task"],
          warnings: ["Task was dropped"],
        },
      ],
      corruptions: [],
    };

    // act
    await saveAgentsIndex(locations, index);
    const jsonBytes = await readFile(indexPath, "utf8");
    const loadedIndex = await loadAgentsIndex(locations);

    // assert
    assert.strictEqual(jsonBytes, expectedJsonBytes);
    assert.deepStrictEqual(loadedIndex, expectedLoadedIndex);
  });

  test("rejects an invalid document without changing stored bytes", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(os.tmpdir(), "agents-index-save-error-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const locations = locationsFor("project", directory);
    const indexPath = path.join(locations.extensionRoot, "agents-index.json");
    const expectedJsonBytes = '{"schemaVersion":1,"agents":[]}\n';
    await mkdir(locations.extensionRoot, { recursive: true });
    await writeFile(indexPath, expectedJsonBytes, "utf8");

    // act
    let saveError: unknown;
    try {
      await saveAgentsIndex(locations, INVALID_AGENTS_INDEX);
    } catch (error) {
      saveError = error;
    }

    const jsonBytes = await readFile(indexPath, "utf8");

    // assert
    assert.ok(saveError instanceof Error);
    assert.deepStrictEqual(
      { name: saveError.name, message: saveError.message },
      {
        name: "Error",
        message: "saveAgentsIndex refused: index does not match AGENTS_INDEX_SCHEMA.",
      },
    );
    assert.strictEqual(jsonBytes, expectedJsonBytes);
  });
});
