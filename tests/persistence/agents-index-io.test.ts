import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import {
  loadAgentsIndex,
  saveAgentsIndex,
} from "../../extensions/pi-claude-marketplace/persistence/agents-index-io.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type { LoadedAgentsIndex } from "../../extensions/pi-claude-marketplace/persistence/agents-index-io.ts";
import type { AgentsIndex } from "../../extensions/pi-claude-marketplace/persistence/agents-index-schema.ts";

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
});
