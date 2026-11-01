import assert from "node:assert/strict";
import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import {
  NODE_PROJECT_SKILL_LEDGER,
  provenProjectSkills,
  skillFileDigest,
} from "../../../extensions/pi-claude-marketplace/bridges/skills/project-installs.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";

/** The user ledger file under the agent directory `agentDir`. */
function projectInstallsFile(agentDir: string): string {
  return path.join(agentDir, "pi-claude-marketplace", "project-installs.json");
}

interface LedgerCase {
  readonly agentDir: string;
  readonly project: string;
  readonly file: string;
}

async function allocateCase(t: TestContext): Promise<LedgerCase> {
  const { agentDir, cwd } = await createHermeticEnvironment(t, "project-installs-");
  return { agentDir, project: cwd, file: projectInstallsFile(agentDir) };
}

function readLedger(file: string): Promise<unknown> {
  return readFile(file, "utf8").then((text) => JSON.parse(text) as unknown);
}

const DEMO_GREET = { plugin: "demo", sha256: "a".repeat(64) };
const DEMO_STATUS = { plugin: "demo", sha256: "b".repeat(64) };

describe("skillFileDigest", () => {
  test("is the hex SHA-256 of the file's UTF-8 bytes", () => {
    // act
    const digests = [skillFileDigest("abc"), skillFileDigest("é")];

    // assert
    assert.deepStrictEqual(digests, [
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      "4a99557e4033c3539de2eb65472017cad5f9557f7a0625a09f1c3f6e2ba69c4c",
    ]);
  });
});

describe("NODE_PROJECT_SKILL_LEDGER", () => {
  test("D-CF2-13: lists the remembered skills under the project's real path", async (t) => {
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
      projects: { [project]: { "demo-greet": DEMO_GREET } },
    });
  });

  test("D-CF2-13: keys a project that does not exist by its resolved path", async (t) => {
    // arrange
    const { project, file } = await allocateCase(t);
    const ledger = NODE_PROJECT_SKILL_LEDGER;

    // act
    await ledger.update({
      projectPath: path.join(project, "gone", ".."),
      forget: [],
      remember: new Map([["demo-greet", DEMO_GREET]]),
    });

    // assert
    assert.deepStrictEqual(await readLedger(file), {
      version: 1,
      projects: { [project]: { "demo-greet": DEMO_GREET } },
    });
  });

  test("D-CF2-13: replaces forgotten names and keeps the other projects in their order", async (t) => {
    // arrange
    const { project, file } = await allocateCase(t);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(
      file,
      JSON.stringify({
        version: 1,
        projects: {
          "/first": { "other-skill": DEMO_STATUS },
          [project]: { "demo-old": DEMO_STATUS, "demo-greet": DEMO_STATUS },
          "/last": { "other-skill": DEMO_STATUS },
        },
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
    const written = (await readLedger(file)) as { projects: object };
    assert.deepStrictEqual(written, {
      version: 1,
      projects: {
        "/first": { "other-skill": DEMO_STATUS },
        [project]: { "demo-greet": DEMO_GREET },
        "/last": { "other-skill": DEMO_STATUS },
      },
    });
    assert.deepStrictEqual(Object.keys(written.projects), ["/first", project, "/last"]);
  });

  test("D-CF2-13: drops a project whose last skill is forgotten", async (t) => {
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
    assert.deepStrictEqual(await readLedger(file), { version: 1, projects: {} });
  });

  test("D-CF2-13: writes nothing for a change that alters nothing", async (t) => {
    // arrange
    const { project, file } = await allocateCase(t);
    const ledger = NODE_PROJECT_SKILL_LEDGER;
    const compact = JSON.stringify({
      version: 1,
      projects: { [project]: { "demo-greet": DEMO_GREET } },
    });
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
    { label: "not JSON", text: "{" },
    { label: "of another shape", text: JSON.stringify({ version: 2, projects: {} }) },
  ]) {
    test(`D-CF2-13: replaces a ledger that is ${label}`, async (t) => {
      // arrange
      const { project, file } = await allocateCase(t);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, text);
      const ledger = NODE_PROJECT_SKILL_LEDGER;

      // act
      await ledger.update({
        projectPath: project,
        forget: [],
        remember: new Map([["demo-greet", DEMO_GREET]]),
      });

      // assert
      assert.deepStrictEqual(await readLedger(file), {
        version: 1,
        projects: { [project]: { "demo-greet": DEMO_GREET } },
      });
    });
  }
});

describe("provenProjectSkills", () => {
  test("D-CF2-13: maps each skill the ledger lists for the project to its digest", async (t) => {
    // arrange
    const { agentDir, project } = await allocateCase(t);
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
    const proven = await provenProjectSkills(agentDir, project, (file) => {
      reads.push(file);
      return readFile(file, "utf8");
    });

    // assert
    assert.deepStrictEqual(
      proven,
      new Map([
        ["demo-greet", DEMO_GREET.sha256],
        ["demo-status", DEMO_STATUS.sha256],
      ]),
    );
    assert.deepStrictEqual(reads, [projectInstallsFile(agentDir)]);
  });

  test("D-CF2-13: lists nothing for a project the ledger does not name", async (t) => {
    // arrange
    const { agentDir, project } = await allocateCase(t);
    await NODE_PROJECT_SKILL_LEDGER.update({
      projectPath: "/elsewhere",
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
      read: () => Promise.resolve(JSON.stringify({ version: 1, projects: { "/p": { s: "x" } } })),
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
