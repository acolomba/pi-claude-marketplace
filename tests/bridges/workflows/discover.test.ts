import assert from "node:assert/strict";
import fs, { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { discoverPluginWorkflows } from "../../../extensions/pi-claude-marketplace/bridges/workflows/discover.ts";
import { WORKFLOW_SCRIPT_MAX_BYTES } from "../../../extensions/pi-claude-marketplace/domain/workflow-script.ts";
import {
  PathContainmentError,
  SymlinkRefusedError,
} from "../../../extensions/pi-claude-marketplace/shared/path-safety.ts";

import type {
  DiscoveredWorkflow,
  DiscoverPluginWorkflowsResult,
  WorkflowDiscoveryTarget,
} from "../../../extensions/pi-claude-marketplace/bridges/workflows/types.ts";
import type { ResolvedPluginInstallable } from "../../../extensions/pi-claude-marketplace/domain/resolver-types.ts";

const NAMED_GREET = 'export const meta = { name: "greet", description: "greets" };\n';
const NAMED_SHOUT = 'export const meta = { name: "shout", description: "shouts" };\n';
const NAMED_WAVE = 'export const meta = { name: "wave", description: "waves" };\n';
const NAMELESS = 'export const meta = { description: "loud" };\n';
const NONLITERAL_NAME =
  'const other = "computed";\nexport const meta = { name: other, description: "d" };\n';
const NO_META = "export function help() {\n  return 1;\n}\n";
const NONDETERMINISTIC =
  'export const meta = { name: "roll", description: "rolls" };\nexport function run() {\n  return Math.random();\n}\n';
// A readable literal name, so the verdict is `named` -- but a statement stands
// before the `meta` export, so the engine stops at its check 3.
const GATED_NAMED =
  'const helper = 1;\nexport const meta = { name: "greet", description: "greets" };\n';
// A substituted template name: unreadable, so the script is skipped before any
// gate is read off it.
const TEMPLATE_NAME = 'export const meta = { name: `greet${1}`, description: "d" };\n';
const CHECK_3_REASON =
  "the engine refuses at its check 3 -- `export const meta = ...` must be the first statement in the script";
const NO_LITERAL_NAME_REASON = (fileName: string): string =>
  `${fileName} declares no string-literal \`meta.name\`, so there is no command to install`;

async function createPluginRoot(t: TestContext, prefix: string): Promise<string> {
  const pluginRoot = await mkdtemp(path.join(tmpdir(), prefix));

  t.after(() => rm(pluginRoot, { recursive: true, force: true, maxRetries: 3 }));
  return pluginRoot;
}

function resolvedPlugin(
  pluginRoot: string,
  workflows: readonly string[],
): ResolvedPluginInstallable {
  return {
    installable: true,
    state: "installable",
    name: "acme",
    pluginRoot,
    supported: ["workflows"],
    unsupported: [],
    notes: [],
    componentPaths: { skills: [], commands: [], agents: [], workflows: [...workflows] },
    mcpServers: {},
    defaultEnabled: true,
  };
}

test("returns no workflows when the plugin declares no workflows paths", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "workflow-discover-empty-");
  const resolved = resolvedPlugin(pluginRoot, []);

  // act
  const discovery = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "install",
  });

  // assert
  assert.deepStrictEqual(discovery, { discovered: [], warnings: [] });
});

test("returns no workflows when a declared workflows directory is absent", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "workflow-discover-missing-");
  const resolved = resolvedPlugin(pluginRoot, ["workflows"]);

  // act
  const discovery = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "install",
  });

  // assert
  assert.deepStrictEqual(discovery, { discovered: [], warnings: [] });
});

test("returns no workflows when a declared workflows path is a file without the script suffix", async (t) => {
  // arrange -- Claude Code loads a declared FILE only when its name ends in
  // `.js`; a bare `workflows` file is neither a directory to scan nor a script.
  const pluginRoot = await createPluginRoot(t, "workflow-discover-notdir-");
  await writeFile(path.join(pluginRoot, "workflows"), NAMED_GREET);
  const resolved = resolvedPlugin(pluginRoot, ["workflows"]);

  // act
  const discovery = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "install",
  });

  // assert
  assert.deepStrictEqual(discovery, { discovered: [], warnings: [] });
});

test("discovers the one script a declared workflows path names directly", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "workflow-discover-file-path-");
  const customDir = path.join(pluginRoot, "custom");
  const scriptFile = path.join(customDir, "greet.workflow.js");
  await mkdir(customDir);
  await writeFile(scriptFile, NAMED_GREET);
  // A sibling in the same directory is NOT discovered: the declared entry names
  // one file, not its parent directory.
  await writeFile(path.join(customDir, "shout.js"), NAMED_SHOUT);
  const resolved = resolvedPlugin(pluginRoot, ["custom/greet.workflow.js"]);
  const expectedRecords: DiscoveredWorkflow[] = [
    {
      verdict: {
        outcome: "named",
        fileName: "greet.workflow.js",
        metaName: "greet",
        generatedName: "acme:greet",
        description: "greets",
      },
      scriptFile,
      source: NAMED_GREET,
    },
  ];

  // act
  const discovery = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "install",
  });

  // assert
  assert.deepStrictEqual(discovery.discovered, expectedRecords);
  assert.deepStrictEqual(discovery.warnings, []);
});

test("judges a script declared by path exactly as one found in a directory", async (t) => {
  // arrange -- the declared file is a helper module with no `meta`, so it earns
  // the same skip line, naming its parent directory, that the directory arm
  // composes.
  const pluginRoot = await createPluginRoot(t, "workflow-discover-file-path-skip-");
  const customDir = path.join(pluginRoot, "custom");
  await mkdir(customDir);
  await writeFile(path.join(customDir, "helper.js"), NO_META);
  const resolved = resolvedPlugin(pluginRoot, ["custom/helper.js"]);

  // act
  const discovery = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "install",
  });

  // assert
  assert.deepStrictEqual(discovery.warnings, [
    `workflow script "helper.js" in "${customDir}" was not installed: helper.js declares no \`meta\`, so there is nothing to install`,
  ]);
  assert.deepStrictEqual(
    discovery.discovered.map((record) => record.verdict.outcome),
    ["skipped"],
  );
});

test("discovers a script once when it is declared by path and also sits in a declared directory", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "workflow-discover-file-path-dedup-");
  const workflowsDir = path.join(pluginRoot, "workflows");
  await mkdir(workflowsDir);
  await writeFile(path.join(workflowsDir, "greet.js"), NAMED_GREET);
  const resolved = resolvedPlugin(pluginRoot, ["workflows/greet.js", "workflows"]);

  // act
  const discovery = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "install",
  });

  // assert
  assert.deepStrictEqual(
    discovery.discovered.map(
      (record) => record.verdict.outcome === "named" && record.verdict.generatedName,
    ),
    ["acme:greet"],
  );
  assert.deepStrictEqual(discovery.warnings, []);
});

test("refuses a declared workflows path that is a symlink to a script, as a defect of the manifest", async (t) => {
  // arrange -- the containment check that guards every declared path refuses
  // a symlink segment before the file arm classifies it, so a linked script
  // is the same loud manifest defect a linked directory is (NFR-10), not a
  // silent per-file skip.
  const pluginRoot = await createPluginRoot(t, "workflow-discover-file-path-symlink-");
  await writeFile(path.join(pluginRoot, "real.js"), NAMED_GREET);
  await symlink(path.join(pluginRoot, "real.js"), path.join(pluginRoot, "link.js"));
  const resolved = resolvedPlugin(pluginRoot, ["link.js"]);

  // act & assert
  await assert.rejects(
    discoverPluginWorkflows({ pluginName: "acme", resolved, tense: "install" }),
    SymlinkRefusedError,
  );
});

test("propagates a stat failure on a declared path that is not an absence", async (t) => {
  // arrange -- the containment check `lstat`s the declared path first and lets
  // only ENOENT through, so a `stat` that fails any other way is a read the
  // walk cannot trust, and it is injected rather than staged on disk.
  const pluginRoot = await createPluginRoot(t, "workflow-discover-file-path-eio-");
  await writeFile(path.join(pluginRoot, "greet.js"), NAMED_GREET);
  const statError = Object.assign(new Error("input/output error"), { code: "EIO" });
  t.mock.method(fs, "stat", (): Promise<never> => Promise.reject(statError));
  const resolved = resolvedPlugin(pluginRoot, ["greet.js"]);

  // act & assert
  await assert.rejects(
    discoverPluginWorkflows({ pluginName: "acme", resolved, tense: "install" }),
    (error: unknown) => {
      assert.strictEqual((error as NodeJS.ErrnoException).code, "EIO");
      return true;
    },
  );
});

test("rejects a declared workflows directory the process cannot read", async (t) => {
  // arrange
  const pluginRoot = await mkdtemp(path.join(tmpdir(), "workflow-discover-unreadable-dir-"));
  const workflowsDir = path.join(pluginRoot, "workflows");

  // The restoring chmod is registered before the mutating one and shares the
  // hook that removes the tree, because these hooks run in registration order:
  // a removal registered earlier would race the still-unreadable directory.
  t.after(async () => {
    await chmod(workflowsDir, 0o755).catch(() => undefined);
    await rm(pluginRoot, { recursive: true, force: true, maxRetries: 3 });
  });
  await mkdir(workflowsDir);
  await writeFile(path.join(workflowsDir, "greet.js"), NAMED_GREET);
  await chmod(workflowsDir, 0o000);

  const resolved = resolvedPlugin(pluginRoot, ["workflows"]);

  // act & assert
  await assert.rejects(
    () =>
      discoverPluginWorkflows({
        pluginName: "acme",
        resolved,
        tense: "install",
      }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.strictEqual((error as NodeJS.ErrnoException).code, "EACCES");
      assert.strictEqual((error as NodeJS.ErrnoException).syscall, "scandir");
      return true;
    },
  );
});

test("records a well-formed script with its declared name, description and verbatim bytes", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "workflow-discover-named-");
  const workflowsDir = path.join(pluginRoot, "workflows");
  const scriptFile = path.join(workflowsDir, "greet.js");
  await mkdir(workflowsDir);
  await writeFile(scriptFile, NAMED_GREET);
  const resolved = resolvedPlugin(pluginRoot, ["workflows"]);
  const expectedDiscovery: DiscoverPluginWorkflowsResult = {
    discovered: [
      {
        verdict: {
          outcome: "named",
          fileName: "greet.js",
          metaName: "greet",
          generatedName: "acme:greet",
          description: "greets",
        },
        scriptFile,
        source: NAMED_GREET,
      },
    ],
    warnings: [],
  };

  // act
  const discovery = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "install",
  });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
});

test("scans a workflows directory flatly and never descends into a subdirectory", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "workflow-discover-flat-");
  const workflowsDir = path.join(pluginRoot, "workflows");
  const nestedDir = path.join(workflowsDir, "nested");
  const topLevelScript = path.join(workflowsDir, "greet.js");
  await mkdir(nestedDir, { recursive: true });
  await writeFile(path.join(nestedDir, "shout.js"), NAMED_SHOUT);
  await writeFile(topLevelScript, NAMED_GREET);
  const resolved = resolvedPlugin(pluginRoot, ["workflows"]);

  // act
  const discovery = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "install",
  });

  // assert
  assert.deepStrictEqual(
    discovery.discovered.map((record) => record.scriptFile),
    [topLevelScript],
  );
  assert.deepStrictEqual(discovery.warnings, []);
});

test("silently excludes dotfiles, directories and unadmitted suffixes", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "workflow-discover-filters-");
  const workflowsDir = path.join(pluginRoot, "workflows");
  const admissibleScript = path.join(workflowsDir, "greet.js");
  await mkdir(path.join(workflowsDir, "bundle.js"), { recursive: true });
  await writeFile(path.join(workflowsDir, ".hidden.js"), NAMED_SHOUT);
  await writeFile(path.join(workflowsDir, "notes.txt"), NAMED_SHOUT);
  await writeFile(admissibleScript, NAMED_GREET);
  const resolved = resolvedPlugin(pluginRoot, ["workflows"]);

  // act
  const discovery = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "install",
  });

  // assert
  assert.deepStrictEqual(
    discovery.discovered.map((record) => record.scriptFile),
    [admissibleScript],
  );
  assert.deepStrictEqual(discovery.warnings, []);
});

for (const fileName of ["Loud.JS", "loud.mjs", "loud.cjs"]) {
  test(`ignores ${fileName}, a suffix Claude Code's loader does not admit`, async (t) => {
    // arrange -- the loader's test is an exact `endsWith(".js")`, so a file
    // that installed here under any other suffix would be a command the plugin
    // does not have upstream.
    const pluginRoot = await createPluginRoot(t, "workflow-discover-suffix-");
    const workflowsDir = path.join(pluginRoot, "workflows");
    await mkdir(workflowsDir);
    await writeFile(path.join(workflowsDir, fileName), NAMED_GREET);
    const resolved = resolvedPlugin(pluginRoot, ["workflows"]);

    // act
    const discovery = await discoverPluginWorkflows({
      pluginName: "acme",
      resolved,
      tense: "install",
    });

    // assert
    assert.deepStrictEqual(discovery, { discovered: [], warnings: [] });
  });
}

test("skips a script above the byte cap Claude Code's loader imposes, without reading it", async (t) => {
  // arrange -- one byte over the bound, and well-formed, so the only reason
  // to skip it is its size.
  const pluginRoot = await createPluginRoot(t, "workflow-discover-oversize-");
  const workflowsDir = path.join(pluginRoot, "workflows");
  await mkdir(workflowsDir);
  const padding = "/".repeat(WORKFLOW_SCRIPT_MAX_BYTES + 1 - NAMED_GREET.length);
  await writeFile(path.join(workflowsDir, "big.js"), `${NAMED_GREET}${padding}`);
  await writeFile(path.join(workflowsDir, "greet.js"), NAMED_GREET);
  const resolved = resolvedPlugin(pluginRoot, ["workflows"]);

  // act
  const discovery = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "install",
  });

  // assert -- the oversize file is neither read nor recorded; its sibling is.
  assert.deepStrictEqual(discovery.warnings, [
    `workflow script "big.js" in "${workflowsDir}" was not installed: the file is ${(WORKFLOW_SCRIPT_MAX_BYTES + 1).toString()} bytes and Claude Code loads a plugin workflow script only up to ${WORKFLOW_SCRIPT_MAX_BYTES.toString()} bytes`,
  ]);
  assert.deepStrictEqual(
    discovery.discovered.map((record) => record.verdict.fileName),
    ["greet.js"],
  );
});

test("admits a script exactly at the byte cap", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "workflow-discover-at-cap-");
  const workflowsDir = path.join(pluginRoot, "workflows");
  await mkdir(workflowsDir);
  const padding = "/".repeat(WORKFLOW_SCRIPT_MAX_BYTES - NAMED_GREET.length);
  await writeFile(path.join(workflowsDir, "big.js"), `${NAMED_GREET}${padding}`);
  const resolved = resolvedPlugin(pluginRoot, ["workflows"]);

  // act
  const discovery = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "install",
  });

  // assert
  assert.deepStrictEqual(discovery.warnings, []);
  assert.deepStrictEqual(
    discovery.discovered.map((record) => record.verdict.outcome),
    ["named"],
  );
});

test("states an oversize script in the preview tense", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "workflow-discover-oversize-preview-");
  const workflowsDir = path.join(pluginRoot, "workflows");
  await mkdir(workflowsDir);
  await writeFile(path.join(workflowsDir, "big.js"), "/".repeat(WORKFLOW_SCRIPT_MAX_BYTES + 1));
  const resolved = resolvedPlugin(pluginRoot, ["workflows"]);

  // act
  const discovery = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "preview",
  });

  // assert
  assert.deepStrictEqual(discovery.warnings, [
    `workflow script "big.js" in "${workflowsDir}" will not be installed: the file is ${(WORKFLOW_SCRIPT_MAX_BYTES + 1).toString()} bytes and Claude Code loads a plugin workflow script only up to ${WORKFLOW_SCRIPT_MAX_BYTES.toString()} bytes`,
  ]);
});

// What this case pins is the refusal, not which layer performs it. Discovery
// refuses a symlinked entry twice over -- the `Dirent` filter and the `lstat`
// under it -- so neutralizing either one alone leaves this green, and only
// removing both turns it red. Read that as the two layers being redundant by
// design, not as either one being unreachable.
test("refuses a symlinked script without opening the file it points at", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "workflow-discover-symlink-");
  const outsideDir = await createPluginRoot(t, "workflow-discover-outside-");
  const outsideScript = path.join(outsideDir, "secret.js");
  const workflowsDir = path.join(pluginRoot, "workflows");
  const realScript = path.join(workflowsDir, "greet.js");
  await writeFile(
    outsideScript,
    'export const meta = { name: "secret", description: "distinctive-outside-body" };\n',
  );
  await mkdir(workflowsDir);
  await writeFile(realScript, NAMED_GREET);
  await symlink(outsideScript, path.join(workflowsDir, "linked.js"), "file");
  const resolved = resolvedPlugin(pluginRoot, ["workflows"]);

  // act
  const discovery = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "install",
  });

  // assert
  assert.deepStrictEqual(
    discovery.discovered.map((record) => record.scriptFile),
    [realScript],
  );
  assert.deepStrictEqual(discovery.warnings, []);
  assert.strictEqual(JSON.stringify(discovery).includes("distinctive-outside-body"), false);
});

test("reports an entry whose lstat fails and still records its readable sibling", async (t) => {
  // arrange
  const pluginRoot = await mkdtemp(path.join(tmpdir(), "workflow-discover-unstattable-"));
  const lockedDir = path.join(pluginRoot, "locked");
  const lockedScript = path.join(lockedDir, "hidden.js");
  const openDir = path.join(pluginRoot, "workflows");
  const openScript = path.join(openDir, "greet.js");

  // Read-but-not-search: `readdir` reports the entry and the per-entry `lstat`
  // is what fails. The restoring chmod shares the removal hook so the tree is
  // searchable again before anything under it is unlinked.
  t.after(async () => {
    await chmod(lockedDir, 0o755).catch(() => undefined);
    await rm(pluginRoot, { recursive: true, force: true, maxRetries: 3 });
  });
  await mkdir(lockedDir);
  await writeFile(lockedScript, NAMED_SHOUT);
  await mkdir(openDir);
  await writeFile(openScript, NAMED_GREET);
  await chmod(lockedDir, 0o444);

  const resolved = resolvedPlugin(pluginRoot, ["locked", "workflows"]);

  // act
  const discovery = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "install",
  });

  // assert
  // WR-09: the inspection site says "inspected", not "read" -- the `lstat`
  // failed before anything was opened.
  assert.deepStrictEqual(discovery.warnings, [
    `workflow script "hidden.js" in "${lockedDir}" could not be inspected and was skipped: EACCES: permission denied, lstat '${lockedScript}'`,
  ]);
  assert.deepStrictEqual(
    discovery.discovered.map((record) => record.scriptFile),
    [openScript],
  );
});

test("reports an unreadable script and still records its readable sibling", async (t) => {
  // arrange
  const pluginRoot = await mkdtemp(path.join(tmpdir(), "workflow-discover-unreadable-file-"));
  const workflowsDir = path.join(pluginRoot, "workflows");
  const unreadableScript = path.join(workflowsDir, "aaa-locked.js");
  const readableScript = path.join(workflowsDir, "greet.js");

  t.after(async () => {
    await chmod(unreadableScript, 0o644).catch(() => undefined);
    await rm(pluginRoot, { recursive: true, force: true, maxRetries: 3 });
  });
  await mkdir(workflowsDir);
  await writeFile(unreadableScript, NAMED_SHOUT);
  await writeFile(readableScript, NAMED_GREET);
  await chmod(unreadableScript, 0o000);

  const resolved = resolvedPlugin(pluginRoot, ["workflows"]);

  // act
  const discovery = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "install",
  });

  // assert
  assert.deepStrictEqual(discovery.warnings, [
    `workflow script "aaa-locked.js" in "${workflowsDir}" could not be read and was skipped: EACCES: permission denied, open '${unreadableScript}'`,
  ]);
  assert.deepStrictEqual(
    discovery.discovered.map((record) => record.scriptFile),
    [readableScript],
  );
});

test("reports a script whose bytes do not survive a UTF-8 round trip", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "workflow-discover-invalid-utf8-");
  const workflowsDir = path.join(pluginRoot, "workflows");
  await mkdir(workflowsDir);
  await writeFile(path.join(workflowsDir, "aaa-broken.js"), Buffer.from([0xff, 0xfe]));
  const readableScript = path.join(workflowsDir, "greet.js");
  await writeFile(readableScript, NAMED_GREET);
  const resolved = resolvedPlugin(pluginRoot, ["workflows"]);

  // act
  const discovery = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "install",
  });

  // assert
  assert.deepStrictEqual(discovery.warnings, [
    `workflow script "aaa-broken.js" in "${workflowsDir}" could not be read and was skipped: the file is not valid UTF-8, so its bytes cannot be copied verbatim`,
  ]);
  assert.deepStrictEqual(
    discovery.discovered.map((record) => record.scriptFile),
    [readableScript],
  );
});

test("warns about a script that declares no metadata and still records the verdict", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "workflow-discover-skipped-");
  const workflowsDir = path.join(pluginRoot, "workflows");
  const helperScript = path.join(workflowsDir, "helper.js");
  await mkdir(workflowsDir);
  await writeFile(helperScript, NO_META);
  const resolved = resolvedPlugin(pluginRoot, ["workflows"]);
  const expectedDiscovery: DiscoverPluginWorkflowsResult = {
    discovered: [
      {
        verdict: {
          outcome: "skipped",
          fileName: "helper.js",
          reason: "helper.js declares no `meta`, so there is nothing to install",
          cause: "no-meta",
        },
        scriptFile: helperScript,
        source: NO_META,
      },
    ],
    warnings: [
      `workflow script "helper.js" in "${workflowsDir}" was not installed: helper.js declares no \`meta\`, so there is nothing to install`,
    ],
  };

  // act
  const discovery = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "install",
  });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
});

/**
 * A file name shaped to look like a whole second warning if it reaches the
 * rendered line unescaped. `notifyDiagnostic` joins these warnings on "\n" and
 * renders them uninspected, so a newline inside one is byte-indistinguishable
 * from the separator between two.
 *
 * The escaped twin is written out independently rather than computed, so the
 * case compares against a literal the production escape did not produce.
 */
const FORGING_FILE_NAME =
  'ok.js\nworkflow script "forged.js" in "workflows" was not installed: nothing\n.js';
const ESCAPED_FILE_NAME =
  'ok.js\\u{a}workflow script "forged.js" in "workflows" was not installed: nothing\\u{a}.js';

test("escapes a newline in the file name and in the directory so neither forges an output line", async (t) => {
  // arrange -- both spans are plugin-controlled: a POSIX file name may carry a
  // newline, and every directory segment below the plugin root is named by the
  // manifest. The verdict `reason` beside them is escaped by the decision
  // layer already, so this case pins the two the bridge itself composes.
  const pluginRoot = await createPluginRoot(t, "workflow-discover-forgery-");
  const workflowsDir = path.join(pluginRoot, "work\nflows");
  const scriptFile = path.join(workflowsDir, FORGING_FILE_NAME);
  await mkdir(workflowsDir);
  await writeFile(scriptFile, NO_META);
  const resolved = resolvedPlugin(pluginRoot, ["work\nflows"]);
  const escapedDir = `${pluginRoot}${path.sep}work\\u{a}flows`;
  const expectedDiscovery: DiscoverPluginWorkflowsResult = {
    discovered: [
      {
        verdict: {
          outcome: "skipped",
          fileName: FORGING_FILE_NAME,
          reason: `${ESCAPED_FILE_NAME} declares no \`meta\`, so there is nothing to install`,
          cause: "no-meta",
        },
        scriptFile,
        source: NO_META,
      },
    ],
    warnings: [
      `workflow script "${ESCAPED_FILE_NAME}" in "${escapedDir}" was not installed: ${ESCAPED_FILE_NAME} declares no \`meta\`, so there is nothing to install`,
    ],
  };

  // act
  const discovery = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "install",
  });

  // assert -- the WHOLE result, so a single warning holding one raw newline
  // fails here rather than being counted as two well-formed lines.
  assert.deepStrictEqual(discovery, expectedDiscovery);
});

test("warns about a refused script and renders the verdict reason unparaphrased", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "workflow-discover-refused-");
  const workflowsDir = path.join(pluginRoot, "workflows");
  const rollScript = path.join(workflowsDir, "roll.js");
  await mkdir(workflowsDir);
  await writeFile(rollScript, NONDETERMINISTIC);
  const resolved = resolvedPlugin(pluginRoot, ["workflows"]);
  const expectedDiscovery: DiscoverPluginWorkflowsResult = {
    discovered: [
      {
        verdict: {
          outcome: "refused",
          fileName: "roll.js",
          reason:
            "roll.js calls `Math.random`, which the workflow engine refuses as nondeterministic",
          cause: "determinism-code",
        },
        scriptFile: rollScript,
        source: NONDETERMINISTIC,
      },
    ],
    warnings: [
      `workflow script "roll.js" in "${workflowsDir}" was refused: roll.js calls \`Math.random\`, which the workflow engine refuses as nondeterministic`,
    ],
  };

  // act
  const discovery = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "install",
  });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
});

test("keeps both scripts when two files generate the same workflow name", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "workflow-discover-collision-");
  const workflowsDir = path.join(pluginRoot, "workflows");
  const firstScript = path.join(workflowsDir, "one.js");
  const secondScript = path.join(workflowsDir, "two.js");
  await mkdir(workflowsDir);
  await writeFile(firstScript, 'export const meta = { name: "same", description: "a" };\n');
  await writeFile(secondScript, 'export const meta = { name: "same", description: "b" };\n');
  const resolved = resolvedPlugin(pluginRoot, ["workflows"]);

  // act
  const discovery = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "install",
  });

  // assert
  assert.deepStrictEqual(
    discovery.discovered.map((record) => ({
      scriptFile: record.scriptFile,
      generatedName: "generatedName" in record.verdict ? record.verdict.generatedName : undefined,
    })),
    [
      { scriptFile: firstScript, generatedName: "acme:same" },
      { scriptFile: secondScript, generatedName: "acme:same" },
    ],
  );
  assert.deepStrictEqual(discovery.warnings, []);
});

test("discovers a script once when two declared spellings resolve to one directory", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "workflow-discover-path-dedup-");
  const workflowsDir = path.join(pluginRoot, "workflows");
  const scriptFile = path.join(workflowsDir, "greet.js");
  await mkdir(workflowsDir);
  await writeFile(scriptFile, NAMED_GREET);
  const resolved = resolvedPlugin(pluginRoot, ["workflows", "./workflows"]);

  // act
  const discovery = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "install",
  });

  // assert
  assert.deepStrictEqual(
    discovery.discovered.map((record) => record.scriptFile),
    [scriptFile],
  );
  assert.deepStrictEqual(discovery.warnings, []);
});

// This case redefines `process.platform`, so it must not overlap another case
// that reads it. Isolation comes from `node:test` running the top-level cases
// of one file in sequence, which is a property of the runner rather than
// anything stated here -- a `concurrency` option would not supply it, because
// that setting governs a case's SUBTESTS and this case has none. Grouping the
// file's cases under a `describe` would end the guarantee.
test("folds case when deduping declared paths on a case-insensitive platform", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "workflow-discover-case-dedup-");
  // Two real directories differing only in case, each holding a script of the
  // same name: on a case-insensitive filesystem these are one directory, and
  // the folded key is what collapses them. Without the fold both scripts are
  // discovered and collide on one generated name.
  const lowerDir = path.join(pluginRoot, "workflows");
  const upperDir = path.join(pluginRoot, "WORKFLOWS");
  const scriptFile = path.join(lowerDir, "greet.js");
  await mkdir(lowerDir);
  await mkdir(upperDir);
  await writeFile(scriptFile, NAMED_GREET);
  await writeFile(path.join(upperDir, "greet.js"), NAMED_GREET);
  const platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform");

  if (platformDescriptor === undefined) {
    throw new Error("process.platform descriptor is unavailable");
  }

  t.after(() => {
    Object.defineProperty(process, "platform", platformDescriptor);
  });
  Object.defineProperty(process, "platform", { ...platformDescriptor, value: "darwin" });

  const resolved = resolvedPlugin(pluginRoot, ["workflows", "WORKFLOWS"]);

  // act
  const discovery = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "install",
  });

  // assert
  assert.deepStrictEqual(
    discovery.discovered.map((record) => record.scriptFile),
    [scriptFile],
  );
  assert.deepStrictEqual(discovery.warnings, []);
});

test("rejects a declared workflows path that climbs out of the plugin root", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "workflow-discover-escape-relative-");
  const target: WorkflowDiscoveryTarget = {
    pluginRoot,
    componentPaths: { workflows: ["../escape"] },
  };

  // act & assert
  await assert.rejects(
    () =>
      discoverPluginWorkflows({
        pluginName: "acme",
        resolved: target,
        tense: "install",
      }),
    (error: unknown) => {
      assert.ok(error instanceof PathContainmentError);
      assert.strictEqual(error.parent, pluginRoot);
      assert.strictEqual(error.child, path.resolve(pluginRoot, "../escape"));
      return true;
    },
  );
});

test("rejects an absolute declared workflows path", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "workflow-discover-escape-absolute-");
  const target: WorkflowDiscoveryTarget = {
    pluginRoot,
    componentPaths: { workflows: ["/etc"] },
  };

  // act & assert
  await assert.rejects(
    () =>
      discoverPluginWorkflows({
        pluginName: "acme",
        resolved: target,
        tense: "install",
      }),
    (error: unknown) => {
      assert.ok(error instanceof PathContainmentError);
      assert.strictEqual(error.parent, pluginRoot);
      assert.strictEqual(error.child, "/etc");
      return true;
    },
  );
});

test("returns records in sorted entry order regardless of write order", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "workflow-discover-order-");
  const workflowsDir = path.join(pluginRoot, "workflows");
  await mkdir(workflowsDir);
  await writeFile(path.join(workflowsDir, "wave.js"), NAMED_WAVE);
  await writeFile(path.join(workflowsDir, "greet.js"), NAMED_GREET);
  await writeFile(path.join(workflowsDir, "shout.js"), NAMED_SHOUT);
  const resolved = resolvedPlugin(pluginRoot, ["workflows"]);

  // act
  const discovery = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "install",
  });

  // assert
  assert.deepStrictEqual(
    discovery.discovered.map((record) => record.scriptFile),
    [
      path.join(workflowsDir, "greet.js"),
      path.join(workflowsDir, "shout.js"),
      path.join(workflowsDir, "wave.js"),
    ],
  );
  assert.deepStrictEqual(discovery.warnings, []);
});

test("skips a script declaring no name and says so, installing its named sibling", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "workflow-discover-no-name-");
  const workflowsDir = path.join(pluginRoot, "workflows");
  await mkdir(workflowsDir);
  await writeFile(path.join(workflowsDir, "aaa-quiet.js"), NAMELESS);
  await writeFile(path.join(workflowsDir, "greet.js"), NAMED_GREET);
  const resolved = resolvedPlugin(pluginRoot, ["workflows"]);

  // act
  const discovery = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "install",
  });

  // assert
  assert.deepStrictEqual(discovery.warnings, [
    `workflow script "aaa-quiet.js" in "${workflowsDir}" was not installed: ${NO_LITERAL_NAME_REASON("aaa-quiet.js")}`,
  ]);
  assert.deepStrictEqual(
    discovery.discovered.map((record) => record.verdict),
    [
      {
        outcome: "skipped",
        fileName: "aaa-quiet.js",
        reason: NO_LITERAL_NAME_REASON("aaa-quiet.js"),
        cause: "no-literal-name",
      },
      {
        outcome: "named",
        fileName: "greet.js",
        metaName: "greet",
        generatedName: "acme:greet",
        description: "greets",
      },
    ],
  );
});

test("skips the same way when the declared name is present but not a literal, reading no gate", async (t) => {
  // arrange -- the script also declares a statement before its `meta` export,
  // which would be a check-3 gate on a named script. Nothing is installed for
  // a skipped one, so no gate is read and the one line names the skip alone.
  const pluginRoot = await createPluginRoot(t, "workflow-discover-nonliteral-");
  const workflowsDir = path.join(pluginRoot, "workflows");
  await mkdir(workflowsDir);
  await writeFile(path.join(workflowsDir, "computed.js"), NONLITERAL_NAME);
  const resolved = resolvedPlugin(pluginRoot, ["workflows"]);

  // act
  const discovery = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "install",
  });

  // assert
  assert.deepStrictEqual(discovery.warnings, [
    `workflow script "computed.js" in "${workflowsDir}" was not installed: ${NO_LITERAL_NAME_REASON("computed.js")}`,
  ]);
  assert.deepStrictEqual(
    discovery.discovered.map((record) => record.verdict),
    [
      {
        outcome: "skipped",
        fileName: "computed.js",
        reason: NO_LITERAL_NAME_REASON("computed.js"),
        cause: "no-literal-name",
      },
    ],
  );
});

test("leaves a script with a readable literal name unwarned", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "workflow-discover-named-unwarned-");
  const workflowsDir = path.join(pluginRoot, "workflows");
  await mkdir(workflowsDir);
  await writeFile(path.join(workflowsDir, "greet.js"), NAMED_GREET);
  const resolved = resolvedPlugin(pluginRoot, ["workflows"]);

  // act
  const discovery = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "install",
  });

  // assert
  assert.deepStrictEqual(discovery.warnings, []);
});

// ---------------------------------------------------------------------------
// WR-09: the preview tense.
//
// One discovery pass serves the staging surface and the read-only `info`
// surface, so every soft-fail phrase is stated in the tense of the caller that
// asked. These cases pin the preview half of the pairing table; the install
// half is pinned by the cases above.
// ---------------------------------------------------------------------------

test("states a skipped script in the preview tense", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "workflow-discover-preview-skipped-");
  const workflowsDir = path.join(pluginRoot, "workflows");
  await mkdir(workflowsDir);
  await writeFile(path.join(workflowsDir, "helper.js"), NO_META);
  const resolved = resolvedPlugin(pluginRoot, ["workflows"]);

  // act
  const discovery = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "preview",
  });

  // assert
  assert.deepStrictEqual(discovery.warnings, [
    `workflow script "helper.js" in "${workflowsDir}" will not be installed: helper.js declares no \`meta\`, so there is nothing to install`,
  ]);
});

test("states a refused script in the preview tense", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "workflow-discover-preview-refused-");
  const workflowsDir = path.join(pluginRoot, "workflows");
  await mkdir(workflowsDir);
  await writeFile(path.join(workflowsDir, "roll.js"), NONDETERMINISTIC);
  const resolved = resolvedPlugin(pluginRoot, ["workflows"]);

  // act
  const discovery = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "preview",
  });

  // assert
  assert.deepStrictEqual(discovery.warnings, [
    `workflow script "roll.js" in "${workflowsDir}" will be refused: roll.js calls \`Math.random\`, which the workflow engine refuses as nondeterministic`,
  ]);
});

test("states a nameless script in the preview tense and keeps its reason", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "workflow-discover-preview-nameless-");
  const workflowsDir = path.join(pluginRoot, "workflows");
  await mkdir(workflowsDir);
  await writeFile(path.join(workflowsDir, "quiet.js"), NAMELESS);
  const resolved = resolvedPlugin(pluginRoot, ["workflows"]);

  // act
  const discovery = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "preview",
  });

  // assert
  assert.deepStrictEqual(discovery.warnings, [
    `workflow script "quiet.js" in "${workflowsDir}" will not be installed: ${NO_LITERAL_NAME_REASON("quiet.js")}`,
  ]);
});

test("states an unreadable script in the preview tense without claiming a skip", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "workflow-discover-preview-read-");
  const workflowsDir = path.join(pluginRoot, "workflows");
  await mkdir(workflowsDir);
  await writeFile(path.join(workflowsDir, "broken.js"), Buffer.from([0xff, 0xfe]));
  const resolved = resolvedPlugin(pluginRoot, ["workflows"]);

  // act
  const discovery = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "preview",
  });

  // assert
  assert.deepStrictEqual(discovery.warnings, [
    `workflow script "broken.js" in "${workflowsDir}" could not be read: the file is not valid UTF-8, so its bytes cannot be copied verbatim`,
  ]);
});

test("states an uninspectable entry in the preview tense as an inspection failure", async (t) => {
  // arrange
  const pluginRoot = await mkdtemp(path.join(tmpdir(), "workflow-discover-preview-inspect-"));
  const workflowsDir = path.join(pluginRoot, "workflows");
  const lockedScript = path.join(workflowsDir, "hidden.js");

  t.after(async () => {
    await chmod(workflowsDir, 0o755).catch(() => undefined);
    await rm(pluginRoot, { recursive: true, force: true, maxRetries: 3 });
  });
  await mkdir(workflowsDir);
  await writeFile(lockedScript, NAMED_SHOUT);
  await chmod(workflowsDir, 0o444);

  const resolved = resolvedPlugin(pluginRoot, ["workflows"]);

  // act
  const discovery = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "preview",
  });

  // assert
  assert.deepStrictEqual(discovery.warnings, [
    `workflow script "hidden.js" in "${workflowsDir}" could not be inspected: EACCES: permission denied, lstat '${lockedScript}'`,
  ]);
});

test("leaves an admitted script unwarned in the preview tense", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "workflow-discover-preview-named-");
  const workflowsDir = path.join(pluginRoot, "workflows");
  await mkdir(workflowsDir);
  await writeFile(path.join(workflowsDir, "greet.js"), NAMED_GREET);
  const resolved = resolvedPlugin(pluginRoot, ["workflows"]);

  // act
  const discovery = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "preview",
  });

  // assert
  assert.deepStrictEqual(discovery.warnings, []);
});

// ---------------------------------------------------------------------------
// WGATE-01: the bridge-side shape of the gate line.
//
// One warned file earns exactly ONE line, in either tense, and a file that
// trips nothing earns none. The count is the assertion: a channel that says the
// same thing about the same file twice is a channel readers learn to skip.
// ---------------------------------------------------------------------------

test("WGATE-01: warns once for a gate-tripping script and leaves its well-formed siblings unwarned", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "workflow-discover-gate-siblings-");
  const workflowsDir = path.join(pluginRoot, "workflows");
  await mkdir(workflowsDir);
  await writeFile(path.join(workflowsDir, "gated.js"), GATED_NAMED);
  await writeFile(path.join(workflowsDir, "shout.js"), NAMED_SHOUT);
  await writeFile(path.join(workflowsDir, "wave.js"), NAMED_WAVE);
  const resolved = resolvedPlugin(pluginRoot, ["workflows"]);

  // act
  const discovery = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "install",
  });

  // assert -- the LENGTH carries WGATE-01's second clause. "no sibling name
  // appears" is also green for an empty array, which would be green for the
  // wrong reason, so the whole array is compared and the two sibling names are
  // then checked against the joined text.
  assert.deepStrictEqual(discovery.warnings, [
    `workflow script "gated.js" in "${workflowsDir}" was installed but the engine will refuse to load it: ${CHECK_3_REASON}`,
  ]);
  assert.strictEqual(discovery.warnings.join("\n").includes("shout.js"), false);
  assert.strictEqual(discovery.warnings.join("\n").includes("wave.js"), false);
  assert.deepStrictEqual(
    discovery.discovered.map((record) => record.verdict),
    [
      {
        outcome: "named",
        fileName: "gated.js",
        metaName: "greet",
        generatedName: "acme:greet",
        description: "greets",
        gate: "meta-not-first-export",
      },
      {
        outcome: "named",
        fileName: "shout.js",
        metaName: "shout",
        generatedName: "acme:shout",
        description: "shouts",
      },
      {
        outcome: "named",
        fileName: "wave.js",
        metaName: "wave",
        generatedName: "acme:wave",
        description: "waves",
      },
    ],
  );
});

test("WGATE-01: states one gate line in both tenses, differing only in the outcome phrase", async (t) => {
  // arrange -- ONE fixture, read twice, so a tense that drifts is a diff
  // between two assertions over the same bytes rather than two independently
  // passing cases.
  const pluginRoot = await createPluginRoot(t, "workflow-discover-gate-tenses-");
  const workflowsDir = path.join(pluginRoot, "workflows");
  await mkdir(workflowsDir);
  await writeFile(path.join(workflowsDir, "gated.js"), GATED_NAMED);
  const resolved = resolvedPlugin(pluginRoot, ["workflows"]);
  const subject = `workflow script "gated.js" in "${workflowsDir}"`;

  // act
  const installed = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "install",
  });
  const previewed = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "preview",
  });

  // assert -- the subject and the reason are shared bindings, so only the
  // outcome phrase may differ between the two expected strings.
  assert.deepStrictEqual(installed.warnings, [
    `${subject} was installed but the engine will refuse to load it: ${CHECK_3_REASON}`,
  ]);
  assert.deepStrictEqual(previewed.warnings, [
    `${subject} would be installed but the engine will refuse to load it: ${CHECK_3_REASON}`,
  ]);
});

test("WGATE-01: names no engine check on a script skipped for a substituted template name", async (t) => {
  // arrange -- the same value would trip the engine's check 8 on a named
  // script, but a skipped script has no command for the engine to refuse, so
  // the one line names the skip and nothing else.
  const pluginRoot = await createPluginRoot(t, "workflow-discover-gate-template-");
  const workflowsDir = path.join(pluginRoot, "workflows");
  const templateScript = path.join(workflowsDir, "greeter.js");
  await mkdir(workflowsDir);
  await writeFile(templateScript, TEMPLATE_NAME);
  const resolved = resolvedPlugin(pluginRoot, ["workflows"]);

  // act
  const discovery = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "install",
  });

  // assert
  assert.deepStrictEqual(discovery.warnings, [
    `workflow script "greeter.js" in "${workflowsDir}" was not installed: ${NO_LITERAL_NAME_REASON("greeter.js")}`,
  ]);
  assert.deepStrictEqual(discovery.discovered, [
    {
      verdict: {
        outcome: "skipped",
        fileName: "greeter.js",
        reason: NO_LITERAL_NAME_REASON("greeter.js"),
        cause: "no-literal-name",
      },
      scriptFile: templateScript,
      source: TEMPLATE_NAME,
    },
  ]);
});

test("WGATE-01: warns once per affected file in scan order across a mixed directory", async (t) => {
  // arrange -- three affected files of three different kinds. An expected array
  // longer than the number of affected files is the doubling this contract
  // exists to forbid.
  const pluginRoot = await createPluginRoot(t, "workflow-discover-gate-mixed-");
  const workflowsDir = path.join(pluginRoot, "workflows");
  await mkdir(workflowsDir);
  await writeFile(path.join(workflowsDir, "roll.js"), NONDETERMINISTIC);
  await writeFile(path.join(workflowsDir, "gated.js"), GATED_NAMED);
  await writeFile(path.join(workflowsDir, "helper.js"), NO_META);
  const resolved = resolvedPlugin(pluginRoot, ["workflows"]);

  // act
  const discovery = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "install",
  });

  // assert -- one line per file, each naming its own file, in the entry order
  // the scan sorts by rather than the write order above.
  assert.deepStrictEqual(discovery.warnings, [
    `workflow script "gated.js" in "${workflowsDir}" was installed but the engine will refuse to load it: ${CHECK_3_REASON}`,
    `workflow script "helper.js" in "${workflowsDir}" was not installed: helper.js declares no \`meta\`, so there is nothing to install`,
    `workflow script "roll.js" in "${workflowsDir}" was refused: roll.js calls \`Math.random\`, which the workflow engine refuses as nondeterministic`,
  ]);
});

test("WGATE-03: returns a frozen warning array and accumulates nothing across two discovery passes", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "workflow-discover-gate-rerun-");
  const workflowsDir = path.join(pluginRoot, "workflows");
  await mkdir(workflowsDir);
  await writeFile(path.join(workflowsDir, "gated.js"), GATED_NAMED);
  await writeFile(path.join(workflowsDir, "helper.js"), NO_META);
  const resolved = resolvedPlugin(pluginRoot, ["workflows"]);

  // act -- the same unchanged directory, twice.
  const first = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "install",
  });
  const second = await discoverPluginWorkflows({
    pluginName: "acme",
    resolved,
    tense: "install",
  });

  // assert -- a fresh array per call. A `seenPaths` set or a warnings array
  // hoisted out of the call would make the second pass shorter or longer than
  // the first; comparing whole values decides both directions at once.
  assert.strictEqual(Object.isFrozen(first.warnings), true);
  assert.strictEqual(Object.isFrozen(first.discovered), true);
  assert.strictEqual(second.warnings.length, first.warnings.length);
  assert.deepStrictEqual(second.warnings, [...first.warnings]);
  assert.deepStrictEqual(second.discovered, [...first.discovered]);
});
