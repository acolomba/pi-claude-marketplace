import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import type { TestContext } from "node:test";

interface SnippetOutput {
  status: number | null;
  stdout: string;
  stderr: string;
}

async function runExample(
  t: TestContext,
  label: string,
  records: readonly unknown[],
  invocationId = "run-1",
): Promise<SnippetOutput> {
  const guide = await readFile(new URL("../../docs/json-output.md", import.meta.url), "utf8");
  const fences = [...guide.matchAll(/<!-- example: ([\w-]+) -->\s*```bash\n([\s\S]*?)\n```/g)];
  const matching = fences.filter((fence) => fence[1] === label);
  assert.strictEqual(matching.length, 1, `Expected one guide fence: ${label}`);
  const script = matching[0]?.[2];
  assert.ok(script, `Missing executable guide fence: ${label}`);
  const jq = spawnSync("jq", ["--version"], { encoding: "utf8" });
  assert.strictEqual(jq.status, 0, `jq is required: ${jq.error?.message ?? jq.stderr}`);
  const directory = await mkdtemp(path.join(tmpdir(), "json-output-docs-"));
  t.after(async () => {
    await rm(directory, { recursive: true, force: true });
  });
  const inputFile = path.join(directory, "events.jsonl");
  await writeFile(inputFile, records.map((record) => JSON.stringify(record)).join("\n"));
  const execution = spawnSync("bash", ["-c", script], {
    cwd: directory,
    env: { PATH: process.env.PATH, input_file: inputFile, invocation_id: invocationId },
    encoding: "utf8",
    timeout: 5000,
    maxBuffer: 1024 * 1024,
  });
  assert.ifError(execution.error);
  assert.strictEqual(execution.signal, null);
  return { status: execution.status, stdout: execution.stdout, stderr: execution.stderr };
}

function commandEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: "entry_appended",
    entry: {
      type: "custom",
      customType: "claude-plugin",
      data: {
        schemaVersion: 1,
        origin: { kind: "command", commandId: "plugin list", invocationId: "run-1" },
        kind: "cascade",
        severity: "info",
        needsReload: false,
        marketplaces: [],
        ...overrides,
      },
    },
  };
}

test("the documented extraction returns an empty array for an empty inventory", async (t) => {
  // arrange
  const records = [commandEvent()];

  // act
  const extraction = await runExample(t, "extract-plugin-rows", records);

  // assert
  assert.deepStrictEqual(extraction, { status: 0, stdout: "[]\n", stderr: "" });
});

test("the documented extraction preserves populated plugin rows", async (t) => {
  // arrange
  const records = [
    commandEvent({
      marketplaces: [
        {
          name: "tools",
          scope: "user",
          plugins: [{ status: "installed", name: "review", id: "review@tools", reasons: [] }],
        },
      ],
    }),
  ];

  // act
  const extraction = await runExample(t, "extract-plugin-rows", records);

  // assert
  assert.strictEqual(extraction.status, 0);
  assert.strictEqual(extraction.stderr, "");
  assert.deepStrictEqual(JSON.parse(extraction.stdout), [
    { status: "installed", name: "review", id: "review@tools", reasons: [] },
  ]);
});

test("the documented extraction isolates origins and equal command IDs", async (t) => {
  // arrange
  const records = [
    { type: "agent_start" },
    { type: "entry_appended", entry: { type: "custom", customType: "another-extension" } },
    commandEvent({ origin: { kind: "load" }, marketplaces: null }),
    commandEvent({ origin: { kind: "hook" }, marketplaces: null }),
    commandEvent({
      origin: { kind: "command", commandId: "plugin list", invocationId: "run-2" },
      marketplaces: [
        {
          name: "tools",
          scope: "user",
          plugins: [{ status: "installed", name: "lint", id: "lint@tools", reasons: [] }],
        },
      ],
    }),
    commandEvent(),
  ];

  // act
  const extraction = await runExample(t, "extract-plugin-rows", records);
  const otherExtraction = await runExample(t, "extract-plugin-rows", records, "run-2");

  // assert
  assert.deepStrictEqual(extraction, { status: 0, stdout: "[]\n", stderr: "" });
  assert.strictEqual(otherExtraction.status, 0);
  assert.strictEqual(otherExtraction.stderr, "");
  assert.deepStrictEqual(JSON.parse(otherExtraction.stdout), [
    { status: "installed", name: "lint", id: "lint@tools", reasons: [] },
  ]);
});

for (const records of [[], [{ type: "agent_start" }]]) {
  test(`the documented extraction rejects ${records.length === 0 ? "empty" : "unrelated"} input`, async (t) => {
    // arrange
    const label = "extract-plugin-rows";

    // act
    const extraction = await runExample(t, label, records);

    // assert
    assert.strictEqual(extraction.status, 5);
    assert.strictEqual(extraction.stdout, "");
    assert.match(extraction.stderr, /: No command outcome received\n$/);
  });
}
