import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { syncWithheldOptionServers } from "../../../extensions/pi-claude-marketplace/bridges/mcp/option-withhold.ts";

import type { RecordedOptionsReading } from "../../../extensions/pi-claude-marketplace/bridges/mcp/option-withhold.ts";

const OPTION = "${PI_CLAUDE_MARKETPLACE_OPTION_0123456789abcdef}";
const MARKER = { plugin: "demo", marketplace: "mp" };

async function adapterFile(t: TestContext, text?: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "mcp-option-withhold-"));
  t.after(() => rm(dir, { recursive: true, force: true, maxRetries: 3 }));
  const filePath = path.join(dir, "mcp-adapter.json");
  if (text !== undefined) {
    await writeFile(filePath, text);
  }

  return filePath;
}

function configText(servers: Record<string, unknown>): string {
  return `${JSON.stringify({ mcpServers: servers }, null, 2)}\n`;
}

function readingFor(reading: RecordedOptionsReading): () => RecordedOptionsReading {
  return () => reading;
}

async function fileIdentity(filePath: string): Promise<readonly bigint[]> {
  const stats = await stat(filePath, { bigint: true });
  return [stats.ino, stats.mtimeNs];
}

test("D-PG10-25: disables an entry that names an option of a record whose options do not parse", async (t) => {
  // arrange
  const filePath = await adapterFile(
    t,
    configText({
      keyed: { command: "srv", args: [OPTION], _piClaudeMarketplace: MARKER },
      plain: { command: "srv", _piClaudeMarketplace: MARKER },
    }),
  );

  // act
  const notices = await syncWithheldOptionServers({
    scope: "user",
    filePath,
    optionsOf: readingFor("unreadable"),
  });

  // assert
  assert.deepStrictEqual(notices, []);
  assert.strictEqual(
    await readFile(filePath, "utf8"),
    configText({
      keyed: {
        command: "srv",
        args: [OPTION],
        disabled: true,
        _piClaudeMarketplace: { ...MARKER, withheld: {} },
      },
      plain: { command: "srv", _piClaudeMarketplace: MARKER },
    }),
  );
});

test("D-PG10-25: keeps the entry's own disabled false in its marker when it withholds it", async (t) => {
  // arrange
  const filePath = await adapterFile(
    t,
    configText({
      keyed: { command: "srv", disabled: false, env: { T: OPTION }, _piClaudeMarketplace: MARKER },
    }),
  );

  // act
  await syncWithheldOptionServers({ scope: "user", filePath, optionsOf: readingFor("unreadable") });

  // assert
  assert.strictEqual(
    await readFile(filePath, "utf8"),
    configText({
      keyed: {
        command: "srv",
        env: { T: OPTION },
        disabled: true,
        _piClaudeMarketplace: { ...MARKER, withheld: { disabled: false } },
      },
    }),
  );
});

test("D-PG10-25: disables a withheld entry again after the user enabled it", async (t) => {
  // arrange
  const filePath = await adapterFile(
    t,
    configText({
      keyed: { command: "srv", args: [OPTION], _piClaudeMarketplace: { ...MARKER, withheld: {} } },
    }),
  );

  // act
  await syncWithheldOptionServers({ scope: "user", filePath, optionsOf: readingFor("unreadable") });

  // assert
  assert.strictEqual(
    await readFile(filePath, "utf8"),
    configText({
      keyed: {
        command: "srv",
        args: [OPTION],
        disabled: true,
        _piClaudeMarketplace: { ...MARKER, withheld: {} },
      },
    }),
  );
});

test("D-PG10-25: puts back the entry's own fields once its record's options read again", async (t) => {
  // arrange
  const filePath = await adapterFile(
    t,
    configText({
      keyed: {
        command: "srv",
        args: [OPTION],
        disabled: true,
        _piClaudeMarketplace: { ...MARKER, defaultFields: { lifecycle: "lazy" }, withheld: {} },
      },
      kept: {
        command: "srv",
        args: [OPTION],
        disabled: true,
        _piClaudeMarketplace: { ...MARKER, withheld: { disabled: false } },
      },
    }),
  );

  // act
  const notices = await syncWithheldOptionServers({
    scope: "project",
    filePath,
    optionsOf: readingFor("readable"),
  });

  // assert
  assert.deepStrictEqual(notices, []);
  assert.strictEqual(
    await readFile(filePath, "utf8"),
    configText({
      keyed: {
        command: "srv",
        args: [OPTION],
        _piClaudeMarketplace: { ...MARKER, defaultFields: { lifecycle: "lazy" } },
      },
      kept: { command: "srv", args: [OPTION], disabled: false, _piClaudeMarketplace: MARKER },
    }),
  );
});

const unchangedCases: readonly {
  readonly name: string;
  readonly servers: Record<string, unknown>;
  readonly reading: RecordedOptionsReading;
}[] = [
  {
    name: "an entry that names no option",
    servers: { plain: { command: "srv", args: ["--x"], _piClaudeMarketplace: MARKER } },
    reading: "unreadable",
  },
  {
    name: "an entry the user disabled",
    servers: {
      keyed: { command: "srv", args: [OPTION], disabled: true, _piClaudeMarketplace: MARKER },
    },
    reading: "unreadable",
  },
  {
    name: "a withheld entry whose owner has no record",
    servers: {
      keyed: {
        command: "srv",
        args: [OPTION],
        disabled: true,
        _piClaudeMarketplace: { ...MARKER, withheld: {} },
      },
    },
    reading: "absent",
  },
  {
    name: "an entry it already withheld",
    servers: {
      keyed: {
        command: "srv",
        args: [OPTION],
        disabled: true,
        _piClaudeMarketplace: { ...MARKER, withheld: {} },
      },
    },
    reading: "unreadable",
  },
  {
    name: "an entry of a record whose options read",
    servers: { keyed: { command: "srv", args: [OPTION], _piClaudeMarketplace: MARKER } },
    reading: "readable",
  },
  {
    name: "an entry with no marker and a non-object entry",
    servers: { theirs: { command: "srv", args: [OPTION] }, odd: "text" },
    reading: "unreadable",
  },
  {
    name: "an entry whose marker holds a withheld member of another shape",
    servers: {
      keyed: { command: "srv", args: [OPTION], _piClaudeMarketplace: { ...MARKER, withheld: [] } },
    },
    reading: "unreadable",
  },
];
for (const { name, servers, reading } of unchangedCases) {
  test(`D-PG10-25: leaves the file unwritten for ${name}`, async (t) => {
    // arrange
    const filePath = await adapterFile(t, configText(servers));
    const before = await fileIdentity(filePath);

    // act
    const notices = await syncWithheldOptionServers({
      scope: "user",
      filePath,
      optionsOf: readingFor(reading),
    });

    // assert
    assert.deepStrictEqual(notices, []);
    assert.deepStrictEqual(await fileIdentity(filePath), before);
  });
}

test("D-PG10-25: reports dropped comments when it rewrites a commented file", async (t) => {
  // arrange
  const filePath = await adapterFile(
    t,
    `{\n  // mine\n  "mcp-servers": {"keyed": {"command": "srv", "args": ["${OPTION}"], "_piClaudeMarketplace": {"plugin": "demo", "marketplace": "mp"}}}\n}\n`,
  );

  // act
  const notices = await syncWithheldOptionServers({
    scope: "project",
    filePath,
    optionsOf: readingFor("unreadable"),
  });

  // assert
  assert.deepStrictEqual(notices, [
    { kind: "comments-dropped", scope: "project", file: "mcp-adapter.json" },
  ]);
  assert.deepStrictEqual(JSON.parse(await readFile(filePath, "utf8")), {
    "mcp-servers": {
      keyed: {
        command: "srv",
        args: [OPTION],
        disabled: true,
        _piClaudeMarketplace: { ...MARKER, withheld: {} },
      },
    },
  });
});

test("D-PG10-25: gives no notice and writes nothing for a missing file", async (t) => {
  // arrange
  const filePath = await adapterFile(t);

  // act
  const notices = await syncWithheldOptionServers({
    scope: "user",
    filePath,
    optionsOf: readingFor("unreadable"),
  });

  // assert
  assert.deepStrictEqual(notices, []);
  await assert.rejects(stat(filePath), { code: "ENOENT" });
});

test("D-PG10-25: leaves a file that does not parse as it is", async (t) => {
  // arrange
  const filePath = await adapterFile(t, "{ not json");

  // act
  const notices = await syncWithheldOptionServers({
    scope: "user",
    filePath,
    optionsOf: readingFor("unreadable"),
  });

  // assert
  assert.deepStrictEqual(notices, []);
  assert.strictEqual(await readFile(filePath, "utf8"), "{ not json");
});

test("D-PG10-25: gives no notice for a path that is not a file", async (t) => {
  // arrange
  const filePath = await adapterFile(t);
  await mkdir(filePath);

  // act
  const notices = await syncWithheldOptionServers({
    scope: "user",
    filePath,
    optionsOf: readingFor("unreadable"),
  });

  // assert
  assert.deepStrictEqual(notices, []);
});

test("D-PG10-25: leaves a commented file unwritten for a caller that keeps commented files", async (t) => {
  // arrange
  const text = `// mine\n${configText({ keyed: { command: "srv", args: [OPTION], _piClaudeMarketplace: MARKER } })}`;
  const filePath = await adapterFile(t, text);

  // act
  const notices = await syncWithheldOptionServers({
    scope: "user",
    filePath,
    keepCommentedFile: true,
    optionsOf: readingFor("unreadable"),
  });

  // assert
  assert.deepStrictEqual(notices, []);
  assert.strictEqual(await readFile(filePath, "utf8"), text);
});
