import assert from "node:assert/strict";
import { chmod, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, test } from "node:test";

import { mock, verify } from "strong-mock";

import { createPackagesPhase } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  createPackageManagerRunner,
  NODE_PACKAGE_MANAGER_SPAWN,
} from "../../../extensions/pi-claude-marketplace/platform/package-manager.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";

import type {
  PackageInstallOps,
  PackagesPhaseContext,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type {
  PackageManagerRequest,
  PackageManagerRun,
  PackageManagerRunner,
} from "../../../extensions/pi-claude-marketplace/platform/package-manager.ts";
import type { TestContext } from "node:test";

const NPM_CI_ARGUMENTS = [
  "ci",
  "--ignore-scripts",
  "--workspaces=false",
  "--no-audit",
  "--no-fund",
];
const BUN_INSTALL_ARGUMENTS = ["install", "--frozen-lockfile", "--ignore-scripts"];
const PACKAGE_JSON = JSON.stringify({ name: "plugin", dependencies: { "pkd-dep": "1.0.0" } });
const LOCKFILE = '{"lockfileVersion":3}';
const MODULE_TEXT = 'module.exports = "pkd-dep loaded";\n';
const SUCCESS: PackageManagerRun = { code: 0, stdout: "", stderr: "", timedOut: false };

interface SeededPlugin {
  readonly locations: ScopedLocations;
  readonly pluginRoot: string;
  readonly workDir: string;
  readonly context: PackagesPhaseContext;
}

async function seedPlugin(
  t: TestContext,
  files: Readonly<Record<string, string>>,
  placement: "contained" | "outside" = "contained",
): Promise<SeededPlugin> {
  const environment = await createHermeticEnvironment(t, "package-install-");
  const locations = locationsFor("project", environment.cwd);
  const pluginRoot =
    placement === "contained"
      ? path.join(locations.extensionRoot, "plugin-clones", "abcdef123456", "plugin")
      : path.join(environment.cwd, "marketplace", "plugins", "plugin");
  await mkdir(pluginRoot, { recursive: true });
  for (const [name, text] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(pluginRoot, name)), { recursive: true });
    await writeFile(path.join(pluginRoot, name), text);
  }

  return {
    locations,
    pluginRoot,
    workDir: path.join(locations.extensionRoot, "sources-staging", "work-1"),
    context: { locations, resolved: { pluginRoot }, discoveryWarnings: [] },
  };
}

function opsWith(runPackageManager: PackageManagerRunner): PackageInstallOps {
  return { runPackageManager, newWorkDirName: () => "work-1" };
}

async function writeModule(directory: string): Promise<void> {
  await mkdir(path.join(directory, "node_modules", "pkd-dep"), { recursive: true });
  await writeFile(path.join(directory, "node_modules", "pkd-dep", "index.js"), MODULE_TEXT);
}

// The package manager this case stands in for: it records each request and
// installs one module into the work dir.
function installingRunner(requests: PackageManagerRequest[]): PackageManagerRunner {
  return async (request) => {
    requests.push(request);
    await writeModule(request.cwd);
    return SUCCESS;
  };
}

function answeringRunner(run: PackageManagerRun): PackageManagerRunner {
  return () => Promise.resolve(run);
}

function idleRunner(): PackageManagerRunner {
  return mock<PackageManagerRunner>({ exactParams: true, name: "package manager" });
}

async function sortedEntries(directory: string): Promise<string[]> {
  return (await readdir(directory)).sort();
}

describe("createPackagesPhase", () => {
  test("installs the packages a package-lock.json lists and moves node_modules into the plugin root", async (t) => {
    // arrange
    const seeded = await seedPlugin(t, {
      "package.json": PACKAGE_JSON,
      "package-lock.json": LOCKFILE,
    });
    const requests: PackageManagerRequest[] = [];
    const phase = createPackagesPhase(opsWith(installingRunner(requests)));

    // act
    await phase.do(seeded.context);

    // assert
    assert.deepStrictEqual(requests, [
      { command: "npm", args: NPM_CI_ARGUMENTS, cwd: seeded.workDir },
    ]);
    assert.deepStrictEqual(seeded.context.discoveryWarnings, []);
    assert.strictEqual(
      await readFile(path.join(seeded.pluginRoot, "node_modules", "pkd-dep", "index.js"), "utf8"),
      MODULE_TEXT,
    );
    assert.deepStrictEqual(
      await readdir(path.join(seeded.locations.extensionRoot, "sources-staging")),
      [],
    );
  });

  for (const { lockfiles, copied, expectedRequest } of [
    {
      lockfiles: ["bun.lock", "package-lock.json"],
      copied: "bun.lock",
      expectedRequest: (workDir: string): PackageManagerRequest => ({
        command: "bun",
        args: BUN_INSTALL_ARGUMENTS,
        cwd: workDir,
        env: { BUN_INSTALL_CACHE_DIR: path.join(workDir, "bun-cache") },
      }),
    },
    {
      lockfiles: ["npm-shrinkwrap.json", "package-lock.json"],
      copied: "npm-shrinkwrap.json",
      expectedRequest: (workDir: string): PackageManagerRequest => ({
        command: "npm",
        args: NPM_CI_ARGUMENTS,
        cwd: workDir,
      }),
    },
    {
      lockfiles: ["package-lock.json"],
      copied: "package-lock.json",
      expectedRequest: (workDir: string): PackageManagerRequest => ({
        command: "npm",
        args: NPM_CI_ARGUMENTS,
        cwd: workDir,
      }),
    },
  ]) {
    test(`D-PL9-01: runs the ${copied} command when the plugin ships ${lockfiles.join(" and ")}`, async (t) => {
      // arrange
      const seeded = await seedPlugin(t, {
        "package.json": PACKAGE_JSON,
        ...Object.fromEntries(lockfiles.map((lockfile) => [lockfile, LOCKFILE])),
      });
      const launches: Array<{ request: PackageManagerRequest; files: string[] }> = [];
      const phase = createPackagesPhase(
        opsWith(async (request) => {
          launches.push({ request, files: await sortedEntries(request.cwd) });
          return SUCCESS;
        }),
      );

      // act
      await phase.do(seeded.context);

      // assert
      assert.deepStrictEqual(launches, [
        { request: expectedRequest(seeded.workDir), files: [copied, "package.json"].sort() },
      ]);
      assert.deepStrictEqual(seeded.context.discoveryWarnings, []);
    });
  }

  test("gives the package manager a work dir that holds only package.json and the lockfile, byte for byte", async (t) => {
    // arrange
    const seeded = await seedPlugin(t, {
      "package.json": PACKAGE_JSON,
      "package-lock.json": LOCKFILE,
      "README.md": "# plugin\n",
      ".npmrc": "registry=http://127.0.0.1:9/\n",
    });
    const workDirs: Array<Record<string, string>> = [];
    const phase = createPackagesPhase(
      opsWith(async (request) => {
        const names = await sortedEntries(request.cwd);
        const files = await Promise.all(
          names.map(
            async (name) => [name, await readFile(path.join(request.cwd, name), "utf8")] as const,
          ),
        );
        workDirs.push(Object.fromEntries(files));
        return SUCCESS;
      }),
    );

    // act
    await phase.do(seeded.context);

    // assert
    assert.deepStrictEqual(workDirs, [
      { "package-lock.json": LOCKFILE, "package.json": PACKAGE_JSON },
    ]);
  });

  for (const { situation, files } of [
    { situation: "no package.json", files: { "package-lock.json": LOCKFILE } },
    {
      situation: "a package.json that lists nothing",
      files: { "package.json": "{}", "package-lock.json": LOCKFILE },
    },
    {
      situation: "a package.json with empty dependencies",
      files: { "package.json": '{"dependencies":{}}', "package-lock.json": LOCKFILE },
    },
    {
      situation: "a package.json with empty workspaces",
      files: { "package.json": '{"workspaces":[]}', "package-lock.json": LOCKFILE },
    },
    { situation: "no supported lockfile", files: { "package.json": PACKAGE_JSON } },
    {
      situation: "a node_modules already present",
      files: {
        "package.json": PACKAGE_JSON,
        "package-lock.json": LOCKFILE,
        "node_modules/kept/index.js": MODULE_TEXT,
      },
    },
  ]) {
    test(`D-PL9-02 / D-PL9-06: skips a plugin root with ${situation} and runs nothing`, async (t) => {
      // arrange
      const seeded = await seedPlugin(t, files);
      const entriesBefore = await sortedEntries(seeded.pluginRoot);
      const runPackageManager = idleRunner();
      const phase = createPackagesPhase(opsWith(runPackageManager));

      // act
      await phase.do(seeded.context);

      // assert
      assert.deepStrictEqual(seeded.context.discoveryWarnings, []);
      assert.deepStrictEqual(await sortedEntries(seeded.pluginRoot), entriesBefore);
      verify(runPackageManager);
    });
  }

  test("D-PL9-03: skips a plugin root outside the extension root and runs nothing", async (t) => {
    // arrange
    const seeded = await seedPlugin(
      t,
      { "package.json": PACKAGE_JSON, "package-lock.json": LOCKFILE },
      "outside",
    );
    const runPackageManager = idleRunner();
    const phase = createPackagesPhase(opsWith(runPackageManager));

    // act
    await phase.do(seeded.context);

    // assert
    assert.deepStrictEqual(seeded.context.discoveryWarnings, []);
    assert.deepStrictEqual(await sortedEntries(seeded.pluginRoot), [
      "package-lock.json",
      "package.json",
    ]);
    verify(runPackageManager);
  });

  test("skips a plugin root that does not exist and runs nothing", async (t) => {
    // arrange
    const seeded = await seedPlugin(t, {});
    await rm(seeded.pluginRoot, { recursive: true });
    const runPackageManager = idleRunner();
    const phase = createPackagesPhase(opsWith(runPackageManager));

    // act
    await phase.do(seeded.context);

    // assert
    assert.deepStrictEqual(seeded.context.discoveryWarnings, []);
    verify(runPackageManager);
  });

  for (const { field, listing } of [
    { field: "dependencies", listing: { "pkd-dep": "1.0.0" } },
    { field: "optionalDependencies", listing: { "pkd-dep": "1.0.0" } },
    { field: "peerDependencies", listing: { "pkd-dep": "1.0.0" } },
    { field: "workspaces", listing: ["packages/*"] },
  ]) {
    test(`D-PL9-02: runs the package manager when package.json lists ${field}`, async (t) => {
      // arrange
      const seeded = await seedPlugin(t, {
        "package.json": JSON.stringify({ [field]: listing }),
        "package-lock.json": LOCKFILE,
      });
      const requests: PackageManagerRequest[] = [];
      const phase = createPackagesPhase(opsWith(installingRunner(requests)));

      // act
      await phase.do(seeded.context);

      // assert
      assert.deepStrictEqual(requests, [
        { command: "npm", args: NPM_CI_ARGUMENTS, cwd: seeded.workDir },
      ]);
    });
  }

  test("PKD-02: reports a failed install and leaves the plugin root as it was", async (t) => {
    // arrange
    const seeded = await seedPlugin(t, {
      "package.json": PACKAGE_JSON,
      "package-lock.json": LOCKFILE,
    });
    const phase = createPackagesPhase(
      opsWith(async (request) => {
        await writeModule(request.cwd);
        return { code: 1, stdout: "", stderr: "npm error E404\n", timedOut: false };
      }),
    );

    // act
    await phase.do(seeded.context);

    // assert
    assert.deepStrictEqual(seeded.context.discoveryWarnings, [
      "Plugin dependency install failed (npm): npm error E404",
    ]);
    assert.deepStrictEqual(await sortedEntries(seeded.pluginRoot), [
      "package-lock.json",
      "package.json",
    ]);
    assert.deepStrictEqual(
      await readdir(path.join(seeded.locations.extensionRoot, "sources-staging")),
      [],
    );
  });

  for (const { situation, run, note } of [
    {
      situation: "the output on stdout",
      run: { code: 1, stdout: " npm error ETARGET \n", stderr: "  \n", timedOut: false },
      note: "Plugin dependency install failed (npm): npm error ETARGET",
    },
    {
      situation: "the error of a process that could not start",
      run: {
        code: null,
        stdout: "",
        stderr: "",
        timedOut: false,
        error: new Error("spawn npm ENOENT"),
      },
      note: "Plugin dependency install failed (npm): spawn npm ENOENT",
    },
    {
      situation: "no output for a process that printed nothing",
      run: { code: 2, stdout: "", stderr: "", timedOut: false },
      note: "Plugin dependency install failed (npm): no output",
    },
    {
      situation: "the timeout for a process that ran too long",
      run: { code: null, stdout: "partial", stderr: "partial", timedOut: true },
      note: "Plugin dependency install failed (npm): timed out after 60 seconds",
    },
  ] satisfies Array<{ situation: string; run: PackageManagerRun; note: string }>) {
    test(`PKD-02: a failure note names ${situation}`, async (t) => {
      // arrange
      const seeded = await seedPlugin(t, {
        "package.json": PACKAGE_JSON,
        "package-lock.json": LOCKFILE,
      });
      const phase = createPackagesPhase(opsWith(answeringRunner(run)));

      // act
      await phase.do(seeded.context);

      // assert
      assert.deepStrictEqual(seeded.context.discoveryWarnings, [note]);
    });
  }

  test("cuts a failure note to 500 characters", async (t) => {
    // arrange
    const seeded = await seedPlugin(t, {
      "package.json": PACKAGE_JSON,
      "package-lock.json": LOCKFILE,
    });
    const prefix = "Plugin dependency install failed (npm): ";
    const phase = createPackagesPhase(
      opsWith(answeringRunner({ code: 1, stdout: "", stderr: "e".repeat(600), timedOut: false })),
    );

    // act
    await phase.do(seeded.context);

    // assert
    assert.deepStrictEqual(seeded.context.discoveryWarnings, [
      prefix + "e".repeat(500 - prefix.length),
    ]);
  });

  test("leaves the plugin root as it was when the package manager wrote no node_modules", async (t) => {
    // arrange
    const seeded = await seedPlugin(t, {
      "package.json": PACKAGE_JSON,
      "package-lock.json": LOCKFILE,
    });
    const phase = createPackagesPhase(opsWith(answeringRunner(SUCCESS)));

    // act
    await phase.do(seeded.context);

    // assert
    assert.deepStrictEqual(seeded.context.discoveryWarnings, []);
    assert.deepStrictEqual(await sortedEntries(seeded.pluginRoot), [
      "package-lock.json",
      "package.json",
    ]);
  });

  test("reports a move that fails and keeps no partial node_modules", async (t) => {
    // arrange
    const seeded = await seedPlugin(t, {
      "package.json": PACKAGE_JSON,
      "package-lock.json": LOCKFILE,
    });
    const builtModules = path.join(seeded.workDir, "node_modules");
    const pluginModules = path.join(seeded.pluginRoot, "node_modules");
    await mkdir(seeded.workDir, { recursive: true });
    await mkdir(builtModules, { mode: 0o555 });
    const moveError = await rename(builtModules, pluginModules).then(
      () => assert.fail("a read-only directory moved to another parent"),
      (error: unknown) => error,
    );
    assert.ok(moveError instanceof Error);
    await rm(seeded.workDir, { recursive: true });
    const phase = createPackagesPhase(
      opsWith(async (request) => {
        await mkdir(path.join(request.cwd, "node_modules"), { mode: 0o555 });
        return SUCCESS;
      }),
    );

    // act
    await phase.do(seeded.context);

    // assert
    assert.deepStrictEqual(seeded.context.discoveryWarnings, [
      `Plugin dependency install failed (npm): ${moveError.message}`,
    ]);
    assert.deepStrictEqual(await sortedEntries(seeded.pluginRoot), [
      "package-lock.json",
      "package.json",
    ]);
  });

  test("reports a detection error as a skip note and runs nothing", async (t) => {
    // arrange
    const seeded = await seedPlugin(t, {
      "package.json": PACKAGE_JSON,
      "package-lock.json": LOCKFILE,
    });
    const packageJsonPath = path.join(seeded.pluginRoot, "package.json");
    await chmod(packageJsonPath, 0o000);
    const readError = await readFile(packageJsonPath).then(
      () => assert.fail("an unreadable package.json was read"),
      (error: unknown) => error,
    );
    assert.ok(readError instanceof Error);
    const runPackageManager = idleRunner();
    const phase = createPackagesPhase(opsWith(runPackageManager));

    // act
    try {
      await phase.do(seeded.context);
    } finally {
      await chmod(packageJsonPath, 0o644);
    }

    // assert
    assert.deepStrictEqual(seeded.context.discoveryWarnings, [
      `Skipped installing this plugin's dependencies: ${readError.message}.`,
    ]);
    verify(runPackageManager);
  });

  test("reports a plugin root it cannot list as a skip note and runs nothing", async (t) => {
    // arrange
    const seeded = await seedPlugin(t, {
      "package.json": PACKAGE_JSON,
      "package-lock.json": LOCKFILE,
    });
    await chmod(seeded.pluginRoot, 0o000);
    const listError = await readdir(seeded.pluginRoot).then(
      () => assert.fail("an unreadable plugin root was listed"),
      (error: unknown) => error,
    );
    assert.ok(listError instanceof Error);
    const runPackageManager = idleRunner();
    const phase = createPackagesPhase(opsWith(runPackageManager));

    // act
    try {
      await phase.do(seeded.context);
    } finally {
      await chmod(seeded.pluginRoot, 0o755);
    }

    // assert
    assert.deepStrictEqual(seeded.context.discoveryWarnings, [
      `Skipped installing this plugin's dependencies: ${listError.message}.`,
    ]);
    verify(runPackageManager);
  });

  test("keeps the failure note when the work dir cannot be removed", async (t) => {
    // arrange
    const seeded = await seedPlugin(t, {
      "package.json": PACKAGE_JSON,
      "package-lock.json": LOCKFILE,
    });
    const lockedDir = path.join(seeded.workDir, "locked");
    const phase = createPackagesPhase(
      opsWith(async () => {
        await mkdir(lockedDir);
        await writeFile(path.join(lockedDir, "file"), "");
        await chmod(lockedDir, 0o555);
        return { code: 1, stdout: "", stderr: "npm error E404", timedOut: false };
      }),
    );

    // act
    try {
      await phase.do(seeded.context);
    } finally {
      await chmod(lockedDir, 0o755);
    }

    // assert
    assert.deepStrictEqual(seeded.context.discoveryWarnings, [
      "Plugin dependency install failed (npm): npm error E404",
    ]);
    assert.deepStrictEqual(await sortedEntries(seeded.workDir), ["locked"]);
  });

  test("D-PL9-05: undo removes the node_modules the phase created", async (t) => {
    // arrange
    const seeded = await seedPlugin(t, {
      "package.json": PACKAGE_JSON,
      "package-lock.json": LOCKFILE,
    });
    const phase = createPackagesPhase(opsWith(installingRunner([])));
    await phase.do(seeded.context);

    // act
    await phase.undo?.(seeded.context);

    // assert
    assert.deepStrictEqual(await sortedEntries(seeded.pluginRoot), [
      "package-lock.json",
      "package.json",
    ]);
  });

  test("D-PL9-05: undo leaves a node_modules the phase did not create", async (t) => {
    // arrange
    const seeded = await seedPlugin(t, {
      "package.json": PACKAGE_JSON,
      "package-lock.json": LOCKFILE,
      "node_modules/kept/index.js": MODULE_TEXT,
    });
    const phase = createPackagesPhase(opsWith(idleRunner()));
    await phase.do(seeded.context);

    // act
    await phase.undo?.(seeded.context);

    // assert
    assert.strictEqual(
      await readFile(path.join(seeded.pluginRoot, "node_modules", "kept", "index.js"), "utf8"),
      MODULE_TEXT,
    );
  });

  test("D-PL9-17: runs the real package manager launcher in a work dir and moves the modules it wrote into the plugin root", async (t) => {
    // arrange
    const seeded = await seedPlugin(t, {
      "package.json": PACKAGE_JSON,
      "package-lock.json": LOCKFILE,
    });
    const realRunner = createPackageManagerRunner({
      spawn: NODE_PACKAGE_MANAGER_SPAWN,
      timeoutMs: 10_000,
      killGraceMs: 1_000,
      env: {},
    });
    const script = [
      'const fs = require("node:fs");',
      'fs.mkdirSync("node_modules/pkd-dep", { recursive: true });',
      'fs.writeFileSync("node_modules/pkd-dep/package.json", JSON.stringify({ name: "pkd-dep", main: "index.js" }));',
      `fs.writeFileSync("node_modules/pkd-dep/index.js", ${JSON.stringify(MODULE_TEXT)});`,
    ].join("\n");
    const phase = createPackagesPhase(
      opsWith((request) =>
        realRunner({ ...request, command: process.execPath, args: ["-e", script] }),
      ),
    );

    // act
    await phase.do(seeded.context);

    // assert
    assert.deepStrictEqual(seeded.context.discoveryWarnings, []);
    const requireFromPlugin = createRequire(path.join(seeded.pluginRoot, "hook.cjs"));
    const loaded: unknown = requireFromPlugin("pkd-dep");
    assert.strictEqual(loaded, "pkd-dep loaded");
  });
});
