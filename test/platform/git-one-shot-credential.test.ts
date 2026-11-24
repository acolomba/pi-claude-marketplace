import assert from "node:assert/strict";
import { mkdir, readdir, readFile, stat } from "node:fs/promises";
import * as path from "node:path";
import { describe, test, type TestContext } from "node:test";

import { withOneShotCredential } from "../../extensions/pi-claude-marketplace/platform/git-one-shot-credential.ts";
import { getAgentDir } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

import { createGitTestDirectory, runSystemGit } from "./git-test-repository.ts";

const CREDENTIAL = { username: "x-access-token", password: "gho_one-shot-secret" } as const;
const ORIGIN = "https://git.example.invalid";

/** The file the helper pair names, read back from its single-quoted shell word. */
function helperFile(config: readonly string[]): string {
  const match = /cat '(.*)'; \}; f$/.exec(config[1] ?? "");
  assert.ok(match?.[1] !== undefined, `no helper file in ${JSON.stringify(config)}`);
  return match[1].replaceAll(String.raw`'\''`, "'");
}

/** A parent directory for the one-shot directories, unique to the case. */
async function parentDirectory(t: TestContext, name = "extension-root"): Promise<string> {
  const parent = path.join(await createGitTestDirectory(t, { boundary: "local" }), name);
  await mkdir(parent);
  return parent;
}

/** What `run` saw of the file the pairs name, and the pairs themselves. */
interface SeenFile {
  readonly config: readonly string[];
  readonly file: string;
  readonly contents: string;
  readonly fileMode: number;
  readonly directoryMode: number;
}

async function seeFile(config: readonly string[]): Promise<SeenFile> {
  const file = helperFile(config);
  return {
    config,
    file,
    contents: await readFile(file, "utf8"),
    fileMode: (await stat(file)).mode & 0o777,
    directoryMode: (await stat(path.dirname(file))).mode & 0o777,
  };
}

describe("withOneShotCredential", () => {
  test("D-SG-14: gives run an empty helper, then a get-only helper over a 0600 file in a fresh 0700 directory, both keyed to the origin", async (t) => {
    // arrange
    const parent = await parentDirectory(t);

    // act
    const seen = await withOneShotCredential(CREDENTIAL, ORIGIN, seeFile, () => parent);

    // assert
    assert.deepStrictEqual(
      {
        first: seen.config[0],
        second: seen.config[1],
        directoryParent: path.dirname(path.dirname(seen.file)),
        directoryName: path.basename(path.dirname(seen.file)).startsWith("git-credential-"),
        contents: seen.contents,
        fileMode: seen.fileMode,
        directoryMode: seen.directoryMode,
      },
      {
        first: "credential.https://git.example.invalid.helper=",
        second: `credential.https://git.example.invalid.helper=!f() { test "$1" = get && cat '${seen.file}'; }; f`,
        directoryParent: parent,
        directoryName: true,
        contents: "username=x-access-token\npassword=gho_one-shot-secret\n",
        fileMode: 0o600,
        directoryMode: 0o700,
      },
    );
  });

  test("D-SG-14: removes the directory once run resolves, and answers what run answered", async (t) => {
    // arrange
    const parent = await parentDirectory(t);

    // act
    const answer = await withOneShotCredential(
      CREDENTIAL,
      ORIGIN,
      () => Promise.resolve("ran"),
      () => parent,
    );

    // assert
    assert.deepStrictEqual({ answer, left: await readdir(parent) }, { answer: "ran", left: [] });
  });

  test("D-SG-14: removes the directory once run rejects, and rethrows the same error", async (t) => {
    // arrange
    const parent = await parentDirectory(t);
    const failure = new Error("the retry failed");

    // act
    const running = withOneShotCredential(
      CREDENTIAL,
      ORIGIN,
      () => Promise.reject(failure),
      () => parent,
    );

    // assert
    await assert.rejects(running, (error: unknown) => error === failure);
    assert.deepStrictEqual(await readdir(parent), []);
  });

  test("D-SG-14: git's credential fill reads the file through the helper, quoting a path that holds a quote", async (t) => {
    // arrange
    const parent = await parentDirectory(t, "it's");
    const home = await createGitTestDirectory(t, { boundary: "local" });

    // act
    const filled = await withOneShotCredential(
      CREDENTIAL,
      ORIGIN,
      (config) =>
        runSystemGit(
          { cwd: home, home, input: "protocol=https\nhost=git.example.invalid\n\n" },
          ...config.flatMap((pair) => ["-c", pair]),
          "credential",
          "fill",
        ),
      () => parent,
    );

    // assert
    assert.strictEqual(
      filled,
      "protocol=https\nhost=git.example.invalid\nusername=x-access-token\npassword=gho_one-shot-secret",
    );
  });

  test("D-SG-14: git's credential approve and reject leave the file alone", async (t) => {
    // arrange
    const parent = await parentDirectory(t);
    const home = await createGitTestDirectory(t, { boundary: "local" });
    const input = "protocol=https\nhost=git.example.invalid\nusername=u\npassword=other\n\n";

    // act
    const contents = await withOneShotCredential(
      CREDENTIAL,
      ORIGIN,
      async (config) => {
        const pairs = config.flatMap((pair) => ["-c", pair]);
        await runSystemGit({ cwd: home, home, input }, ...pairs, "credential", "approve");
        await runSystemGit({ cwd: home, home, input }, ...pairs, "credential", "reject");
        return readFile(helperFile(config), "utf8");
      },
      () => parent,
    );

    // assert
    assert.strictEqual(contents, "username=x-access-token\npassword=gho_one-shot-secret\n");
  });

  test("D-1-03: git offers the file to the origin only, and another host keeps the user's own helper", async (t) => {
    // arrange
    const parent = await parentDirectory(t);
    const home = await createGitTestDirectory(t, { boundary: "local" });
    const ownHelper = "credential.helper=!f() { echo username=own; echo password=own-secret; }; f";

    // act
    const filled = await withOneShotCredential(
      CREDENTIAL,
      ORIGIN,
      async (config) => {
        const pairs = ["-c", ownHelper, ...config.flatMap((pair) => ["-c", pair])];
        const fill = (host: string): Promise<string> =>
          runSystemGit(
            { cwd: home, home, input: `protocol=https\nhost=${host}\n\n` },
            ...pairs,
            "credential",
            "fill",
          );
        return { origin: await fill("git.example.invalid"), other: await fill("github.com") };
      },
      () => parent,
    );

    // assert
    assert.deepStrictEqual(filled, {
      origin:
        "protocol=https\nhost=git.example.invalid\nusername=x-access-token\npassword=gho_one-shot-secret",
      other: "protocol=https\nhost=github.com\nusername=own\npassword=own-secret",
    });
  });

  test("D-1-03: refuses an origin holding an equals sign without naming it, and writes nothing", async (t) => {
    // arrange
    const parent = await parentDirectory(t);

    // act
    const running = withOneShotCredential(
      CREDENTIAL,
      "https://a=b.example",
      () => Promise.resolve("ran"),
      () => parent,
    );

    // assert
    await assert.rejects(running, {
      message: "a one-shot credential origin holds an equals sign",
    });
    assert.deepStrictEqual(await readdir(parent), []);
  });

  test("D-SG-14: leaves an absent value out of the file", async (t) => {
    // arrange
    const parent = await parentDirectory(t);

    // act
    const seen = await withOneShotCredential({ password: "token" }, ORIGIN, seeFile, () => parent);

    // assert
    assert.strictEqual(seen.contents, "password=token\n");
  });

  for (const value of ["one\ntwo", "one\rtwo", "one\0two"]) {
    test(`AUTH-09: refuses a value holding ${JSON.stringify(value.charAt(3))} without naming it, and writes nothing`, async (t) => {
      // arrange
      const parent = await parentDirectory(t);

      // act
      const running = withOneShotCredential(
        { username: "u", password: value },
        ORIGIN,
        () => Promise.resolve("ran"),
        () => parent,
      );

      // assert
      await assert.rejects(running, {
        message: "a one-shot credential value holds a line break or a NUL",
      });
      assert.deepStrictEqual(await readdir(parent), []);
    });
  }

  test("NFR-10: the default parent is the user scope's extension root", async () => {
    // act
    const seen = await withOneShotCredential(CREDENTIAL, ORIGIN, seeFile);

    // assert
    assert.strictEqual(
      path.dirname(path.dirname(seen.file)),
      path.join(getAgentDir(), "pi-claude-marketplace"),
    );
  });
});
