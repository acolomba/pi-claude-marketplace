import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { Compile } from "typebox/compile";

import type { TestContext } from "node:test";
import type { TSchema } from "typebox";

interface SnippetOutput {
  status: number | null;
  stdout: string;
  stderr: string;
}

function guideExample(guide: string, label: string): string {
  const fences = [...guide.matchAll(/<!-- example: ([\w-]+) -->\s*```bash\n([\s\S]*?)\n```/g)];
  const matching = fences.filter((fence) => fence[1] === label);
  assert.strictEqual(matching.length, 1, `Expected one guide fence: ${label}`);
  const script = matching[0]?.[2];
  assert.ok(script, `Missing executable guide fence: ${label}`);
  return script;
}

async function runExample(
  t: TestContext,
  label: string,
  records: readonly unknown[] | string,
  invocationId = "run-1",
): Promise<SnippetOutput> {
  const guide = await readFile(new URL("../../docs/json-output.md", import.meta.url), "utf8");
  const preparation = ["command-severity", "command-exit-status", "needs-reload"].includes(label)
    ? guideExample(guide, "prepare-command")
    : "";
  const script = `${preparation}\n${guideExample(guide, label)}`;
  const jq = spawnSync("jq", ["--version"], { encoding: "utf8" });
  assert.strictEqual(jq.status, 0, `jq is required: ${jq.error?.message ?? jq.stderr}`);
  const directory = await mkdtemp(path.join(tmpdir(), "json-output-docs-"));
  t.after(async () => {
    await rm(directory, { recursive: true, force: true });
  });
  const inputFile = path.join(directory, "events.jsonl");
  await writeFile(
    inputFile,
    typeof records === "string"
      ? records
      : records.map((record) => JSON.stringify(record)).join("\n"),
  );
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

function commandEvent(overrides: Record<string, unknown> = {}) {
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
    assert.deepStrictEqual(extraction, {
      status: 1,
      stdout: "",
      stderr: "No command outcome received\n",
    });
  });
}

for (const { severity, exitStatus, stderr } of [
  { severity: "info", exitStatus: 0, stderr: "" },
  { severity: "warning", exitStatus: 0, stderr: "" },
  { severity: "error", exitStatus: 1, stderr: "Command reported an error\n" },
]) {
  test(`the exit example displays ${severity} and exits ${exitStatus}`, async (t) => {
    // arrange
    const event = commandEvent({ severity, summary: "Review the plugin result." });

    // act
    const execution = await runExample(t, "command-exit-status", [event]);

    // assert
    assert.strictEqual(execution.status, exitStatus);
    assert.strictEqual(execution.stderr, stderr);
    assert.deepStrictEqual(JSON.parse(execution.stdout), event.entry.data);
  });

  test(`the severity example reports a lone ${severity} outcome`, async (t) => {
    // arrange
    const event = commandEvent({ severity });

    // act
    const execution = await runExample(t, "command-severity", [event]);

    // assert
    assert.deepStrictEqual(execution, { status: 0, stdout: `${severity}\n`, stderr: "" });
  });
}

for (const { severities, maximum, status, stderr } of [
  {
    severities: ["info", "error"],
    maximum: "error",
    status: 1,
    stderr: "Command reported an error\n",
  },
  {
    severities: ["error", "info"],
    maximum: "error",
    status: 1,
    stderr: "Command reported an error\n",
  },
  { severities: ["warning", "info"], maximum: "warning", status: 0, stderr: "" },
  { severities: ["info", "warning"], maximum: "warning", status: 0, stderr: "" },
  {
    severities: ["warning", "error"],
    maximum: "error",
    status: 1,
    stderr: "Command reported an error\n",
  },
  {
    severities: ["error", "warning"],
    maximum: "error",
    status: 1,
    stderr: "Command reported an error\n",
  },
]) {
  test(`the severity example ranks ${severities.join(" then ")} as ${maximum}`, async (t) => {
    // arrange
    const records = severities.map((severity) => commandEvent({ severity }));

    // act
    const execution = await runExample(t, "command-severity", records);
    const exit = await runExample(t, "command-exit-status", records);

    // assert
    assert.deepStrictEqual(execution, { status: 0, stdout: `${maximum}\n`, stderr: "" });
    assert.strictEqual(exit.status, status);
    assert.strictEqual(exit.stderr, stderr);
    assert.deepStrictEqual(
      exit.stdout
        .trim()
        .split("\n")
        .map((line): unknown => JSON.parse(line)),
      records.map((record) => record.entry.data),
    );
  });
}

for (const { flags, needsReload } of [
  { flags: [false], needsReload: false },
  { flags: [true, false], needsReload: true },
  { flags: [false, true], needsReload: true },
  { flags: [false, false], needsReload: false },
]) {
  test(`the reload example ORs ${flags.join(" and ")} to ${needsReload}`, async (t) => {
    // arrange
    const records = flags.map((flag) => commandEvent({ needsReload: flag }));

    // act
    const execution = await runExample(t, "needs-reload", records);

    // assert
    assert.deepStrictEqual(execution, { status: 0, stdout: `${needsReload}\n`, stderr: "" });
  });
}

for (const label of ["command-severity", "command-exit-status", "needs-reload"]) {
  for (const { name, records } of [
    { name: "empty input", records: [] },
    { name: "unrelated events", records: [{ type: "agent_start" }] },
    { name: "load only", records: [commandEvent({ origin: { kind: "load" } })] },
    { name: "hook only", records: [commandEvent({ origin: { kind: "hook" } })] },
    ...[
      "diagnostic",
      "device-flow-prompt",
      "reconcile-aborted",
      "plugin-path-skipped",
      "async-rewake-summary",
      "stop-override-cap",
      "future-kind",
    ].map((kind) => ({ name: `${kind} only`, records: [commandEvent({ kind })] })),
  ]) {
    test(`${label} rejects ${name} without a command outcome`, async (t) => {
      // arrange
      const expected = { status: 1, stdout: "", stderr: "No command outcome received\n" };

      // act
      const execution = await runExample(t, label, records);

      // assert
      assert.deepStrictEqual(execution, expected);
    });
  }

  for (const invalid of [
    { severity: "fatal" },
    { severity: "INFO" },
    { severity: null },
    { needsReload: "false" },
    { needsReload: 1 },
    { needsReload: null },
    { schemaVersion: 2 },
    { schemaVersion: "1" },
  ]) {
    test(`${label} rejects ${JSON.stringify(invalid)} conservatively`, async (t) => {
      // arrange
      const records = [commandEvent(), commandEvent(invalid)];

      // act
      const execution = await runExample(t, label, records);

      // assert
      assert.deepStrictEqual(execution, {
        status: 1,
        stdout: "",
        stderr: "Unsupported command envelope\n",
      });
    });
  }

  test(`${label} rejects malformed JSON before claiming success`, async (t) => {
    // arrange
    const malformed = `${JSON.stringify(commandEvent())}\n{"broken":`;

    // act
    const execution = await runExample(t, label, malformed);

    // assert
    assert.strictEqual(execution.status, 5);
    assert.strictEqual(execution.stdout, "");
    assert.match(execution.stderr, /^jq: parse error:/);
  });
}

test("the exit example preserves earlier rows before an internal error", async (t) => {
  // arrange
  const success = commandEvent({
    needsReload: true,
    marketplaces: [
      {
        name: "tools",
        scope: "user",
        plugins: [{ status: "installed", name: "review", id: "review@tools", reasons: [] }],
      },
    ],
  });
  const failure = commandEvent({
    kind: "internal-error",
    severity: "error",
    needsReload: true,
    causeChain: ["Later step failed."],
    truncated: false,
  });

  // act
  const execution = await runExample(t, "command-exit-status", [success, failure]);
  const reload = await runExample(t, "needs-reload", [success, failure]);

  // assert
  assert.strictEqual(execution.status, 1);
  assert.strictEqual(execution.stderr, "Command reported an error\n");
  assert.deepStrictEqual(
    execution.stdout
      .trim()
      .split("\n")
      .map((line): unknown => JSON.parse(line)),
    [success.entry.data, failure.entry.data],
  );
  assert.deepStrictEqual(reload, { status: 0, stdout: "true\n", stderr: "" });
});

for (const { label, stdout } of [
  { label: "command-severity", stdout: "info\n" },
  { label: "needs-reload", stdout: "false\n" },
]) {
  test(`${label} excludes errors and reload flags from other origins and runs`, async (t) => {
    // arrange
    const records = [
      commandEvent({ origin: { kind: "load" }, severity: "error", needsReload: true }),
      commandEvent({ origin: { kind: "hook" }, severity: "error", needsReload: true }),
      commandEvent({
        origin: { kind: "command", commandId: "plugin list", invocationId: "run-2" },
        severity: "error",
        needsReload: true,
      }),
      commandEvent(),
    ];

    // act
    const execution = await runExample(t, label, records);

    // assert
    assert.deepStrictEqual(execution, { status: 0, stdout, stderr: "" });
  });
}

test("unknown kinds retain additive fields and contribute error and reload facts", async (t) => {
  // arrange
  const outcome = commandEvent({ extra: { detail: "kept" } });
  const unfamiliar = commandEvent({ kind: "future-kind", severity: "error", needsReload: true });
  const records = [outcome, unfamiliar];

  // act
  const severity = await runExample(t, "command-severity", records);
  const reload = await runExample(t, "needs-reload", records);
  const execution = await runExample(t, "command-exit-status", records);

  // assert
  assert.deepStrictEqual(severity, { status: 0, stdout: "error\n", stderr: "" });
  assert.deepStrictEqual(reload, { status: 0, stdout: "true\n", stderr: "" });
  assert.strictEqual(execution.status, 1);
  assert.strictEqual(execution.stderr, "Command reported an error\n");
  assert.deepStrictEqual(
    execution.stdout
      .trim()
      .split("\n")
      .map((line): unknown => JSON.parse(line)),
    [outcome.entry.data, unfamiliar.entry.data],
  );
});

test("the invocation selector reports the one captured command run", async (t) => {
  // arrange
  const records = [commandEvent(), commandEvent({ severity: "warning" })];

  // act
  const selection = await runExample(t, "select-invocation", records);

  // assert
  assert.deepStrictEqual(selection, { status: 0, stdout: "run-1\n", stderr: "" });
});

for (const kind of [
  "cascade",
  "marketplace-info",
  "plugin-info",
  "marketplace-info-cascade",
  "plugin-info-cascade",
  "marketplace-not-added",
  "reconcile-pending-empty",
  "reconcile-applied-cascade",
  "prune-empty",
  "prune-committed-warning",
  "usage-error",
  "usage-info",
  "autoapply-status",
  "internal-error",
]) {
  test(`the preparation recognizes the ${kind} outcome kind`, async (t) => {
    // arrange
    const event = commandEvent({ kind });

    // act
    const execution = await runExample(t, "command-exit-status", [event]);

    // assert
    assert.deepStrictEqual(execution, {
      status: 0,
      stdout: `${JSON.stringify(event.entry.data)}\n`,
      stderr: "",
    });
  });
}

for (const kind of ["diagnostic", "device-flow-prompt"]) {
  test(`the verdict includes ${kind} severity alongside an outcome`, async (t) => {
    // arrange
    const records = [
      commandEvent({ kind, severity: "warning", needsReload: true }),
      commandEvent(),
    ];

    // act
    const severity = await runExample(t, "command-severity", records);
    const reload = await runExample(t, "needs-reload", records);

    // assert
    assert.deepStrictEqual(severity, { status: 0, stdout: "warning\n", stderr: "" });
    assert.deepStrictEqual(reload, { status: 0, stdout: "true\n", stderr: "" });
  });
}

test("the exit example displays only the selected invocation", async (t) => {
  // arrange
  const selected = commandEvent({ extra: "kept" });
  const records = [
    commandEvent({ origin: { kind: "load" }, severity: "error" }),
    commandEvent({ origin: { kind: "hook" }, severity: "error" }),
    commandEvent({
      origin: { kind: "command", commandId: "plugin list", invocationId: "run-2" },
      severity: "error",
    }),
    selected,
  ];

  // act
  const execution = await runExample(t, "command-exit-status", records);

  // assert
  assert.deepStrictEqual(execution, {
    status: 0,
    stdout: `${JSON.stringify(selected.entry.data)}\n`,
    stderr: "",
  });
});

test("invocation IDs and payload text stay data instead of shell programs", async (t) => {
  // arrange
  const invocation = "run'; $(printf injected)";
  const event = commandEvent({
    origin: { kind: "command", commandId: "plugin list", invocationId: invocation },
    summary: "$(printf injected)",
  });

  // act
  const execution = await runExample(t, "command-exit-status", [event], invocation);

  // assert
  assert.deepStrictEqual(execution, {
    status: 0,
    stdout: `${JSON.stringify(event.entry.data)}\n`,
    stderr: "",
  });
});

test("extraction distinguishes an error outcome from a missing outcome", async (t) => {
  // arrange
  const records = [commandEvent({ kind: "internal-error", severity: "error" })];

  // act
  const execution = await runExample(t, "extract-plugin-rows", records);

  // assert
  assert.deepStrictEqual(execution, {
    status: 1,
    stdout: "",
    stderr: "No plugin inventory received\n",
  });
});

test("the invocation selector refuses to merge two runs with the same command ID", async (t) => {
  // arrange
  const records = [
    commandEvent(),
    commandEvent({
      origin: { kind: "command", commandId: "plugin list", invocationId: "run-2" },
    }),
  ];

  // act
  const selection = await runExample(t, "select-invocation", records);

  // assert
  assert.strictEqual(selection.status, 5);
  assert.strictEqual(selection.stdout, "");
  assert.match(selection.stderr, /: Expected one command invocation\n$/);
});

test("the invocation selector fails explicitly when no command arrived", async (t) => {
  // arrange
  const records = [{ type: "agent_start" }];

  // act
  const selection = await runExample(t, "select-invocation", records);

  // assert
  assert.deepStrictEqual(selection, {
    status: 1,
    stdout: "",
    stderr: "No command outcome received\n",
  });
});

interface SchemaNode {
  readonly $ref?: string;
  readonly anyOf?: readonly SchemaNode[];
  readonly oneOf?: readonly SchemaNode[];
  readonly properties?: Readonly<Record<string, SchemaNode>>;
  readonly required?: readonly string[];
  readonly items?: SchemaNode;
  readonly const?: unknown;
}

interface DocumentedField {
  readonly type: string;
  readonly presence: string;
}

function schemaVariants(node: SchemaNode, root: SchemaNode): readonly SchemaNode[] {
  if (node.$ref) {
    assert.ok(node.$ref.startsWith("#/"), "Only local schema references are supported");
    let target: unknown = root;
    for (const key of node.$ref.slice(2).split("/")) {
      assert.ok(target && typeof target === "object");
      target = Reflect.get(target, key.replaceAll("~1", "/").replaceAll("~0", "~"));
    }

    assert.ok(target && typeof target === "object", `Missing schema reference: ${node.$ref}`);
    return schemaVariants(target, root);
  }

  return (node.anyOf ?? node.oneOf)?.flatMap((arm) => schemaVariants(arm, root)) ?? [node];
}

function schemaFields(node: SchemaNode, root: SchemaNode, prefix = ""): Map<string, string> {
  const arms = schemaVariants(node, root);
  const fields = new Map<string, string>();
  const names = new Set(arms.flatMap((arm) => Object.keys(arm.properties ?? {})));
  for (const name of names) {
    const children = arms.flatMap((arm) => (arm.properties?.[name] ? [arm.properties[name]] : []));
    const requiredCount = arms.filter((arm) => arm.required?.includes(name)).length;
    const presence =
      requiredCount === arms.length ? "required" : requiredCount > 0 ? "conditional" : "optional";
    const fieldPath = `${prefix}${name}`;
    fields.set(fieldPath, presence);
    const nested = children.map((child) => child.items ?? child);
    const childPrefix = `${fieldPath}${children.some((child) => child.items) ? "[]" : ""}.`;
    for (const [nestedPath, nestedPresence] of schemaFields({ anyOf: nested }, root, childPrefix)) {
      fields.set(nestedPath, nestedPresence);
    }
  }

  return fields;
}

function referenceSections(guide: string): Map<string, string> {
  const sections = new Map<string, string>();
  for (const match of guide.matchAll(/<!-- fields: ([\w:-]+) -->([\s\S]*?)<!-- \/fields -->/g)) {
    const name = match[1];
    const body = match[2];
    assert.ok(name && body);
    assert.ok(!sections.has(name), `Duplicate reference section: ${name}`);
    sections.set(name, body);
  }

  return sections;
}

function documentedRows(
  sections: ReadonlyMap<string, string>,
  name: string,
): Map<string, DocumentedField> {
  const body = sections.get(name);
  assert.ok(body, `Missing reference section: ${name}`);
  const rows = new Map<string, DocumentedField>();
  for (const use of body.matchAll(/<!-- use: ([\w-]+) -->/g)) {
    assert.ok(use[1]);
    for (const [field, row] of documentedRows(sections, use[1])) {
      rows.set(field, row);
    }
  }

  for (const row of body.matchAll(/^\|\s*`([^`]+)`\s*\|([^|]+)\|([^|]+)\|([^|]*)\|\s*$/gm)) {
    const [, field, type = "", presence = "", meaning = ""] = row;
    assert.ok(
      field && type.trim() && presence.trim() && meaning.trim(),
      `Incomplete field description: ${name}.${field}`,
    );
    rows.set(field, { type: type.trim(), presence: presence.trim() });
  }

  return rows;
}

function documentedFields(
  sections: ReadonlyMap<string, string>,
  name: string,
  prefix = "",
): Map<string, string> {
  const fields = new Map<string, string>();
  for (const [field, row] of documentedRows(sections, name)) {
    const fieldPath = `${prefix}${field}`;
    fields.set(fieldPath, row.presence);
    const reference = /\]\(#([\w-]+)\)(\[\])?/.exec(row.type);
    if (reference?.[1]) {
      const childPrefix = `${fieldPath}${reference[2] ?? ""}.`;
      for (const [nestedPath, presence] of documentedFields(sections, reference[1], childPrefix)) {
        fields.set(nestedPath, presence);
      }
    }
  }

  return fields;
}

function assertReferenceInventory(guide: string, schema: SchemaNode): void {
  const sections = referenceSections(guide);
  const members = schemaVariants(schema, schema);
  const kinds = members.map((member) => member.properties?.kind?.const);
  assert.deepStrictEqual(
    [...sections.keys()]
      .filter((name) => name.startsWith("kind:"))
      .map((name) => name.slice(5))
      .sort(),
    [...kinds].sort(),
  );
  for (const member of members) {
    const kind = member.properties?.kind?.const;
    assert.strictEqual(typeof kind, "string");
    assert.deepStrictEqual(
      [...documentedFields(sections, `kind:${String(kind)}`)].sort(),
      [...schemaFields(member, schema)].sort(),
      `Documented paths and requiredness for ${String(kind)}`,
    );
  }
}

async function readReferenceInputs() {
  const guide = await readFile(new URL("../../docs/json-output.md", import.meta.url), "utf8");
  const schema = JSON.parse(
    await readFile(new URL("../../schema/claude-plugin.schema.json", import.meta.url), "utf8"),
  ) as SchemaNode;
  return { guide, schema };
}

test("the reference covers every schema kind and recursive field with its requiredness", async () => {
  // arrange
  const { guide, schema } = await readReferenceInputs();

  // act
  const verifyReference = () => {
    assertReferenceInventory(guide, schema);
  };

  // assert
  assert.doesNotThrow(verifyReference);
});

for (const field of ["causeChain", "components", "owner", "supported", "envelopeCount"]) {
  test(`the reference check rejects a missing ${field} description`, async () => {
    // arrange
    const { guide, schema } = await readReferenceInputs();
    const incompleteGuide = guide
      .split("\n")
      .filter((line) => !line.trimStart().startsWith(`| \`${field}\``))
      .join("\n");

    // act & assert
    assert.throws(() => {
      assertReferenceInventory(incompleteGuide, schema);
    }, assert.AssertionError);
  });
}

test("the reference check rejects a missing payload kind", async () => {
  // arrange
  const { guide, schema } = await readReferenceInputs();
  const incompleteGuide = guide.replace(
    /<!-- fields: kind:cascade -->[\s\S]*?<!-- \/fields -->/,
    "",
  );

  // act & assert
  assert.throws(() => {
    assertReferenceInventory(incompleteGuide, schema);
  }, assert.AssertionError);
});

test("the reference check rejects incorrect requiredness", async () => {
  // arrange
  const { guide, schema } = await readReferenceInputs();
  const incompleteGuide = guide.replace(/(\|\s*`causeChain`[^\n]*?\|\s*)required/, "$1optional");

  // act & assert
  assert.throws(() => {
    assertReferenceInventory(incompleteGuide, schema);
  }, assert.AssertionError);
});

test("the partial-result payload examples satisfy the committed schema", async () => {
  // arrange
  const { guide, schema } = await readReferenceInputs();
  const validator = Compile(schema as TSchema);

  // act
  const payloads = [...guide.matchAll(/```jsonl\n([\s\S]*?)\n```/g)].flatMap((fence) =>
    (fence[1] ?? "").split("\n").map((line): unknown => JSON.parse(line)),
  );

  // assert
  assert.ok(payloads.length > 0);
  for (const payload of payloads) {
    assert.ok(validator.Check(payload), JSON.stringify(payload));
  }
});
