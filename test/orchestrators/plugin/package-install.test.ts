import assert from "node:assert/strict";
import {
  chmod,
  lstat,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  symlink,
  truncate,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, test } from "node:test";

import { mock, verify } from "strong-mock";

import {
  createPackagesPhase,
  installUpdatedPackages,
  removeInstalledPackages,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  createPackageManagerRunner,
  NODE_PACKAGE_MANAGER_HOST,
  NODE_PACKAGE_MANAGER_SPAWN,
} from "../../../extensions/pi-claude-marketplace/platform/package-manager.ts";
import { discoveryWarning } from "../../../extensions/pi-claude-marketplace/shared/staging-warnings.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";

import type {
  PackageInstallOps,
  PackagesPhaseContext,
  PackageStepTarget,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts";
import type { UpdateRunOutcome } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts";
import type { PluginUpdateUpdatedOutcome } from "../../../extensions/pi-claude-marketplace/orchestrators/types.ts";
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
const PKD_DEP_LINK = "https://registry.npmjs.org/pkd-dep/-/pkd-dep-1.0.0.tgz";
const HTTP_LINK = "http://127.0.0.1:4873/pkd-dep/-/pkd-dep-1.0.0.tgz";
const INTEGRITY = "sha512-AAAA";
const DEPENDENCIES = { dependencies: { "pkd-dep": "1.0.0" } };
const PACKAGE_JSON = JSON.stringify({ name: "plugin", ...DEPENDENCIES });

function npmLockfile(
  root: Readonly<Record<string, unknown>> = DEPENDENCIES,
  entries: Readonly<Record<string, unknown>> = {
    "node_modules/pkd-dep": { version: "1.0.0", resolved: PKD_DEP_LINK, integrity: INTEGRITY },
  },
): string {
  return JSON.stringify({
    name: "plugin",
    lockfileVersion: 3,
    packages: { "": { name: "plugin", ...root }, ...entries },
  });
}

const LOCKFILE = npmLockfile();
const BUN_LOCKFILE = JSON.stringify({
  lockfileVersion: 1,
  workspaces: { "": { name: "plugin", ...DEPENDENCIES } },
  packages: { "pkd-dep": ["pkd-dep@1.0.0", "", {}, INTEGRITY] },
});
const REWRITTEN_PACKAGE_JSON = [
  "{",
  '  "name": "plugin-dependencies",',
  '  "version": "0.0.0",',
  '  "dependencies": {',
  '    "pkd-dep": "1.0.0"',
  "  }",
  "}",
  "",
].join("\n");
const REWRITTEN_LOCKFILE = [
  "{",
  '  "name": "plugin-dependencies",',
  '  "version": "0.0.0",',
  '  "lockfileVersion": 3,',
  '  "requires": true,',
  '  "packages": {',
  '    "": {',
  '      "name": "plugin-dependencies",',
  '      "version": "0.0.0",',
  '      "dependencies": {',
  '        "pkd-dep": "1.0.0"',
  "      }",
  "    },",
  '    "node_modules/pkd-dep": {',
  '      "version": "1.0.0",',
  `      "resolved": "${PKD_DEP_LINK}",`,
  `      "integrity": "${INTEGRITY}"`,
  "    }",
  "  }",
  "}",
  "",
].join("\n");
const MODULE_TEXT = 'module.exports = "pkd-dep loaded";\n';
const SUCCESS: PackageManagerRun = { code: 0, stdout: "", stderr: "", timedOut: false };
const MARKETPLACE = "tools";
const BOM = "\uFEFF";
// D-PL9-22: the marker's name is the on-disk contract that uninstall reads.
const MARKER = ".pi-claude-marketplace";

interface SeededPlugin {
  readonly locations: ScopedLocations;
  readonly pluginRoot: string;
  readonly workDir: string;
  readonly target: Omit<PackageStepTarget, "force">;
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
    target: { locations, marketplace: MARKETPLACE, pluginRoot },
    context: {
      locations,
      marketplace: MARKETPLACE,
      resolved: { pluginRoot },
      discoveryWarnings: [],
    },
  };
}

function opsWith(
  runPackageManager: PackageManagerRunner,
  runRegistryQuery: PackageManagerRunner = idleRunner(),
): PackageInstallOps {
  return { runPackageManager, runRegistryQuery, newWorkDirName: () => "work-1" };
}

function npmRequest(workDir: string): PackageManagerRequest {
  return {
    command: "npm",
    args: [`--git=${path.join(workDir, "git-is-disabled")}`, ...NPM_CI_ARGUMENTS],
    cwd: workDir,
  };
}

// The files a directory holds, by name, with their text.
async function filesIn(directory: string): Promise<Record<string, string>> {
  const names = await sortedEntries(directory);
  const files = await Promise.all(
    names.map(async (name) => [name, await readFile(path.join(directory, name), "utf8")] as const),
  );
  return Object.fromEntries(files);
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
    assert.deepStrictEqual(requests, [npmRequest(seeded.workDir)]);
    assert.deepStrictEqual(
      seeded.context.discoveryWarnings.map((w) => w.message),
      [],
    );
    assert.strictEqual(
      await readFile(path.join(seeded.pluginRoot, "node_modules", "pkd-dep", "index.js"), "utf8"),
      MODULE_TEXT,
    );
    assert.deepStrictEqual(
      await readdir(path.join(seeded.locations.extensionRoot, "sources-staging")),
      [],
    );
  });

  for (const { lockfiles, chosen, written, expectedRequest } of [
    {
      lockfiles: { "bun.lock": BUN_LOCKFILE, "package-lock.json": LOCKFILE },
      chosen: "bun.lock",
      written: "bun.lock",
      expectedRequest: (workDir: string): PackageManagerRequest => ({
        command: "bun",
        args: BUN_INSTALL_ARGUMENTS,
        cwd: workDir,
        env: { BUN_INSTALL_CACHE_DIR: path.join(workDir, "bun-cache") },
      }),
    },
    {
      lockfiles: { "npm-shrinkwrap.json": LOCKFILE, "package-lock.json": LOCKFILE },
      chosen: "npm-shrinkwrap.json",
      written: "package-lock.json",
      expectedRequest: npmRequest,
    },
    {
      lockfiles: { "package-lock.json": LOCKFILE },
      chosen: "package-lock.json",
      written: "package-lock.json",
      expectedRequest: npmRequest,
    },
  ]) {
    test(`D-PL9-01: runs the ${chosen} command on a ${written} when the plugin ships ${Object.keys(lockfiles).join(" and ")}`, async (t) => {
      // arrange
      const seeded = await seedPlugin(t, { "package.json": PACKAGE_JSON, ...lockfiles });
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
        { request: expectedRequest(seeded.workDir), files: [written, "package.json"].sort() },
      ]);
      assert.deepStrictEqual(
        seeded.context.discoveryWarnings.map((w) => w.message),
        [],
      );
    });
  }

  test("D-PL9-22: marks the node_modules it moves into the plugin root with a regular file beside the packages", async (t) => {
    // arrange
    const seeded = await seedPlugin(t, {
      "package.json": PACKAGE_JSON,
      "package-lock.json": LOCKFILE,
    });
    const phase = createPackagesPhase(opsWith(installingRunner([])));

    // act
    await phase.do(seeded.context);

    // assert
    const modules = path.join(seeded.pluginRoot, "node_modules");
    assert.deepStrictEqual(await sortedEntries(modules), [MARKER, "pkd-dep"]);
    assert.ok((await lstat(path.join(modules, MARKER))).isFile());
  });

  test("D-PL9-04 / D-PL9-08: gives the package manager a work dir that holds only the rewritten package.json and lockfile", async (t) => {
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
        workDirs.push(await filesIn(request.cwd));
        return SUCCESS;
      }),
    );

    // act
    await phase.do(seeded.context);

    // assert
    assert.deepStrictEqual(workDirs, [
      { "package-lock.json": REWRITTEN_LOCKFILE, "package.json": REWRITTEN_PACKAGE_JSON },
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
      assert.deepStrictEqual(
        seeded.context.discoveryWarnings.map((w) => w.message),
        [],
      );
      assert.deepStrictEqual(await sortedEntries(seeded.pluginRoot), entriesBefore);
      verify(runPackageManager);
    });
  }

  for (const { lockfile, manager, command } of [
    {
      lockfile: "package-lock.json",
      manager: "npm",
      command: `npm ${NPM_CI_ARGUMENTS.join(" ")}`,
    },
    { lockfile: "bun.lock", manager: "bun", command: `bun ${BUN_INSTALL_ARGUMENTS.join(" ")}` },
  ]) {
    test(`D-PL9-03: names the ${manager} command for a ${lockfile} plugin outside the extension root and writes nothing`, async (t) => {
      // arrange
      const seeded = await seedPlugin(
        t,
        { "package.json": PACKAGE_JSON, [lockfile]: LOCKFILE },
        "outside",
      );
      const runPackageManager = idleRunner();
      const phase = createPackagesPhase(opsWith(runPackageManager));

      // act
      await phase.do(seeded.context);

      // assert
      assert.deepStrictEqual(
        seeded.context.discoveryWarnings.map((w) => w.message),
        [
          `Skipped installing this plugin's dependencies: its folder in the marketplace "tools" is outside the folders this extension manages, so it was not changed. To install them, run "${command}" in that folder.`,
        ],
      );
      assert.deepStrictEqual(
        await sortedEntries(seeded.pluginRoot),
        [lockfile, "package.json"].sort(),
      );
      verify(runPackageManager);
    });
  }

  test("D-PL9-03: gives no note for a plugin outside the extension root that already has node_modules", async (t) => {
    // arrange
    const seeded = await seedPlugin(
      t,
      {
        "package.json": PACKAGE_JSON,
        "package-lock.json": LOCKFILE,
        "node_modules/kept/index.js": MODULE_TEXT,
      },
      "outside",
    );
    const runPackageManager = idleRunner();
    const phase = createPackagesPhase(opsWith(runPackageManager));

    // act
    await phase.do(seeded.context);

    // assert
    assert.deepStrictEqual(
      seeded.context.discoveryWarnings.map((w) => w.message),
      [],
    );
    assert.deepStrictEqual(await sortedEntries(path.join(seeded.pluginRoot, "node_modules")), [
      "kept",
    ]);
    assert.strictEqual(
      await readFile(path.join(seeded.pluginRoot, "node_modules", "kept", "index.js"), "utf8"),
      MODULE_TEXT,
    );
    verify(runPackageManager);
  });

  test("T-09-15: treats a plugin root reached through a symlinked folder as outside and does not write it", async (t) => {
    // arrange
    const seeded = await seedPlugin(
      t,
      { "package.json": PACKAGE_JSON, "package-lock.json": LOCKFILE },
      "outside",
    );
    const linkTarget = path.dirname(seeded.pluginRoot);
    const link = path.join(seeded.locations.extensionRoot, "plugin-clones", "link");
    await mkdir(path.dirname(link), { recursive: true });
    await symlink(linkTarget, link);
    const linkedRoot = path.join(link, path.basename(seeded.pluginRoot));
    const runPackageManager = idleRunner();
    const phase = createPackagesPhase(opsWith(runPackageManager));
    const context: PackagesPhaseContext = {
      locations: seeded.locations,
      marketplace: MARKETPLACE,
      resolved: { pluginRoot: linkedRoot },
      discoveryWarnings: [],
    };

    // act
    await phase.do(context);

    // assert
    assert.deepStrictEqual(
      context.discoveryWarnings.map((w) => w.message),
      [
        `Skipped installing this plugin's dependencies: its folder in the marketplace "tools" is outside the folders this extension manages, so it was not changed. To install them, run "npm ${NPM_CI_ARGUMENTS.join(" ")}" in that folder.`,
      ],
    );
    assert.deepStrictEqual(await sortedEntries(linkTarget), [path.basename(seeded.pluginRoot)]);
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
    assert.deepStrictEqual(
      seeded.context.discoveryWarnings.map((w) => w.message),
      [],
    );
    verify(runPackageManager);
  });

  for (const { field, listing, root } of [
    { field: "dependencies", listing: { "pkd-dep": "1.0.0" }, root: DEPENDENCIES },
    {
      field: "optionalDependencies",
      listing: { "pkd-dep": "1.0.0" },
      root: { optionalDependencies: { "pkd-dep": "1.0.0" } },
    },
    {
      field: "peerDependencies",
      listing: { "pkd-dep": "1.0.0" },
      root: { peerDependencies: { "pkd-dep": "1.0.0" } },
    },
    { field: "workspaces", listing: ["packages/*"], root: {} },
  ]) {
    test(`D-PL9-02: runs the package manager when package.json lists ${field}`, async (t) => {
      // arrange
      const seeded = await seedPlugin(t, {
        "package.json": JSON.stringify({ [field]: listing }),
        "package-lock.json": npmLockfile(root),
      });
      const requests: PackageManagerRequest[] = [];
      const phase = createPackagesPhase(opsWith(installingRunner(requests)));

      // act
      await phase.do(seeded.context);

      // assert
      assert.deepStrictEqual(requests, [npmRequest(seeded.workDir)]);
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
    assert.deepStrictEqual(
      seeded.context.discoveryWarnings.map((w) => w.message),
      ["Plugin dependency install failed (npm): E404"],
    );
    assert.deepStrictEqual(await sortedEntries(seeded.pluginRoot), [
      "package-lock.json",
      "package.json",
    ]);
    assert.deepStrictEqual(
      await readdir(path.join(seeded.locations.extensionRoot, "sources-staging")),
      [],
    );
  });

  test("keeps the package-manager work dir until a timed-out run settles", async (t) => {
    // arrange
    const seeded = await seedPlugin(t, {
      "package.json": PACKAGE_JSON,
      "package-lock.json": LOCKFILE,
    });
    let releaseRun = (): void => {
      assert.fail("the package-manager run did not start");
    };

    let markStarted = (): void => undefined;
    const runBlocked = new Promise<void>((resolve) => {
      releaseRun = resolve;
    });
    const runStarted = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const phase = createPackagesPhase(
      opsWith(async (request) => {
        markStarted();
        await runBlocked;
        assert.deepStrictEqual(await sortedEntries(request.cwd), [
          "package-lock.json",
          "package.json",
        ]);
        return { code: null, stdout: "", stderr: "", timedOut: true };
      }),
    );
    let completed = false;

    // act
    const pending = phase.do(seeded.context);
    void pending.then(() => {
      completed = true;
    });
    await runStarted;
    await Promise.resolve();
    const completedBeforeSettlement = completed;
    const workDirBeforeSettlement = await sortedEntries(seeded.workDir);
    releaseRun();
    await pending;

    // assert
    assert.strictEqual(completedBeforeSettlement, false);
    assert.deepStrictEqual(workDirBeforeSettlement, ["package-lock.json", "package.json"]);
    assert.deepStrictEqual(
      seeded.context.discoveryWarnings.map((warning) => warning.message),
      ["Plugin dependency install failed (npm): timed out after 60 seconds"],
    );
    assert.deepStrictEqual(await sortedEntries(path.dirname(seeded.workDir)), []);
  });

  for (const { situation, run, note } of [
    {
      situation: "the output on stdout",
      run: { code: 1, stdout: " npm error ETARGET \n", stderr: "  \n", timedOut: false },
      note: "Plugin dependency install failed (npm): ETARGET",
    },
    {
      situation: "npm's error lines without its warnings, prefixes, or control characters",
      run: {
        code: 1,
        stdout: "",
        stderr: [
          "npm warn config production Use `--omit=dev` instead.",
          "\u001b[31mnpm error\u001b[39m code E404",
          "npm ERR! 404 Not Found\t- GET http://127.0.0.1/pkd-dep\u0007",
          "",
          "npm error A complete log of this run can be found in: /home/user/.npm/_logs/debug.log",
          "",
        ].join("\r\n"),
        timedOut: false,
      },
      note: "Plugin dependency install failed (npm): code E404; 404 Not Found - GET http://127.0.0.1/pkd-dep; A complete log of this run can be found in: /home/user/.npm/_logs/debug.log",
    },
    {
      situation: "npm's warnings when it printed nothing else",
      run: {
        code: 1,
        stdout: "",
        stderr: "npm warn old lockfile\nnpm warn tarball corrupt\n",
        timedOut: false,
      },
      note: "Plugin dependency install failed (npm): npm warn old lockfile; npm warn tarball corrupt",
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
      assert.deepStrictEqual(
        seeded.context.discoveryWarnings.map((w) => w.message),
        [note],
      );
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
    assert.deepStrictEqual(
      seeded.context.discoveryWarnings.map((w) => w.message),
      [prefix + "e".repeat(500 - prefix.length)],
    );
  });

  for (const { characters, ending } of [
    { characters: 498, ending: "😀" },
    { characters: 499, ending: "" },
  ]) {
    test(`keeps whole Unicode characters in a failure note after ${characters} characters`, async (t) => {
      // arrange
      const seeded = await seedPlugin(t, {
        "package.json": PACKAGE_JSON,
        "package-lock.json": LOCKFILE,
      });
      const prefix = "Plugin dependency install failed (npm): ";
      const padding = "e".repeat(characters - prefix.length);
      const phase = createPackagesPhase(
        opsWith(
          answeringRunner({
            code: 1,
            stdout: "",
            stderr: padding + "😀tail",
            timedOut: false,
          }),
        ),
      );

      // act
      await phase.do(seeded.context);

      // assert
      assert.deepStrictEqual(
        seeded.context.discoveryWarnings.map((warning) => warning.message),
        [prefix + padding + ending],
      );
    });
  }

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
    assert.deepStrictEqual(
      seeded.context.discoveryWarnings.map((w) => w.message),
      [],
    );
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
    assert.deepStrictEqual(
      seeded.context.discoveryWarnings.map((w) => w.message),
      [`Plugin dependency install failed (npm): ${moveError.message}`],
    );
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
    assert.deepStrictEqual(
      seeded.context.discoveryWarnings.map((w) => w.message),
      [`Skipped installing this plugin's dependencies: ${readError.message}.`],
    );
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
    assert.deepStrictEqual(
      seeded.context.discoveryWarnings.map((w) => w.message),
      [`Skipped installing this plugin's dependencies: ${listError.message}.`],
    );
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
    assert.deepStrictEqual(
      seeded.context.discoveryWarnings.map((w) => w.message),
      ["Plugin dependency install failed (npm): E404"],
    );
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

  test("D-PL9-08: refuses a lockfile that lists a package from a local folder and runs nothing", async (t) => {
    // arrange
    const lists = { dependencies: { "pkd-dep": "1.0.0", "pkd-local": "file:../pkd-local" } };
    const seeded = await seedPlugin(t, {
      "package.json": JSON.stringify({ name: "plugin", ...lists }),
      "package-lock.json": npmLockfile(lists, {
        "node_modules/pkd-dep": { version: "1.0.0", resolved: PKD_DEP_LINK, integrity: INTEGRITY },
        "node_modules/pkd-local": { resolved: "../pkd-local", link: true },
        "../pkd-local": { name: "pkd-local", version: "1.0.0" },
      }),
    });
    const runPackageManager = idleRunner();
    const phase = createPackagesPhase(opsWith(runPackageManager));

    // act
    await phase.do(seeded.context);

    // assert
    assert.deepStrictEqual(
      seeded.context.discoveryWarnings.map((w) => w.message),
      [
        "Skipped installing this plugin's dependencies: its package-lock.json has a dependency that is not a registry package and version range: pkd-local.",
      ],
    );
    assert.deepStrictEqual(await sortedEntries(seeded.pluginRoot), [
      "package-lock.json",
      "package.json",
    ]);
    assert.deepStrictEqual(
      await readdir(path.join(seeded.locations.extensionRoot, "sources-staging")),
      [],
    );
    verify(runPackageManager);
  });

  test("D-PL9-02: runs nothing and says nothing for a lockfile that lists no package", async (t) => {
    // arrange
    const seeded = await seedPlugin(t, {
      "package.json": PACKAGE_JSON,
      "package-lock.json": npmLockfile(DEPENDENCIES, {}),
    });
    const runPackageManager = idleRunner();
    const phase = createPackagesPhase(opsWith(runPackageManager));

    // act
    await phase.do(seeded.context);

    // assert
    assert.deepStrictEqual(
      seeded.context.discoveryWarnings.map((w) => w.message),
      [],
    );
    assert.deepStrictEqual(await sortedEntries(seeded.pluginRoot), [
      "package-lock.json",
      "package.json",
    ]);
    verify(runPackageManager);
  });

  test("D-PL9-08: asks npm for its registry in a bare work dir and installs a lockfile whose http links are on it", async (t) => {
    // arrange
    const seeded = await seedPlugin(t, {
      "package.json": PACKAGE_JSON,
      "package-lock.json": npmLockfile(DEPENDENCIES, {
        "node_modules/pkd-dep": { version: "1.0.0", resolved: HTTP_LINK, integrity: INTEGRITY },
      }),
    });
    const queries: Array<{ request: PackageManagerRequest; files: Record<string, string> }> = [];
    const requests: PackageManagerRequest[] = [];
    const phase = createPackagesPhase(
      opsWith(installingRunner(requests), async (request) => {
        queries.push({ request, files: await filesIn(request.cwd) });
        return { code: 0, stdout: "http://127.0.0.1:4873/\n", stderr: "", timedOut: false };
      }),
    );

    // act
    await phase.do(seeded.context);

    // assert
    assert.deepStrictEqual(queries, [
      {
        request: {
          command: "npm",
          args: [
            `--git=${path.join(seeded.workDir, "git-is-disabled")}`,
            "config",
            "get",
            "registry",
            "--workspaces=false",
          ],
          cwd: seeded.workDir,
        },
        files: { "package.json": "{}" },
      },
    ]);
    assert.deepStrictEqual(requests, [npmRequest(seeded.workDir)]);
    assert.deepStrictEqual(
      seeded.context.discoveryWarnings.map((w) => w.message),
      [],
    );
    assert.strictEqual(
      await readFile(path.join(seeded.pluginRoot, "node_modules", "pkd-dep", "index.js"), "utf8"),
      MODULE_TEXT,
    );
  });

  for (const { situation, run } of [
    {
      situation: "a registry on another host",
      run: { code: 0, stdout: "http://127.0.0.1:9/\n", stderr: "", timedOut: false },
    },
    {
      situation: "a registry query that fails",
      run: { code: 1, stdout: "http://127.0.0.1:4873/\n", stderr: "", timedOut: false },
    },
    {
      situation: "an https registry",
      run: { code: 0, stdout: "https://registry.npmjs.org/\n", stderr: "", timedOut: false },
    },
    {
      situation: "a registry answer that is not a link",
      run: { code: 0, stdout: "registry\n", stderr: "", timedOut: false },
    },
  ] satisfies Array<{ situation: string; run: PackageManagerRun }>) {
    test(`D-PL9-08: refuses an http link and installs nothing for ${situation}`, async (t) => {
      // arrange
      const seeded = await seedPlugin(t, {
        "package.json": PACKAGE_JSON,
        "package-lock.json": npmLockfile(DEPENDENCIES, {
          "node_modules/pkd-dep": { version: "1.0.0", resolved: HTTP_LINK, integrity: INTEGRITY },
        }),
      });
      const runPackageManager = idleRunner();
      const phase = createPackagesPhase(opsWith(runPackageManager, answeringRunner(run)));

      // act
      await phase.do(seeded.context);

      // assert
      assert.deepStrictEqual(
        seeded.context.discoveryWarnings.map((w) => w.message),
        [
          `Skipped installing this plugin's dependencies: its package-lock.json entry "node_modules/pkd-dep" has a download link that is an unencrypted http link on a host other than your npm registry, so npm could send your saved registry token to it in the clear.`,
        ],
      );
      assert.deepStrictEqual(await sortedEntries(seeded.pluginRoot), [
        "package-lock.json",
        "package.json",
      ]);
      verify(runPackageManager);
    });
  }

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
      host: NODE_PACKAGE_MANAGER_HOST,
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
    assert.deepStrictEqual(
      seeded.context.discoveryWarnings.map((w) => w.message),
      [],
    );
    const requireFromPlugin = createRequire(path.join(seeded.pluginRoot, "hook.cjs"));
    const loaded: unknown = requireFromPlugin("pkd-dep");
    assert.strictEqual(loaded, "pkd-dep loaded");
  });

  for (const lockfile of ["yarn.lock", "pnpm-lock.yaml"]) {
    test(`D-PL9-01: refuses a ${lockfile} with Claude Code's note and runs nothing`, async (t) => {
      // arrange
      const seeded = await seedPlugin(t, { "package.json": PACKAGE_JSON, [lockfile]: LOCKFILE });
      const runPackageManager = idleRunner();
      const phase = createPackagesPhase(opsWith(runPackageManager));

      // act
      await phase.do(seeded.context);

      // assert
      assert.deepStrictEqual(
        seeded.context.discoveryWarnings.map((w) => w.message),
        [
          "The packages it lists were not installed, because it uses a yarn or pnpm lockfile, which plugin installs do not support.",
        ],
      );
      verify(runPackageManager);
    });

    test(`D-PL10-18: ignores a ${lockfile} when package.json lists no packages`, async (t) => {
      // arrange
      const seeded = await seedPlugin(t, {
        "package.json": '{"name":"plugin"}',
        [lockfile]: LOCKFILE,
      });
      const runPackageManager = idleRunner();
      const phase = createPackagesPhase(opsWith(runPackageManager));

      // act
      await phase.do(seeded.context);

      // assert
      assert.deepStrictEqual(seeded.context.discoveryWarnings, []);
      verify(runPackageManager);
    });
  }

  test("D-PL9-01: runs npm when a package-lock.json sits beside a yarn.lock", async (t) => {
    // arrange
    const seeded = await seedPlugin(t, {
      "package.json": PACKAGE_JSON,
      "package-lock.json": LOCKFILE,
      "yarn.lock": LOCKFILE,
    });
    const requests: PackageManagerRequest[] = [];
    const phase = createPackagesPhase(opsWith(installingRunner(requests)));

    // act
    await phase.do(seeded.context);

    // assert
    assert.deepStrictEqual(requests, [npmRequest(seeded.workDir)]);
    assert.deepStrictEqual(
      seeded.context.discoveryWarnings.map((w) => w.message),
      [],
    );
  });

  test("D-PL9-01: refuses a bun.lockb with Claude Code's note and runs nothing", async (t) => {
    // arrange
    const seeded = await seedPlugin(t, { "package.json": PACKAGE_JSON, "bun.lockb": LOCKFILE });
    const runPackageManager = idleRunner();
    const phase = createPackagesPhase(opsWith(runPackageManager));

    // act
    await phase.do(seeded.context);

    // assert
    assert.deepStrictEqual(
      seeded.context.discoveryWarnings.map((w) => w.message),
      [
        "Skipped installing this plugin's dependencies: its bun.lockb is a binary lockfile that cannot be checked; ship a text bun.lock instead.",
      ],
    );
    verify(runPackageManager);
  });

  for (const { lockfile, text, command } of [
    { lockfile: "bun.lock", text: BUN_LOCKFILE, command: "bun" },
    { lockfile: "package-lock.json", text: LOCKFILE, command: "npm" },
  ]) {
    test(`D-PL9-01: runs ${command} when a ${lockfile} sits beside a bun.lockb`, async (t) => {
      // arrange
      const seeded = await seedPlugin(t, {
        "package.json": PACKAGE_JSON,
        [lockfile]: text,
        "bun.lockb": LOCKFILE,
      });
      const commands: string[] = [];
      const phase = createPackagesPhase(
        opsWith((request) => {
          commands.push(request.command);
          return Promise.resolve(SUCCESS);
        }),
      );

      // act
      await phase.do(seeded.context);

      // assert
      assert.deepStrictEqual(commands, [command]);
      assert.deepStrictEqual(
        seeded.context.discoveryWarnings.map((w) => w.message),
        [],
      );
    });
  }

  test("D-PL9-16: refuses a package.json that is not valid JSON and runs nothing", async (t) => {
    // arrange
    const seeded = await seedPlugin(t, {
      "package.json": '{"dependencies":',
      "package-lock.json": LOCKFILE,
    });
    const runPackageManager = idleRunner();
    const phase = createPackagesPhase(opsWith(runPackageManager));

    // act
    await phase.do(seeded.context);

    // assert
    assert.deepStrictEqual(
      seeded.context.discoveryWarnings.map((w) => w.message),
      ["Skipped installing this plugin's dependencies: its package.json is not valid JSON."],
    );
    verify(runPackageManager);
  });

  for (const { situation, marks, workDirs, notes } of [
    {
      situation: "a package.json and a lockfile that each start with one byte-order mark",
      marks: BOM,
      workDirs: [
        { "package-lock.json": REWRITTEN_LOCKFILE, "package.json": REWRITTEN_PACKAGE_JSON },
      ],
      notes: [],
    },
    {
      situation: "a package.json that starts with two byte-order marks",
      marks: BOM + BOM,
      workDirs: [],
      notes: ["Skipped installing this plugin's dependencies: its package.json is not valid JSON."],
    },
  ]) {
    test(`D-PL9-08 / D-PL9-16: handles ${situation} as Claude Code does`, async (t) => {
      // arrange
      const seeded = await seedPlugin(t, {
        "package.json": marks + PACKAGE_JSON,
        "package-lock.json": BOM + LOCKFILE,
      });
      const seen: Array<Record<string, string>> = [];
      const phase = createPackagesPhase(
        opsWith(async (request) => {
          seen.push(await filesIn(request.cwd));
          return SUCCESS;
        }),
      );

      // act
      await phase.do(seeded.context);

      // assert
      assert.deepStrictEqual(seen, workDirs);
      assert.deepStrictEqual(
        seeded.context.discoveryWarnings.map((w) => w.message),
        notes,
      );
    });
  }

  for (const packageJson of ["[]", '"text"', "null"]) {
    test(`refuses a package.json of ${packageJson}, which is not a JSON object, and runs nothing`, async (t) => {
      // arrange
      const seeded = await seedPlugin(t, {
        "package.json": packageJson,
        "package-lock.json": LOCKFILE,
      });
      const runPackageManager = idleRunner();
      const phase = createPackagesPhase(opsWith(runPackageManager));

      // act
      await phase.do(seeded.context);

      // assert
      assert.deepStrictEqual(
        seeded.context.discoveryWarnings.map((w) => w.message),
        ["Skipped installing this plugin's dependencies: its package.json is not a JSON object."],
      );
      verify(runPackageManager);
    });
  }

  for (const { file, shape, place } of [
    {
      file: "package.json",
      shape: "a symlink to a file outside the plugin root",
      place: async (seeded: SeededPlugin): Promise<void> => {
        const outsideFile = path.join(seeded.locations.scopeRoot, "outside-package.json");
        await writeFile(outsideFile, PACKAGE_JSON);
        await symlink(outsideFile, path.join(seeded.pluginRoot, "package.json"));
        await writeFile(path.join(seeded.pluginRoot, "package-lock.json"), LOCKFILE);
      },
    },
    {
      file: "package-lock.json",
      shape: "a directory",
      place: async (seeded: SeededPlugin): Promise<void> => {
        await writeFile(path.join(seeded.pluginRoot, "package.json"), PACKAGE_JSON);
        await mkdir(path.join(seeded.pluginRoot, "package-lock.json"));
      },
    },
  ]) {
    test(`T-09-06: refuses a ${file} that is ${shape} and runs nothing`, async (t) => {
      // arrange
      const seeded = await seedPlugin(t, {});
      await place(seeded);
      const runPackageManager = idleRunner();
      const phase = createPackagesPhase(opsWith(runPackageManager));

      // act
      await phase.do(seeded.context);

      // assert
      assert.deepStrictEqual(
        seeded.context.discoveryWarnings.map((w) => w.message),
        [`Skipped installing this plugin's dependencies: its ${file} is not a regular file.`],
      );
      verify(runPackageManager);
    });
  }

  test("T-09-06: refuses a package.json larger than 32 MB and runs nothing", async (t) => {
    // arrange
    const seeded = await seedPlugin(t, { "package.json": "", "package-lock.json": LOCKFILE });
    await truncate(path.join(seeded.pluginRoot, "package.json"), 33_554_433);
    const runPackageManager = idleRunner();
    const phase = createPackagesPhase(opsWith(runPackageManager));

    // act
    await phase.do(seeded.context);

    // assert
    assert.deepStrictEqual(
      seeded.context.discoveryWarnings.map((w) => w.message),
      [
        "Skipped installing this plugin's dependencies: its package.json is not a regular file of at most 32 MB.",
      ],
    );
    verify(runPackageManager);
  });

  test("D-PL9-06: skips a plugin root with node_modules and a yarn.lock without a note", async (t) => {
    // arrange
    const seeded = await seedPlugin(t, {
      "package.json": PACKAGE_JSON,
      "yarn.lock": LOCKFILE,
      "node_modules/kept/index.js": MODULE_TEXT,
    });
    const runPackageManager = idleRunner();
    const phase = createPackagesPhase(opsWith(runPackageManager));

    // act
    await phase.do(seeded.context);

    // assert
    assert.deepStrictEqual(
      seeded.context.discoveryWarnings.map((w) => w.message),
      [],
    );
    verify(runPackageManager);
  });
});

const FAILED_RUN: PackageManagerRun = { code: 1, stdout: "", stderr: "boom", timedOut: false };

function updatedOutcome(): PluginUpdateUpdatedOutcome {
  return {
    partition: "updated",
    resourcesChanged: true,
    name: "plugin",
    fromVersion: "1.0.0",
    toVersion: "1.1.0",
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
    constraint: undefined,
  };
}

function filesWithOldModule(): Readonly<Record<string, string>> {
  return {
    "package.json": PACKAGE_JSON,
    "package-lock.json": LOCKFILE,
    "node_modules/old-dep/index.js": MODULE_TEXT,
  };
}

describe("installUpdatedPackages", () => {
  for (const { partition, outcome } of [
    {
      partition: "unchanged",
      outcome: (): UpdateRunOutcome => ({
        partition: "unchanged",
        name: "plugin",
        fromVersion: "1.0.0",
        toVersion: "1.0.0",
        constraint: undefined,
        declaresAgents: false,
        declaresMcp: false,
        declaresWorkflows: false,
      }),
    },
    {
      partition: "failed",
      outcome: (): UpdateRunOutcome => ({
        partition: "failed",
        name: "plugin",
        fromVersion: "1.0.0",
        notes: ["dependency refused"],
        reasons: ["dependency failed"],
        declaresAgents: false,
        declaresMcp: false,
        declaresWorkflows: false,
      }),
    },
  ]) {
    test(`passes a ${partition} outcome through unchanged and runs nothing`, async (t) => {
      // arrange
      const seeded = await seedPlugin(t, {
        "package.json": PACKAGE_JSON,
        "package-lock.json": LOCKFILE,
      });
      const runPackageManager = idleRunner();
      const expectedOutcome = outcome();

      // act
      const hookedOutcome = await installUpdatedPackages(
        opsWith(runPackageManager),
        expectedOutcome,
        { ...seeded.target, force: true },
      );

      // assert
      assert.strictEqual(hookedOutcome, expectedOutcome);
      assert.deepStrictEqual(await sortedEntries(seeded.pluginRoot), [
        "package-lock.json",
        "package.json",
      ]);
      verify(runPackageManager);
    });
  }

  test("installs the new version's packages over the existing node_modules when the swap moved to another revision", async (t) => {
    // arrange
    const seeded = await seedPlugin(t, filesWithOldModule());
    const requests: PackageManagerRequest[] = [];

    // act
    const hookedOutcome = await installUpdatedPackages(
      opsWith(installingRunner(requests)),
      updatedOutcome(),
      { ...seeded.target, force: true },
    );

    // assert
    assert.deepStrictEqual(hookedOutcome, updatedOutcome());
    assert.deepStrictEqual(requests, [npmRequest(seeded.workDir)]);
    assert.deepStrictEqual(await sortedEntries(path.join(seeded.pluginRoot, "node_modules")), [
      ".pi-claude-marketplace",
      "pkd-dep",
    ]);
    assert.strictEqual(
      await readFile(path.join(seeded.pluginRoot, "node_modules", "pkd-dep", "index.js"), "utf8"),
      MODULE_TEXT,
    );
    assert.deepStrictEqual(
      await readdir(path.join(seeded.locations.extensionRoot, "sources-staging")),
      [],
    );
  });

  test("keeps an installed node_modules and runs nothing when the swap re-materialized the recorded revision", async (t) => {
    // arrange
    const seeded = await seedPlugin(t, filesWithOldModule());
    const runPackageManager = idleRunner();
    const expectedOutcome = updatedOutcome();

    // act
    const hookedOutcome = await installUpdatedPackages(
      opsWith(runPackageManager),
      expectedOutcome,
      { ...seeded.target, force: false },
    );

    // assert
    assert.strictEqual(hookedOutcome, expectedOutcome);
    assert.deepStrictEqual(await sortedEntries(path.join(seeded.pluginRoot, "node_modules")), [
      "old-dep",
    ]);
    verify(runPackageManager);
  });

  test("PKD-02: appends the note to the staging warnings the outcome already carries", async (t) => {
    // arrange
    const seeded = await seedPlugin(t, {
      "package.json": PACKAGE_JSON,
      "package-lock.json": LOCKFILE,
    });

    // act
    const hookedOutcome = await installUpdatedPackages(
      opsWith(answeringRunner(FAILED_RUN)),
      { ...updatedOutcome(), stagingWarnings: [discoveryWarning("first")] },
      { ...seeded.target, force: true },
    );

    // assert
    assert.deepStrictEqual(hookedOutcome, {
      ...updatedOutcome(),
      stagingWarnings: [
        discoveryWarning("first"),
        discoveryWarning("Plugin dependency install failed (npm): boom"),
      ],
      packageNote: "Plugin dependency install failed (npm): boom",
    });
  });

  test("PKD-02: adds a staging warning list for an outcome that carried none", async (t) => {
    // arrange
    const seeded = await seedPlugin(t, {
      "package.json": PACKAGE_JSON,
      "package-lock.json": LOCKFILE,
    });

    // act
    const hookedOutcome = await installUpdatedPackages(
      opsWith(answeringRunner(FAILED_RUN)),
      updatedOutcome(),
      { ...seeded.target, force: true },
    );

    // assert
    assert.deepStrictEqual(hookedOutcome, {
      ...updatedOutcome(),
      stagingWarnings: [discoveryWarning("Plugin dependency install failed (npm): boom")],
      packageNote: "Plugin dependency install failed (npm): boom",
    });
  });

  test("D-PL9-03: leaves an outside folder that has node_modules as it is even when the swap moved to another revision", async (t) => {
    // arrange
    const seeded = await seedPlugin(t, filesWithOldModule(), "outside");
    const runPackageManager = idleRunner();
    const expectedOutcome = updatedOutcome();

    // act
    const hookedOutcome = await installUpdatedPackages(
      opsWith(runPackageManager),
      expectedOutcome,
      { ...seeded.target, force: true },
    );

    // assert
    assert.strictEqual(hookedOutcome, expectedOutcome);
    assert.deepStrictEqual(await sortedEntries(path.join(seeded.pluginRoot, "node_modules")), [
      "old-dep",
    ]);
    verify(runPackageManager);
  });

  test("D-PL9-04: restores the replaced node_modules when the move into the plugin root fails", async (t) => {
    // arrange
    const seeded = await seedPlugin(t, {
      "package.json": PACKAGE_JSON,
      "package-lock.json": LOCKFILE,
    });
    const builtModules = path.join(seeded.workDir, "node_modules");
    await mkdir(seeded.workDir, { recursive: true });
    await mkdir(builtModules, { mode: 0o555 });
    const moveError = await rename(builtModules, path.join(seeded.pluginRoot, "node_modules")).then(
      () => assert.fail("a read-only directory moved to another parent"),
      (error: unknown) => error,
    );
    assert.ok(moveError instanceof Error);
    await rm(seeded.workDir, { recursive: true });
    await mkdir(path.join(seeded.pluginRoot, "node_modules", "old-dep"), { recursive: true });
    await writeFile(
      path.join(seeded.pluginRoot, "node_modules", "old-dep", "index.js"),
      MODULE_TEXT,
    );

    // act
    const hookedOutcome = await installUpdatedPackages(
      opsWith(async (request) => {
        await mkdir(path.join(request.cwd, "node_modules"), { mode: 0o555 });
        return SUCCESS;
      }),
      updatedOutcome(),
      { ...seeded.target, force: true },
    );

    // assert
    assert.deepStrictEqual(hookedOutcome, {
      ...updatedOutcome(),
      stagingWarnings: [
        discoveryWarning(`Plugin dependency install failed (npm): ${moveError.message}`),
      ],
      packageNote: `Plugin dependency install failed (npm): ${moveError.message}`,
    });
    assert.strictEqual(
      await readFile(path.join(seeded.pluginRoot, "node_modules", "old-dep", "index.js"), "utf8"),
      MODULE_TEXT,
    );
    assert.deepStrictEqual(
      await readdir(path.join(seeded.locations.extensionRoot, "sources-staging")),
      [],
    );
  });

  test("D-PL9-04: restores the replaced node_modules when the package manager wrote none", async (t) => {
    // arrange
    const seeded = await seedPlugin(t, filesWithOldModule());

    // act
    const hookedOutcome = await installUpdatedPackages(
      opsWith(answeringRunner(SUCCESS)),
      updatedOutcome(),
      { ...seeded.target, force: true },
    );

    // assert
    assert.deepStrictEqual(hookedOutcome, updatedOutcome());
    assert.deepStrictEqual(await sortedEntries(path.join(seeded.pluginRoot, "node_modules")), [
      "old-dep",
    ]);
    assert.strictEqual(
      await readFile(path.join(seeded.pluginRoot, "node_modules", "old-dep", "index.js"), "utf8"),
      MODULE_TEXT,
    );
    assert.deepStrictEqual(
      await readdir(path.join(seeded.locations.extensionRoot, "sources-staging")),
      [],
    );
  });
});

// A contained plugin whose node_modules the real packages phase wrote, so the
// marker writer and the remover are proven to agree.
async function seedInstalledPlugin(t: TestContext): Promise<SeededPlugin> {
  const seeded = await seedPlugin(t, {
    "package.json": PACKAGE_JSON,
    "package-lock.json": LOCKFILE,
  });
  await createPackagesPhase(opsWith(installingRunner([]))).do(seeded.context);
  return seeded;
}

function stagingDir(seeded: SeededPlugin): string {
  return path.join(seeded.locations.extensionRoot, "sources-staging");
}

describe("removeInstalledPackages", () => {
  test("D-PL9-22: removes a marked node_modules from a plugin root inside the extension root", async (t) => {
    // arrange
    const seeded = await seedInstalledPlugin(t);

    // act
    await removeInstalledPackages(opsWith(idleRunner()), seeded.locations, seeded.pluginRoot);

    // assert
    assert.deepStrictEqual(await sortedEntries(seeded.pluginRoot), [
      "package-lock.json",
      "package.json",
    ]);
    assert.deepStrictEqual(await readdir(stagingDir(seeded)), []);
  });

  for (const { kept, files, placement } of [
    {
      kept: "a node_modules without the marker",
      files: { "node_modules/kept/index.js": MODULE_TEXT },
      placement: "contained",
    },
    {
      kept: "a marked node_modules outside the extension root",
      files: { [`node_modules/${MARKER}`]: "", "node_modules/kept/index.js": MODULE_TEXT },
      placement: "outside",
    },
    {
      kept: "a node_modules whose marker is a folder",
      files: { [`node_modules/${MARKER}/file`]: "", "node_modules/kept/index.js": MODULE_TEXT },
      placement: "contained",
    },
  ] as const) {
    test(`D-PL9-22 / NFR-10: keeps ${kept}`, async (t) => {
      // arrange
      const seeded = await seedPlugin(t, files, placement);
      const modules = path.join(seeded.pluginRoot, "node_modules");
      const before = await sortedEntries(modules);

      // act
      await removeInstalledPackages(opsWith(idleRunner()), seeded.locations, seeded.pluginRoot);

      // assert
      assert.deepStrictEqual(await sortedEntries(modules), before);
      assert.strictEqual(
        await readFile(path.join(modules, "kept", "index.js"), "utf8"),
        MODULE_TEXT,
      );
    });
  }

  test("D-PL9-22 / NFR-10: keeps a node_modules that is a symlink to a marked folder", async (t) => {
    // arrange
    const seeded = await seedPlugin(t, {});
    const linkTarget = path.join(seeded.locations.extensionRoot, "linked-modules");
    await mkdir(path.join(linkTarget, "kept"), { recursive: true });
    await writeFile(path.join(linkTarget, MARKER), "");
    await writeFile(path.join(linkTarget, "kept", "index.js"), MODULE_TEXT);
    const link = path.join(seeded.pluginRoot, "node_modules");
    await symlink(linkTarget, link);

    // act
    await removeInstalledPackages(opsWith(idleRunner()), seeded.locations, seeded.pluginRoot);

    // assert
    assert.ok((await lstat(link)).isSymbolicLink());
    assert.deepStrictEqual(await sortedEntries(linkTarget), [MARKER, "kept"]);
  });

  test("D-PL9-22: leaves the moved copy in sources-staging when it cannot be deleted", async (t) => {
    // arrange
    const seeded = await seedInstalledPlugin(t);
    const movedPackage = path.join(stagingDir(seeded), "work-1", "node_modules", "pkd-dep");
    await chmod(path.join(seeded.pluginRoot, "node_modules", "pkd-dep"), 0o555);

    // act
    try {
      await removeInstalledPackages(opsWith(idleRunner()), seeded.locations, seeded.pluginRoot);
    } finally {
      await chmod(movedPackage, 0o755);
    }

    // assert
    assert.deepStrictEqual(await sortedEntries(seeded.pluginRoot), [
      "package-lock.json",
      "package.json",
    ]);
    assert.strictEqual(await readFile(path.join(movedPackage, "index.js"), "utf8"), MODULE_TEXT);
  });

  test("D-PL9-22: rejects and keeps node_modules whole when it cannot be moved out", async (t) => {
    // arrange
    const seeded = await seedInstalledPlugin(t);
    await chmod(seeded.pluginRoot, 0o555);

    // act
    const removal = removeInstalledPackages(
      opsWith(idleRunner()),
      seeded.locations,
      seeded.pluginRoot,
    );
    try {
      await assert.rejects(removal, { code: "EACCES" });
    } finally {
      await chmod(seeded.pluginRoot, 0o755);
    }

    // assert
    assert.deepStrictEqual(await sortedEntries(path.join(seeded.pluginRoot, "node_modules")), [
      MARKER,
      "pkd-dep",
    ]);
    assert.deepStrictEqual(await readdir(stagingDir(seeded)), []);
  });
});
