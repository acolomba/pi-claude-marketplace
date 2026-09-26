// tests/live-uat/workflow-storage-canary.mjs
//
// Standalone operator-run UAT driver: an engineer invokes it from the command
// line and no module ever imports it, so being unreachable from the import
// graph is its intended shape, not a defect.
// fallow-ignore-file unused-file -- standalone operator-run UAT driver: an engineer invokes it from the command line and no module ever imports it, so being unreachable from the import graph is its intended shape, not a defect.
//
// WSTOR-01 -- measure that the envelopes this extension writes are the
// envelopes the host workflow engine reads. The offline suites pin the bytes
// the bridge writes against a layout read out of the engine's source; this
// driver installs a workflow-bearing plugin through the extension's own
// `/claude:plugin` handler into a scratch home, then reads it back through the
// ENGINE's own storage layer and parser, resolved out of a scratch install
// named by `PI_WORKFLOW_ENGINE_ROOT`:
//
//   mkdir -p /var/tmp/wf-engine tmp/pi-uat/wf-store
//   npm install --prefix /var/tmp/wf-engine @quintinshaw/pi-dynamic-workflows@3.13.0
//   PI_CODING_AGENT_DIR=$(pwd)/tmp/pi-uat/wf-store \
//   PI_WORKFLOW_ENGINE_ROOT=/var/tmp/wf-engine/node_modules \
//     node tests/live-uat/workflow-storage-canary.mjs
//   rm -rf /var/tmp/wf-engine tmp/pi-uat/wf-store
//
// Both sides of the contract are driven for real: the bridge derives the
// engine's storage root from `os.homedir()`, so `HOME` is pointed inside the
// sandbox before either side is imported, and the engine derives the same
// root the same way. A layout the engine moved would show up here as a
// listing that comes back empty, which is exactly the failure the offline
// suites cannot see (the engine is deliberately in no dependency manifest --
// NFR-5, D-98-10).
//
// It needs no provider credentials and starts no subagent: nothing is RUN,
// only listed, loaded and parsed.
//
// Exit contract, matching its siblings: an unmet precondition or an unobserved
// assertion exits NON-ZERO with a human-readable reason, so a verifier records
// `human_needed` rather than a silent pass. Never skip-and-pass.

import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { CanaryExit, createEngineScratch } from "./engine-scratch.mjs";

/** Negative control: flip the byte-identity expectation and nothing else. */
const INVERT = process.argv.includes("--invert");

const { pass, liveEngineRequired, resolveEngine, assertSandboxContainment } = createEngineScratch(
  "wf-storage-canary",
  "Run: PI_CODING_AGENT_DIR=$(pwd)/tmp/pi-uat/wf-store PI_WORKFLOW_ENGINE_ROOT=... node tests/live-uat/workflow-storage-canary.mjs",
);

// ---------------------------------------------------------------------------
// Fixture: one plugin, four scripts -- two the engine loads, two it refuses
// ---------------------------------------------------------------------------

const PLUGIN = "acme";
const MARKETPLACE = "mkt";

/**
 * Each script's expected fate, read back through the engine's OWN parser so
 * the install-time warning the bridge printed and the refusal the engine
 * raises are compared check for check. `name` is the command the bridge
 * generates; `parse` is what `parseWorkflowScript` says about the bytes.
 */
const SCRIPTS = [
  {
    file: "audit.workflow.js",
    name: `${PLUGIN}:audit`,
    parse: { ok: true, metaName: "audit" },
    source:
      "export const meta = {\n" +
      "  name: 'audit',\n" +
      "  description: 'Audit every route',\n" +
      "  phases: [{ title: 'Scan' }],\n" +
      "}\n\n" +
      "const found = await agent('List files')\n" +
      "return await pipeline(found.files, f => agent(`Audit ${f}`, { label: f }))\n",
  },
  {
    // A `meta.name` repeating the plugin prefix: the bridge elides it, the
    // envelope's `name` is the elided form, and the script still declares the
    // full one -- the engine registers from the envelope and parses the script.
    file: "release.js",
    name: `${PLUGIN}:release`,
    parse: { ok: true, metaName: "acme-release" },
    source: "export const meta = { name: 'acme-release', description: 'ship it' }\nreturn 1\n",
  },
  {
    // No description: installs, the bridge warns about check 9, the engine
    // refuses at first run with the same check.
    file: "nodesc.js",
    name: `${PLUGIN}:nodesc`,
    parse: { ok: false, message: "meta.description must be a non-empty string" },
    source: "export const meta = { name: 'nodesc' }\nreturn await agent('x')\n",
  },
  {
    // A statement before the export: installs, warned about check 3, refused
    // at check 3.
    file: "late.js",
    name: `${PLUGIN}:late`,
    parse: {
      ok: false,
      message:
        "`export const meta = { name, description, phases }` must be the first statement in the script",
    },
    source: "const n = 1\nexport const meta = { name: 'late', description: 'd' }\nreturn n\n",
  },
];

async function buildMarketplace(root) {
  const plugin = path.join(root, "plugins", PLUGIN);
  await mkdir(path.join(root, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(plugin, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(plugin, "workflows"), { recursive: true });
  await writeFile(
    path.join(root, ".claude-plugin", "marketplace.json"),
    JSON.stringify(
      {
        name: MARKETPLACE,
        owner: { name: "uat" },
        plugins: [{ name: PLUGIN, source: `./plugins/${PLUGIN}`, description: "storage canary" }],
      },
      null,
      2,
    ),
  );
  await writeFile(
    path.join(plugin, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: PLUGIN, version: "1.0.0" }),
  );
  for (const script of SCRIPTS) {
    await writeFile(path.join(plugin, "workflows", script.file), script.source);
  }
  return plugin;
}

// ---------------------------------------------------------------------------
// Extension drive
// ---------------------------------------------------------------------------

/**
 * Load the real extension in-process, as the manifest-absence canary does, and
 * return a `run(argline)` that invokes the real `/claude:plugin` handler. The
 * host reports the engine's `workflow_control` tool so the rows carry no
 * `requires pi-dynamic-workflows` marker; the marker is not what this driver
 * measures, and the envelope bytes are the same either way.
 */
async function loadExtension(projectDir) {
  const entry = path.resolve(process.cwd(), "extensions", "pi-claude-marketplace", "index.ts");
  const extension = (await import(pathToFileURL(entry).href)).default;
  const commands = new Map();
  const pi = {
    registerCommand: (name, command) => commands.set(name, command),
    registerTool: () => {},
    on: () => {},
    getAllTools: () => [{ name: "workflow" }, { name: "workflow_control" }],
  };
  let sink = [];
  const ctx = {
    cwd: projectDir,
    ui: {
      notify: (message) => sink.push(String(message)),
      addAutocompleteProvider: () => {},
    },
  };
  await extension(pi);
  const command = commands.get("claude:plugin");
  if (command === undefined) {
    liveEngineRequired("claude:plugin command was not registered by the extension.");
  }
  return async function run(argline) {
    sink = [];
    await command.handler(argline, ctx);
    return sink.join("\n");
  };
}

// ---------------------------------------------------------------------------
// The measurement, once per scope
// ---------------------------------------------------------------------------

async function measureScope(scope, { run, engine, pluginDir, projectDir, version }) {
  const label = `[${scope}]`;
  await run(`marketplace add ${path.dirname(path.dirname(pluginDir))} --scope ${scope}`);
  const installed = await run(`install ${PLUGIN}@${MARKETPLACE} --scope ${scope}`);
  assert.match(installed, /\(installed\)/, `${label} the plugin did not install:\n${installed}`);

  try {
    // W1 -- the engine's own listing sees every admitted script, under the
    // generated name, in the tier the scope maps to. `list()` walks the
    // project tier, the deprecated in-repo tier and the user tier and reports
    // which one supplied each row, so the tier is asserted rather than
    // inferred from a path.
    const storage = engine.createWorkflowStorage(projectDir);
    const rows = storage.list();
    const expectedSource = scope === "user" ? "user" : "project";
    assert.deepEqual(
      rows.map((row) => [row.name, row.source]).sort(),
      SCRIPTS.map((script) => [script.name, expectedSource]).sort(),
      `${label} W1: the engine's listing does not match the installed set at engine ${version}.`,
    );
    pass(
      `${label} W1: the engine lists all ${SCRIPTS.length} envelopes in its ${expectedSource} tier (engine ${version})`,
    );

    // W2 -- `load(name)` round-trips each envelope, and the script bytes are
    // the plugin's source bytes, unchanged. This is the verbatim promise the
    // bridge makes measured on the engine's side of the contract.
    for (const script of SCRIPTS) {
      const loaded = storage.load(script.name);
      assert.ok(
        loaded !== null,
        `${label} W2: load(${script.name}) returned null at engine ${version}.`,
      );
      const original = await readFile(path.join(pluginDir, "workflows", script.file), "utf8");
      assert.equal(
        loaded.script === original,
        !INVERT,
        `${label} W2: the script bytes the engine loads for ${script.name} are not the plugin's source bytes at engine ${version}.`,
      );
    }
    pass(
      `${label} W2: load() returns every envelope with byte-identical script source (engine ${version})`,
    );

    // W3 -- the engine's parser reaches the verdict the bridge warned about
    // at install time, for the two scripts it refuses, and loads the two it
    // admits. This is the admit-versus-run divergence measured rather than
    // read: the install printed a warning naming a check, and this is the
    // engine naming the same check.
    for (const script of SCRIPTS) {
      const loaded = storage.load(script.name);
      let outcome;
      try {
        const parsed = engine.parseWorkflowScript(loaded.script);
        outcome = { ok: true, metaName: parsed.meta.name };
      } catch (err) {
        outcome = { ok: false, message: String(err?.message ?? err) };
      }
      assert.deepEqual(
        outcome,
        script.parse,
        `${label} W3: the engine's verdict on ${script.file} differs from the expected one at engine ${version}.`,
      );
    }
    pass(
      `${label} W3: the engine's parser admits 2 scripts and refuses 2 at the checks the install warned about (engine ${version})`,
    );

    // W4 -- the two warned scripts were warned about at install time, naming
    // the check the engine then refuses at. Read off the install output rather
    // than assumed, so the pairing with W3 is a measurement on both sides.
    assert.match(
      installed,
      /"nodesc\.js".*check 9/,
      `${label} W4: no install-time check-9 warning for nodesc.js:\n${installed}`,
    );
    assert.match(
      installed,
      /"late\.js".*check 3/,
      `${label} W4: no install-time check-3 warning for late.js:\n${installed}`,
    );
    pass(
      `${label} W4: the install named check 9 and check 3 for the scripts the engine refuses at them (engine ${version})`,
    );
  } finally {
    await run(`uninstall ${PLUGIN}@${MARKETPLACE} --scope ${scope}`);
    await run(`marketplace remove ${MARKETPLACE} --scope ${scope}`);
  }

  // W5 -- after uninstall the engine sees nothing: the removal reaches the
  // engine's tier, and the name the bridge recorded is the name it removed.
  const after = engine.createWorkflowStorage(projectDir).list();
  assert.deepEqual(
    after.map((row) => row.name),
    [],
    `${label} W5: the engine still lists envelopes after uninstall at engine ${version}.`,
  );
  pass(`${label} W5: uninstall leaves the engine's listing empty (engine ${version})`);
}

async function main() {
  const { entry, version } = await resolveEngine();
  const sandboxRoot = assertSandboxContainment(
    "Refusing to point HOME and the install at a directory outside the disposable sandbox.",
  );

  console.log(`[wf-storage-canary] engine ${version}`);

  // Everything lives under one fresh child of the sandbox: HOME (the engine's
  // storage root hangs off it), the agent-state directory, the project the
  // project-scope install keys on, and the fixture marketplace. HOME is
  // rewritten BEFORE either side is imported, because both derive the storage
  // root from `os.homedir()` at call time and the extension reads the agent
  // directory as it loads.
  const root = path.join(sandboxRoot, `wf-storage-canary-${process.pid}`);
  const home = path.join(root, "home");
  const agentDir = path.join(root, "agent");
  const projectDir = path.join(root, "project");
  await mkdir(home, { recursive: true });
  await mkdir(agentDir, { recursive: true });
  await mkdir(projectDir, { recursive: true });
  process.env.HOME = home;
  process.env.PI_CODING_AGENT_DIR = agentDir;

  try {
    const pluginDir = await buildMarketplace(path.join(root, "mkt"));
    const engine = await import(pathToFileURL(entry).href);
    const run = await loadExtension(projectDir);

    // W0 -- the precondition that makes W1 a measurement of the LAYOUT: both
    // sides must derive the same saved directories from the same home. If they
    // do not, W1's empty listing would be a home mismatch, not the engine
    // moving its storage.
    const { locationsFor } = await import(
      pathToFileURL(
        path.resolve(
          process.cwd(),
          "extensions",
          "pi-claude-marketplace",
          "persistence",
          "locations.ts",
        ),
      ).href
    );
    assert.equal(
      locationsFor("user", projectDir).workflowsSavedDir,
      engine.workflowUserSavedDir(),
      `W0: the bridge's user saved directory is not the engine's at engine ${version}.`,
    );
    assert.equal(
      locationsFor("project", projectDir).workflowsSavedDir,
      engine.workflowProjectPaths(projectDir).savedDir,
      `W0: the bridge's project saved directory is not the engine's at engine ${version}.`,
    );
    pass(
      `W0: the bridge and the engine derive the same saved directories for both scopes (engine ${version})`,
    );

    for (const scope of ["user", "project"]) {
      await measureScope(scope, { run, engine, pluginDir, projectDir, version });
    }
  } finally {
    await rm(root, { recursive: true, force: true }).catch((err) => {
      console.error(
        `[wf-storage-canary] cleanup failed for ${root}: ${String(err?.message ?? err)}`,
      );
    });
  }
}

try {
  await main();
  console.log("[wf-storage-canary] all assertions proven; exit 0");
} catch (err) {
  if (!(err instanceof CanaryExit)) {
    console.error(
      `\n[wf-storage-canary] FAIL: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  process.exitCode = 1;
}
