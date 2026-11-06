import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import {
  loadAgentsIndex,
  saveAgentsIndex,
  storedGrantForms,
} from "../../extensions/pi-claude-marketplace/persistence/agents-index-io.ts";
import { AGENTS_INDEX_ENTRY_VALIDATOR } from "../../extensions/pi-claude-marketplace/persistence/agents-index-schema.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { captureDebugLog } from "../platform/debug-log-capture.ts";

import type {
  AgentsIndexDocument,
  AgentsIndexRow,
  LoadedAgentsIndex,
} from "../../extensions/pi-claude-marketplace/persistence/agents-index-io.ts";

const ADJACENT_VERSION_INDEX = { schemaVersion: 2, agents: [] } as const;
// @ts-expect-error adjacent versions are rejected by the public runtime validator
const INVALID_AGENTS_INDEX: AgentsIndexDocument = ADJACENT_VERSION_INDEX;

const row = {
  plugin: "demo",
  marketplace: "tools",
  sourceAgent: "runner",
  generatedName: "pi-claude-marketplace-demo-runner",
  sourcePath: "/plugins/demo/agents/runner.md",
  targetPath: "/project/agents/pi-claude-marketplace-demo-runner.md",
  sourceHash: "hash-runner",
  droppedFields: [],
  droppedTools: [],
  warnings: ["builtin warning"],
};
const mcpForms = {
  adapter: {
    frontmatter: "---\ntools: mcp:plugin_demo_stub_/echo\n---\n",
    warnings: ["adapter warning"],
    droppedTools: [],
  },
  builtin: {
    frontmatter: "---\ntools: mcp:plugin_demo_stub/echo\n---\n",
    warnings: ["builtin warning"],
    droppedTools: ["mcp__plugin_demo_events__watch"],
  },
};

// AGENTIDXFORM-01: a row that records an implementation stores that implementation's form.
void ({
  ...row,
  mcpImplementation: "builtin",
  mcpForms: { builtin: mcpForms.builtin },
} satisfies AgentsIndexRow);
// @ts-expect-error AGENTIDXFORM-01: a row that records an implementation must store its form
void ({ ...row, mcpImplementation: "adapter" } satisfies AgentsIndexRow);
// @ts-expect-error AGENTIDXFORM-01: a row that stores forms must record the file's implementation
void ({ ...row, mcpForms: { adapter: mcpForms.adapter } } satisfies AgentsIndexRow);
const adapterRowWithBuiltinFormOnly = {
  ...row,
  mcpImplementation: "adapter" as const,
  mcpForms: { builtin: mcpForms.builtin },
};
// @ts-expect-error AGENTIDXFORM-01: a row that records the adapter must store the adapter form
void (adapterRowWithBuiltinFormOnly satisfies AgentsIndexRow);

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

describe("agents index MCP grant forms", () => {
  test("MGRT-01: a save then a load returns a row's implementation and both forms unchanged", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(os.tmpdir(), "agents-index-mcp-forms-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const locations = locationsFor("project", directory);
    const index: AgentsIndexDocument = {
      schemaVersion: 1,
      agents: [{ ...row, mcpImplementation: "builtin", mcpForms }],
    };
    const expectedIndex: LoadedAgentsIndex = {
      schemaVersion: 1,
      agents: [{ ...row, mcpImplementation: "builtin", mcpForms }],
      corruptions: [],
    };

    // act
    await saveAgentsIndex(locations, index);
    const loadedIndex = await loadAgentsIndex(locations);

    // assert
    assert.deepStrictEqual(loadedIndex, expectedIndex);
  });

  test("MGRT-01: a load drops only a row whose implementation is none", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(os.tmpdir(), "agents-index-mcp-none-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const locations = locationsFor("project", directory);
    const indexPath = path.join(locations.extensionRoot, "agents-index.json");
    const keptRow = { ...row, mcpImplementation: "adapter" as const, mcpForms };
    const expectedIndex: LoadedAgentsIndex = {
      schemaVersion: 1,
      agents: [keptRow],
      corruptions: [
        `${indexPath}.agents[1]: row failed schema validation (entry dropped) -- /mcpImplementation: must be equal to constant`,
      ],
    };
    await mkdir(locations.extensionRoot, { recursive: true });
    await writeFile(
      indexPath,
      JSON.stringify({
        schemaVersion: 1,
        agents: [keptRow, { ...row, generatedName: "none-row", mcpImplementation: "none" }],
      }),
      "utf8",
    );

    // act
    const index = await loadAgentsIndex(locations);

    // assert
    assert.deepStrictEqual(index, expectedIndex);
  });

  for (const { label, pair, logged } of [
    {
      label: "an implementation without stored forms",
      pair: { mcpImplementation: "adapter" },
      logged: "mcpImplementation adapter, mcpForms []",
    },
    {
      label: "stored forms without an implementation",
      pair: { mcpForms: { adapter: mcpForms.adapter } },
      logged: "mcpImplementation undefined, mcpForms [adapter]",
    },
    {
      label: "an implementation whose form is not stored",
      pair: { mcpImplementation: "adapter", mcpForms: { builtin: mcpForms.builtin } },
      logged: "mcpImplementation adapter, mcpForms [builtin]",
    },
  ]) {
    test(`AGENTIDXFORM-01: a row with ${label} loads without stored grant forms`, async (t) => {
      // arrange
      const directory = await mkdtemp(path.join(os.tmpdir(), "agents-index-mcp-unmatched-"));
      t.after(() => rm(directory, { recursive: true, force: true }));
      const locations = locationsFor("project", directory);
      const indexPath = path.join(locations.extensionRoot, "agents-index.json");
      const expectedIndex: LoadedAgentsIndex = { schemaVersion: 1, agents: [row], corruptions: [] };
      await mkdir(locations.extensionRoot, { recursive: true });
      await writeFile(
        indexPath,
        JSON.stringify({ schemaVersion: 1, agents: [{ ...row, ...pair }] }),
        "utf8",
      );
      const debugLines = captureDebugLog(t);

      // act
      const index = await loadAgentsIndex(locations);

      // assert
      assert.deepStrictEqual(index, expectedIndex);
      assert.deepStrictEqual(debugLines, [
        `[mcp] agent pi-claude-marketplace-demo-runner: stored grant forms ignored: ${logged}`,
      ]);
    });
  }

  for (const { label, held, other, expected } of [
    {
      label: "the adapter form alone",
      held: "adapter",
      other: undefined,
      expected: { mcpImplementation: "adapter", mcpForms: { adapter: mcpForms.adapter } },
    },
    {
      label: "the adapter form with the other implementation's form",
      held: "adapter",
      other: mcpForms.builtin,
      expected: {
        mcpImplementation: "adapter",
        mcpForms: { adapter: mcpForms.adapter, builtin: mcpForms.builtin },
      },
    },
    {
      label: "the builtin form alone",
      held: "builtin",
      other: undefined,
      expected: { mcpImplementation: "builtin", mcpForms: { builtin: mcpForms.builtin } },
    },
    {
      label: "the builtin form with the other implementation's form",
      held: "builtin",
      other: mcpForms.adapter,
      expected: {
        mcpImplementation: "builtin",
        mcpForms: { builtin: mcpForms.builtin, adapter: mcpForms.adapter },
      },
    },
  ] as const) {
    test(`AGENTIDXFORM-01: storedGrantForms stores ${label}`, () => {
      // arrange
      const heldForm = held === "adapter" ? mcpForms.adapter : mcpForms.builtin;

      // act
      const stored = storedGrantForms(held, heldForm, other);

      // assert
      assert.deepStrictEqual(stored, expected);
    });
  }
});

describe("saveAgentsIndex", () => {
  test("atomically writes exact JSON bytes and creates the parent tree", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(os.tmpdir(), "agents-index-save-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const locations = locationsFor("project", directory);
    const indexPath = path.join(locations.extensionRoot, "agents-index.json");
    const index: AgentsIndexDocument = {
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
