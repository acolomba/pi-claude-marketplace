import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, realpath, stat, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  admittedProjectLedger,
  NODE_PROJECT_SKILL_LEDGER,
  NODE_SKILL_TREE_LISTER,
  provenProjectSkills,
  skillTreeDigest,
} from "../../extensions/pi-claude-marketplace/persistence/project-installs.ts";
import { ProjectSkillLedgerError } from "../../extensions/pi-claude-marketplace/shared/errors-bridges.ts";
import { createHermeticEnvironment } from "../platform/hermetic-environment.ts";

/** The ledger file of the project at the canonical path `project` under the agent directory `agentDir`. */
function projectLedgerFile(agentDir: string, project: string): string {
  const key = createHash("sha256").update(project).digest("hex");
  return path.join(agentDir, "pi-claude-marketplace", "project-installs", key, "skills.json");
}

interface LedgerCase {
  readonly agentDir: string;
  readonly project: string;
  readonly file: string;
}

async function allocateCase(t: TestContext): Promise<LedgerCase> {
  const { agentDir, cwd } = await createHermeticEnvironment(t, "project-installs-");
  const project = await realpath(cwd);
  return { agentDir, project, file: projectLedgerFile(agentDir, project) };
}

function readLedger(file: string): Promise<unknown> {
  return readFile(file, "utf8").then((text) => JSON.parse(text) as unknown);
}

const DEMO_GREET = { plugin: "demo", sha256: "a".repeat(64) };
const DEMO_STATUS = { plugin: "demo", sha256: "b".repeat(64) };

describe("NODE_SKILL_TREE_LISTER", () => {
  test("WR-03: lists every file and symbolic link under the directory with a digest, and follows no link", async (t) => {
    // arrange
    const { cwd } = await createHermeticEnvironment(t, "skill-tree-");
    const dir = path.join(cwd, "demo-status");
    await mkdir(path.join(dir, "scripts", "deep"), { recursive: true });
    await mkdir(path.join(cwd, "outside"), { recursive: true });
    await writeFile(path.join(dir, "SKILL.md"), "abc");
    await writeFile(path.join(dir, "scripts", "deep", "run.sh"), "é");
    await writeFile(path.join(cwd, "outside", "hidden.txt"), "not listed");
    await symlink(path.join(cwd, "outside"), path.join(dir, "linked"));

    // act
    const entries = await NODE_SKILL_TREE_LISTER(dir);

    // assert
    assert.deepStrictEqual(
      [...entries].sort((a, b) => a.path.localeCompare(b.path)),
      [
        {
          path: "linked",
          kind: "symlink",
          sha256: createHash("sha256").update(path.join(cwd, "outside")).digest("hex"),
        },
        {
          path: "scripts/deep/run.sh",
          kind: "file",
          sha256: "4a99557e4033c3539de2eb65472017cad5f9557f7a0625a09f1c3f6e2ba69c4c",
        },
        {
          path: "SKILL.md",
          kind: "file",
          sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
        },
      ],
    );
  });

  test("WR-03: refuses an entry that is neither a file, a directory nor a symbolic link", async (t) => {
    // arrange
    const { cwd } = await createHermeticEnvironment(t, "skill-tree-fifo-");
    const dir = path.join(cwd, "demo-status");
    await mkdir(dir, { recursive: true });
    const fifo = path.join(dir, "pipe");
    execFileSync("mkfifo", [fifo]);

    // act & assert
    await assert.rejects(NODE_SKILL_TREE_LISTER(dir), {
      message: `${fifo} is neither a file, a directory nor a symbolic link`,
    });
  });
});

describe("skillTreeDigest", () => {
  const SCRIPT = { path: "scripts/run.sh", kind: "file" as const, sha256: "c".repeat(64) };
  const NOTES = { path: "notes.txt", kind: "file" as const, sha256: "d".repeat(64) };

  test("WR-03: hashes the path-sorted entries with the given SKILL.md bytes in place of the listed ones", () => {
    // arrange
    const listedSkillFile = { path: "SKILL.md", kind: "file" as const, sha256: "e".repeat(64) };
    const expected = createHash("sha256")
      .update(
        JSON.stringify([
          ["SKILL.md", "file", createHash("sha256").update("abc").digest("hex")],
          ["notes.txt", "file", NOTES.sha256],
          ["scripts/run.sh", "file", SCRIPT.sha256],
        ]),
      )
      .digest("hex");

    // act
    const digests = [
      skillTreeDigest([SCRIPT, listedSkillFile, NOTES], "abc"),
      skillTreeDigest([NOTES, SCRIPT], "abc"),
    ];

    // assert
    assert.deepStrictEqual(digests, [expected, expected]);
  });

  for (const { label, entries, skillFile } of [
    { label: "an added entry", entries: [SCRIPT, NOTES], skillFile: "abc" },
    { label: "a removed entry", entries: [], skillFile: "abc" },
    {
      label: "a changed entry",
      entries: [{ ...SCRIPT, sha256: "f".repeat(64) }],
      skillFile: "abc",
    },
    {
      label: "a symbolic link in place of a file",
      entries: [{ ...SCRIPT, kind: "symlink" as const }],
      skillFile: "abc",
    },
    { label: "other SKILL.md bytes", entries: [SCRIPT], skillFile: "abd" },
  ]) {
    test(`WR-03: changes with ${label}`, () => {
      // act
      const digest = skillTreeDigest(entries, skillFile);

      // assert
      assert.notStrictEqual(digest, skillTreeDigest([SCRIPT], "abc"));
    });
  }
});

describe("NODE_PROJECT_SKILL_LEDGER", () => {
  test("D-CF2-13: lists the remembered skills in the ledger of the project's real path", async (t) => {
    // arrange
    const { project, file } = await allocateCase(t);
    const link = path.join(path.dirname(project), "link");
    await symlink(project, link);
    const ledger = NODE_PROJECT_SKILL_LEDGER;

    // act
    await ledger.update({
      projectPath: link,
      forget: [],
      remember: new Map([["demo-greet", DEMO_GREET]]),
    });

    // assert
    assert.deepStrictEqual(await readLedger(file), {
      version: 1,
      project,
      skills: { "demo-greet": DEMO_GREET },
    });
  });

  test("D-CF2-13: keys a project that does not exist by its resolved path", async (t) => {
    // arrange
    const { agentDir, project } = await allocateCase(t);
    const gone = path.join(project, "gone");
    const ledger = NODE_PROJECT_SKILL_LEDGER;

    // act
    await ledger.update({
      projectPath: path.join(gone, "deeper", ".."),
      forget: [],
      remember: new Map([["demo-greet", DEMO_GREET]]),
    });

    // assert
    assert.deepStrictEqual(await readLedger(projectLedgerFile(agentDir, gone)), {
      version: 1,
      project: gone,
      skills: { "demo-greet": DEMO_GREET },
    });
  });

  test("D-CF2-13: replaces forgotten names and keeps the other skills in their order", async (t) => {
    // arrange
    const { project, file } = await allocateCase(t);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(
      file,
      JSON.stringify({
        version: 1,
        project,
        skills: { "demo-first": DEMO_STATUS, "demo-old": DEMO_STATUS, "demo-greet": DEMO_STATUS },
      }),
    );
    const ledger = NODE_PROJECT_SKILL_LEDGER;

    // act
    await ledger.update({
      projectPath: project,
      forget: ["demo-old", "demo-greet"],
      remember: new Map([["demo-greet", DEMO_GREET]]),
    });

    // assert
    const written = (await readLedger(file)) as { skills: object };
    assert.deepStrictEqual(written, {
      version: 1,
      project,
      skills: { "demo-first": DEMO_STATUS, "demo-greet": DEMO_GREET },
    });
    assert.deepStrictEqual(Object.keys(written.skills), ["demo-first", "demo-greet"]);
  });

  test("IN-06: a change to one project leaves the ledger of another project untouched", async (t) => {
    // arrange
    const { agentDir, project, file } = await allocateCase(t);
    const other = path.join(path.dirname(project), "other");
    const otherFile = projectLedgerFile(agentDir, other);
    await mkdir(path.dirname(otherFile), { recursive: true });
    const otherText = JSON.stringify({ version: 1, project: other, skills: { s: DEMO_STATUS } });
    await writeFile(otherFile, otherText);
    const ledger = NODE_PROJECT_SKILL_LEDGER;

    // act
    await ledger.update({
      projectPath: project,
      forget: [],
      remember: new Map([["demo-greet", DEMO_GREET]]),
    });

    // assert
    assert.strictEqual(await readFile(otherFile, "utf8"), otherText);
    assert.deepStrictEqual(await readLedger(file), {
      version: 1,
      project,
      skills: { "demo-greet": DEMO_GREET },
    });
  });

  test("D-CF2-13: removes the ledger of a project whose last skill is forgotten", async (t) => {
    // arrange
    const { project, file } = await allocateCase(t);
    const ledger = NODE_PROJECT_SKILL_LEDGER;
    await ledger.update({
      projectPath: project,
      forget: [],
      remember: new Map([["demo-greet", DEMO_GREET]]),
    });

    // act
    await ledger.update({ projectPath: project, forget: ["demo-greet"], remember: new Map() });

    // assert
    await assert.rejects(stat(path.dirname(file)), { code: "ENOENT" });
  });

  test("D-CF2-13: writes nothing for a change that alters nothing", async (t) => {
    // arrange
    const { project, file } = await allocateCase(t);
    const ledger = NODE_PROJECT_SKILL_LEDGER;
    const compact = JSON.stringify({ version: 1, project, skills: { "demo-greet": DEMO_GREET } });
    await ledger.update({ projectPath: project, forget: ["demo-greet"], remember: new Map() });
    const absentAfterForget = await readFile(file, "utf8").catch((error: unknown) => error);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, compact);

    // act
    await ledger.update({
      projectPath: project,
      forget: ["demo-greet"],
      remember: new Map([["demo-greet", DEMO_GREET]]),
    });

    // assert
    assert.strictEqual((absentAfterForget as NodeJS.ErrnoException).code, "ENOENT");
    assert.strictEqual(await readFile(file, "utf8"), compact);
  });

  for (const { label, text } of [
    { label: "not JSON", text: () => "{" },
    {
      label: "of another version",
      text: (project: string) => JSON.stringify({ version: 2, project, skills: {} }),
    },
    {
      label: "missing a digest",
      text: (project: string) =>
        JSON.stringify({ version: 1, project, skills: { s: { plugin: "demo" } } }),
    },
    {
      label: "naming another project",
      text: () => JSON.stringify({ version: 1, project: "/elsewhere", skills: {} }),
    },
  ]) {
    test(`WR-02: refuses to update a ledger that is ${label} and leaves it unchanged`, async (t) => {
      // arrange
      const { project, file } = await allocateCase(t);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, text(project));
      const ledger = NODE_PROJECT_SKILL_LEDGER;

      // act & assert
      await assert.rejects(
        ledger.update({
          projectPath: project,
          forget: [],
          remember: new Map([["demo-greet", DEMO_GREET]]),
        }),
        (error: unknown) => {
          assert.ok(error instanceof ProjectSkillLedgerError);
          assert.deepStrictEqual([error.ledgerPath, error.defect], [file, "unknown-content"]);
          return true;
        },
      );
      assert.strictEqual(await readFile(file, "utf8"), text(project));
    });
  }

  test("WR-02: refuses to update a ledger that cannot be read and leaves it in place", async (t) => {
    // arrange
    const { project, file } = await allocateCase(t);
    await mkdir(file, { recursive: true });
    const ledger = NODE_PROJECT_SKILL_LEDGER;

    // act & assert
    await assert.rejects(
      ledger.update({
        projectPath: project,
        forget: [],
        remember: new Map([["demo-greet", DEMO_GREET]]),
      }),
      (error: unknown) => {
        assert.ok(error instanceof ProjectSkillLedgerError);
        assert.deepStrictEqual(
          [error.ledgerPath, error.defect, (error.cause as NodeJS.ErrnoException).code],
          [file, "unreadable", "EISDIR"],
        );
        return true;
      },
    );
    assert.ok((await stat(file)).isDirectory());
  });
});

describe("provenProjectSkills", () => {
  test("D-CF2-13: maps each skill the ledger of the project lists to its digest", async (t) => {
    // arrange
    const { agentDir, project, file } = await allocateCase(t);
    await NODE_PROJECT_SKILL_LEDGER.update({
      projectPath: project,
      forget: [],
      remember: new Map([
        ["demo-greet", DEMO_GREET],
        ["demo-status", DEMO_STATUS],
      ]),
    });
    const reads: string[] = [];

    // act
    const proven = await provenProjectSkills(agentDir, project, (target) => {
      reads.push(target);
      return readFile(target, "utf8");
    });

    // assert
    assert.deepStrictEqual(
      proven,
      new Map([
        ["demo-greet", DEMO_GREET.sha256],
        ["demo-status", DEMO_STATUS.sha256],
      ]),
    );
    assert.deepStrictEqual(reads, [file]);
  });

  test("D-CF2-13: lists nothing for a project whose ledger is another project's", async (t) => {
    // arrange
    const { agentDir, project } = await allocateCase(t);
    await NODE_PROJECT_SKILL_LEDGER.update({
      projectPath: path.join(path.dirname(project), "elsewhere"),
      forget: [],
      remember: new Map([["demo-greet", DEMO_GREET]]),
    });

    // act
    const proven = await provenProjectSkills(agentDir, project, (file) => readFile(file, "utf8"));

    // assert
    assert.deepStrictEqual(proven, new Map());
  });

  for (const { label, read } of [
    { label: "a ledger that cannot be read", read: () => Promise.reject(new Error("EACCES")) },
    { label: "a ledger that is not JSON", read: () => Promise.resolve("not json") },
    {
      label: "a ledger of another shape",
      read: () =>
        Promise.resolve(JSON.stringify({ version: 1, project: "/p", skills: { s: "x" } })),
    },
    {
      label: "a ledger that names another project",
      read: () =>
        Promise.resolve(JSON.stringify({ version: 1, project: "/q", skills: { s: DEMO_GREET } })),
    },
  ]) {
    test(`D-CF2-13: lists nothing from ${label}`, async () => {
      // act
      const proven = await provenProjectSkills("/agent", "/p", read);

      // assert
      assert.deepStrictEqual(proven, new Map());
    });
  }
});

describe("admittedProjectLedger", () => {
  for (const { label, admission, scope } of [
    { label: "a create admission at project scope", admission: "create", scope: "project" },
    { label: "a refresh admission at user scope", admission: "refresh", scope: "user" },
  ] as const) {
    test(`D-CF2-16: gives ${label} the ledger as it is`, async (t) => {
      // arrange
      const { project } = await allocateCase(t);

      // act
      const ledger = await admittedProjectLedger(admission, locationsFor(scope, project), "demo");

      // assert
      assert.strictEqual(ledger, NODE_PROJECT_SKILL_LEDGER);
    });
  }

  test("D-CF2-16: gives a refresh admission the ledger as it is when the ledger lists the plugin", async (t) => {
    // arrange
    const { project } = await allocateCase(t);
    await NODE_PROJECT_SKILL_LEDGER.update({
      projectPath: project,
      forget: [],
      remember: new Map([["demo-greet", DEMO_GREET]]),
    });

    // act
    const ledger = await admittedProjectLedger("refresh", locationsFor("project", project), "demo");

    // assert
    assert.strictEqual(ledger, NODE_PROJECT_SKILL_LEDGER);
  });

  test("D-CF2-16: a refresh admission for a plugin the ledger does not list forgets entries and remembers none", async (t) => {
    // arrange
    const { project, file } = await allocateCase(t);
    const other = { plugin: "other", sha256: "c".repeat(64) };
    await NODE_PROJECT_SKILL_LEDGER.update({
      projectPath: project,
      forget: [],
      remember: new Map([
        ["other-a", other],
        ["other-b", other],
      ]),
    });
    const ledger = await admittedProjectLedger("refresh", locationsFor("project", project), "demo");

    // act
    await ledger.update({
      projectPath: project,
      forget: ["other-a"],
      remember: new Map([["demo-greet", DEMO_GREET]]),
    });

    // assert
    assert.deepStrictEqual(await readLedger(file), {
      version: 1,
      project,
      skills: { "other-b": other },
    });
  });

  test("D-CF2-16: a refresh admission with no ledger for the project writes none", async (t) => {
    // arrange
    const { project, file } = await allocateCase(t);
    const ledger = await admittedProjectLedger("refresh", locationsFor("project", project), "demo");

    // act
    await ledger.update({
      projectPath: project,
      forget: [],
      remember: new Map([["demo-greet", DEMO_GREET]]),
    });

    // assert
    await assert.rejects(stat(file), { code: "ENOENT" });
  });
});
