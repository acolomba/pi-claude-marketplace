// tests/live-uat/manifest-absence-canary.mjs
//
// Standalone operator-run UAT driver: an engineer invokes it from the command
// line and no module ever imports it, so being unreachable from the import
// graph is its intended shape, not a defect.
// fallow-ignore-file unused-file -- standalone operator-run UAT driver: an engineer invokes it from the command line and no module ever imports it, so being unreachable from the import graph is its intended shape, not a defect.
//
// Two `duplicates.ignoredClones` entries in `.fallowrc.json` are retained
// against this file and `stop-canary.mjs`. Fallow types `ignoredClones` as
// `string[]`, so the per-clone justification the conventions require cannot
// live in the JSON and lives here instead:
//   - `dup:cc950b18:2` -- the `main().then(exit 0, exit 1)` process epilogue
//     at the foot of both drivers.
//   - `dup:6d8c002d:2` -- the module preamble that resolves `execFileAsync`,
//     `HERE`, `REPO_ROOT` and `EXTENSION_ENTRY`.
// Both are retained for the same reason: each driver must stay independently
// runnable as `node tests/live-uat/<file>.mjs` with nothing imported from a
// sibling. Extracting a shared helper module would create exactly the import
// edge that the standalone-driver shape exists to avoid, and would make the
// two canaries fail together on one bad edit. The duplicated text is 23 lines
// of boilerplate -- a process-exit epilogue and four path constants -- with no
// assertion logic in it, so the copies cannot drift in a way that changes what
// either canary proves. Line numbers are deliberately omitted; run
// `fallow dupes --trace dup:<fingerprint>` with the entries temporarily
// cleared to locate them.
//
// Live runtime UAT for the manifest-independent installed-plugin surface: a
// scripted canary that drives the REAL extension against a REAL on-disk Pi
// sandbox to prove, end to end, the milestone's user-visible claim -- an
// installed plugin stays visible, inspectable and uninstallable after its entry
// disappears from a still-valid marketplace manifest, and a disabled partially
// installed plugin is recognised as disabled by every surface.
//
// Why a live canary and not the unit suite: the unit tests pin each surface's
// byte form against fabricated state. This harness never fabricates state --
// it installs through the extension's own ledger, edits the manifest on disk,
// and reads back whatever the surfaces actually render. A state shape no
// install can produce cannot pass here.
//
// What it asserts autonomously:
//   Flow A -- manifest absence (INV-01..04, INFO-09..11, INFO-12, LIFE-04, LIFE-05)
//     A1. `list` keeps the record and stamps `not in manifest`.
//     A2. A plugin still declared in the same manifest is NOT stamped (the
//         control -- proves the reason tracks the entry, not the read).
//     A3. `info` renders from the installation record instead of `(failed)`,
//         and reconstructs the component inventory.
//     A4. `info --fetch` emits the skip note rather than reaching the network.
//     A5. `update` renders `(skipped) {not in manifest}`.
//     A6. `uninstall` succeeds and removes the staged artifacts from disk.
//   Flow B -- disabled partial (ENBL-05..07)
//     B1. A partially installed plugin disables and every surface says so.
//     B2. `list` renders the disabled partial as disabled, not as installed.
//     B3. `disable` is idempotent on an already-disabled partial.
//
// What it routes to human_needed:
//   The live-`pi` host-integration smoke (section C) needs a configured
//   provider in the sandbox. Where one is absent the harness prints the proven
//   halves and exits NON-ZERO rather than reporting a host load it never
//   observed.
//
// Honesty contract: this harness NEVER fakes a live result. Unmet
// preconditions and unobserved assertions exit NON-ZERO with a human-readable
// reason. It is standalone (NOT part of `npm run check`).
//
// Containment: refuses to run unless PI_CODING_AGENT_DIR points at the
// tmp/pi-uat sandbox, so the install/uninstall churn never touches a
// developer's real Pi state dir.

import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import claudeMarketplaceExtension from "../../extensions/pi-claude-marketplace/index.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { loadState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";

const execFileAsync = promisify(execFile);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../..");
const EXTENSION_ENTRY = path.join(REPO_ROOT, "extensions", "pi-claude-marketplace", "index.ts");

const MARKETPLACE_NAME = "manifest-absence-mkt";
const VANISHING = "vanishing-plugin";
const STAYING = "staying-plugin";
const PARTIAL = "partial-plugin";
const PI_DRIVE_TIMEOUT_MS = 120_000;

// The reason token the absence surfaces stamp. Duplicated here rather than
// imported so the harness pins the user-visible string as an independent
// contract: notify and this canary must agree or the canary fails loud.
const NOT_IN_MANIFEST = "not in manifest";

/**
 * Thrown (not process.exit) by the routing helpers so main()'s `finally`
 * always tears the canary out of the shared sandbox before the process exits
 * non-zero. The top-level handler recognises this tag and exits 1 without
 * re-printing.
 */
class UatExit extends Error {}

function pass(msg) {
  console.log(`[manifest-absence] PASS: ${msg}`);
}

/** Print + throw to route human_needed, never a false pass. Cleanup runs via finally. */
function liveRuntimeRequired(reason, detail) {
  console.error(`\n[manifest-absence] LIVE RUNTIME REQUIRED -- not proven, routing human_needed:`);
  console.error(`  ${reason}`);
  if (detail) {
    console.error(`\n${detail}`);
  }
  throw new UatExit(reason);
}

/** Print + throw on a failed behavioural assertion. This is a real defect, not a precondition miss. */
function fail(id, reason, detail) {
  console.error(`\n[manifest-absence] FAIL ${id}: ${reason}`);
  if (detail) {
    console.error(`\n${detail}`);
  }
  throw new UatExit(`${id}: ${reason}`);
}

// ---------------------------------------------------------------------------
// Preconditions
// ---------------------------------------------------------------------------

async function assertPreconditions() {
  const agentDir = process.env.PI_CODING_AGENT_DIR;
  if (agentDir === undefined || agentDir.trim() === "") {
    liveRuntimeRequired(
      "PI_CODING_AGENT_DIR is unset.",
      "Run: PI_CODING_AGENT_DIR=$(pwd)/tmp/pi-uat/agent node tests/live-uat/manifest-absence-canary.mjs",
    );
  }
  // Refuse to churn installs outside the disposable sandbox.
  if (!agentDir.includes(path.join("tmp", "pi-uat"))) {
    liveRuntimeRequired(
      `PI_CODING_AGENT_DIR (${agentDir}) is not the tmp/pi-uat sandbox.`,
      "Refusing to install the canary outside the disposable sandbox.",
    );
  }
  if (!existsSync(agentDir)) {
    liveRuntimeRequired(`PI_CODING_AGENT_DIR (${agentDir}) does not exist.`);
  }
  pass(`sandbox ${agentDir}`);
  return agentDir;
}

// ---------------------------------------------------------------------------
// Fixture: a path-source marketplace carrying three plugins
// ---------------------------------------------------------------------------

function marketplaceManifest(pluginNames) {
  const all = {
    [VANISHING]: {
      name: VANISHING,
      description: "Five-kind plugin whose manifest entry disappears mid-run.",
      author: { name: "manifest-absence-canary", email: "noreply@example.com" },
      source: `./plugins/${VANISHING}`,
      category: "development",
    },
    [STAYING]: {
      name: STAYING,
      description: "Control plugin that stays declared for the whole run.",
      author: { name: "manifest-absence-canary", email: "noreply@example.com" },
      source: `./plugins/${STAYING}`,
      category: "development",
    },
    [PARTIAL]: {
      name: PARTIAL,
      description: "Carries an unsupported component kind, so it installs partially.",
      author: { name: "manifest-absence-canary", email: "noreply@example.com" },
      source: `./plugins/${PARTIAL}`,
      category: "development",
    },
  };
  return {
    name: MARKETPLACE_NAME,
    description: "Disposable marketplace for the manifest-absence live UAT.",
    owner: { name: "manifest-absence-canary", email: "noreply@example.com" },
    plugins: pluginNames.map((n) => all[n]),
  };
}

async function writeManifest(root, pluginNames) {
  await writeFile(
    path.join(root, ".claude-plugin", "marketplace.json"),
    `${JSON.stringify(marketplaceManifest(pluginNames), null, 2)}\n`,
  );
}

/** The five-kind plugin: skill, command, agent, mcp, hooks. */
async function buildVanishingPlugin(root) {
  const dir = path.join(root, "plugins", VANISHING);
  await mkdir(path.join(dir, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(dir, "skills", "vanish-skill"), { recursive: true });
  await mkdir(path.join(dir, "commands"), { recursive: true });
  await mkdir(path.join(dir, "agents"), { recursive: true });
  await mkdir(path.join(dir, "hooks"), { recursive: true });

  await writeFile(
    path.join(dir, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: VANISHING, version: "1.0.0" }, null, 2),
  );
  await writeFile(
    path.join(dir, "skills", "vanish-skill", "SKILL.md"),
    [
      "---",
      "name: vanish-skill",
      "description: A skill that outlives its manifest entry.",
      "---",
      "",
      "Body.",
      "",
    ].join("\n"),
  );
  await writeFile(
    path.join(dir, "commands", "vanish-command.md"),
    [
      "---",
      "description: A command that outlives its manifest entry.",
      "---",
      "",
      "Prompt body.",
      "",
    ].join("\n"),
  );
  await writeFile(
    path.join(dir, "agents", "vanish-agent.md"),
    [
      "---",
      "name: vanish-agent",
      "description: An agent that outlives its manifest entry.",
      "---",
      "",
      "Agent body.",
      "",
    ].join("\n"),
  );
  await writeFile(
    path.join(dir, ".mcp.json"),
    JSON.stringify({ mcpServers: { "vanish-mcp": { command: "echo", args: ["hi"] } } }, null, 2),
  );
  await writeFile(
    path.join(dir, "hooks", "hooks.json"),
    JSON.stringify(
      { hooks: { PreToolUse: [{ hooks: [{ type: "command", command: "true" }] }] } },
      null,
      2,
    ),
  );
}

/** The control plugin: one skill, stays declared. */
async function buildStayingPlugin(root) {
  const dir = path.join(root, "plugins", STAYING);
  await mkdir(path.join(dir, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(dir, "skills", "stay-skill"), { recursive: true });
  await writeFile(
    path.join(dir, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: STAYING, version: "1.0.0" }, null, 2),
  );
  await writeFile(
    path.join(dir, "skills", "stay-skill", "SKILL.md"),
    ["---", "name: stay-skill", "description: The control skill.", "---", "", "Body.", ""].join(
      "\n",
    ),
  );
}

/**
 * The partial plugin: one supported skill plus a `themes/` directory, which is
 * an UNSUPPORTED_COMPONENT_KIND convention, so the resolver returns
 * `partially-available` and the install persists `installable: false`. That is
 * exactly the record shape the disabled-state repair was about.
 */
async function buildPartialPlugin(root) {
  const dir = path.join(root, "plugins", PARTIAL);
  await mkdir(path.join(dir, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(dir, "skills", "partial-skill"), { recursive: true });
  await mkdir(path.join(dir, "themes"), { recursive: true });
  await writeFile(
    path.join(dir, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: PARTIAL, version: "1.0.0" }, null, 2),
  );
  await writeFile(
    path.join(dir, "skills", "partial-skill", "SKILL.md"),
    ["---", "name: partial-skill", "description: The supported half.", "---", "", "Body.", ""].join(
      "\n",
    ),
  );
  await writeFile(path.join(dir, "themes", "dark.json"), JSON.stringify({ name: "dark" }, null, 2));
}

async function buildMarketplace(root) {
  await mkdir(path.join(root, ".claude-plugin"), { recursive: true });
  await buildVanishingPlugin(root);
  await buildStayingPlugin(root);
  await buildPartialPlugin(root);
  await writeManifest(root, [VANISHING, STAYING, PARTIAL]);
}

// ---------------------------------------------------------------------------
// Extension drive
// ---------------------------------------------------------------------------

/**
 * Load the real extension in-process and return a `run(argline)` that invokes
 * the real `/claude:plugin` handler and returns everything it notified. Every
 * assertion below reads these strings -- the actual user-visible output, not a
 * test double's idea of it.
 */
async function loadExtension() {
  const commands = new Map();
  const pi = {
    registerCommand: (name, command) => commands.set(name, command),
    registerTool: () => {},
    on: () => {},
    getAllTools: () => [],
  };
  let sink = [];
  const ctx = {
    cwd: REPO_ROOT,
    ui: {
      notify: (message, severity) => sink.push({ message: String(message), severity }),
      addAutocompleteProvider: () => {},
    },
  };

  await claudeMarketplaceExtension(pi);
  const command = commands.get("claude:plugin");
  if (command === undefined) {
    liveRuntimeRequired("claude:plugin command was not registered by the extension.");
  }

  async function run(argline) {
    sink = [];
    await command.handler(argline, ctx);
    const messages = sink;
    return { messages, text: messages.map((m) => m.message).join("\n") };
  }

  async function quiet(argline) {
    return await run(argline).catch(() => ({ messages: [], text: "" }));
  }

  return { run, quiet };
}

function show(label, text) {
  const indented = text
    .split("\n")
    .map((l) => `    ${l}`)
    .join("\n");
  console.log(`\n  --- ${label} ---\n${indented}\n`);
}

/** The single row for one plugin, so a control plugin's reasons never satisfy an assertion about another. */
function rowFor(text, pluginName) {
  return text.split("\n").filter((l) => l.includes(pluginName));
}

// ---------------------------------------------------------------------------
// Flow A -- manifest absence
// ---------------------------------------------------------------------------

/**
 * A1 (INV-01..04) and A2 (BOUND-03): the record whose manifest entry vanished
 * keeps its row and gains the reason stamp, while the still-declared control
 * plugin does NOT. A2 is the control that proves the reason tracks the ENTRY,
 * not the manifest read.
 */
function assertManifestAbsenceRows(after) {
  const vanishingRows = rowFor(after.text, VANISHING);
  if (vanishingRows.length === 0) {
    fail(
      "A1",
      `the installed plugin vanished from list output when its manifest entry was dropped.`,
      after.text,
    );
  }
  if (!vanishingRows.some((l) => l.includes(NOT_IN_MANIFEST))) {
    fail("A1", `the surviving row does not carry "${NOT_IN_MANIFEST}".`, vanishingRows.join("\n"));
  }
  pass(`A1 (INV-01..04): the record survives and its row stamps "${NOT_IN_MANIFEST}"`);

  const stayingRows = rowFor(after.text, STAYING);
  if (stayingRows.length === 0) {
    fail("A2", "the control plugin disappeared from list output.", after.text);
  }
  if (stayingRows.some((l) => l.includes(NOT_IN_MANIFEST))) {
    fail(
      "A2",
      `the still-declared control plugin was ALSO stamped "${NOT_IN_MANIFEST}" -- the reason is tracking the read, not the entry.`,
      stayingRows.join("\n"),
    );
  }
  pass(`A2 (BOUND-03): the still-declared control plugin is NOT stamped`);
}

/**
 * A3 (INFO-09..11), A4 (INFO-12), A5 (LIFE-05) and A6 (LIFE-04): every
 * remaining surface must operate off the INSTALLATION RECORD once the manifest
 * entry is gone -- info reconstructs the inventory, `--fetch` declines the
 * network with a visible skip note, update skips, and uninstall still removes
 * both the staged artifacts and the record.
 */
async function assertRecordBackedSurfaces(run) {
  const info = await run(`info ${VANISHING}@${MARKETPLACE_NAME} --scope user`);
  show("info on the manifest-absent plugin", info.text);
  if (info.text.includes("(failed)")) {
    fail(
      "A3",
      "info returned (failed) instead of falling through to the installation record.",
      info.text,
    );
  }
  const reconstructed = ["vanish-skill", "vanish-command", "vanish-agent", "vanish-mcp"].filter(
    (n) => info.text.includes(n),
  );
  if (reconstructed.length === 0) {
    fail("A3", "info rendered no component inventory from the installation record.", info.text);
  }
  pass(
    `A3 (INFO-09..11): info renders from the record; components reconstructed: ${reconstructed.join(", ")}`,
  );

  const fetched = await run(`info ${VANISHING}@${MARKETPLACE_NAME} --scope user --fetch`);
  show("info --fetch on the manifest-absent plugin", fetched.text);
  if (fetched.text.includes("(failed)")) {
    fail("A4", "info --fetch returned (failed) on the record-backed arm.", fetched.text);
  }
  if (!/skip/i.test(fetched.text)) {
    fail(
      "A4",
      "info --fetch emitted no skip note -- the network guard is not visible to the user.",
      fetched.text,
    );
  }
  pass(`A4 (INFO-12): info --fetch emits the skip note instead of reaching the network`);

  const updated = await run(`update ${VANISHING}@${MARKETPLACE_NAME} --scope user`);
  show("update on the manifest-absent plugin", updated.text);
  if (!updated.text.includes("(skipped)") || !updated.text.includes(NOT_IN_MANIFEST)) {
    fail("A5", `update did not render "(skipped) {${NOT_IN_MANIFEST}}".`, updated.text);
  }
  pass(`A5 (LIFE-05): update renders (skipped) {${NOT_IN_MANIFEST}}`);

  const locations = locationsFor("user", REPO_ROOT);
  const skillsBefore = await readdir(locations.skillsTargetDir).catch(() => []);
  const staged = skillsBefore.filter((n) => n.includes("vanish"));
  if (staged.length === 0) {
    fail(
      "A6",
      "no staged skill artifact was found on disk before uninstall -- the flow proves nothing.",
      skillsBefore.join(", "),
    );
  }

  const uninstalled = await run(`uninstall ${VANISHING}@${MARKETPLACE_NAME} --scope user`);
  show("uninstall on the manifest-absent plugin", uninstalled.text);
  if (uninstalled.text.includes("(failed)")) {
    fail("A6", "uninstall failed on a manifest-absent record.", uninstalled.text);
  }
  const skillsAfter = await readdir(locations.skillsTargetDir).catch(() => []);
  const leftover = skillsAfter.filter((n) => n.includes("vanish"));
  if (leftover.length > 0) {
    fail("A6", `uninstall left staged artifacts on disk: ${leftover.join(", ")}`);
  }
  const stateAfter = await loadState(locations.extensionRoot);
  if (stateAfter.marketplaces[MARKETPLACE_NAME]?.plugins?.[VANISHING] !== undefined) {
    fail("A6", "uninstall left the installation record behind.");
  }
}

async function flowA(ext, root) {
  const { run } = ext;

  await run(`marketplace add ${root} --scope user`);
  await run(`install ${VANISHING}@${MARKETPLACE_NAME} --scope user`);
  await run(`install ${STAYING}@${MARKETPLACE_NAME} --scope user`);

  const state = await loadState(locationsFor("user", REPO_ROOT).extensionRoot);
  const record = state.marketplaces[MARKETPLACE_NAME]?.plugins?.[VANISHING];
  if (record === undefined) {
    liveRuntimeRequired("Canary install did not produce an installation record.");
  }
  const kinds = Object.entries(record.resources ?? {})
    .filter(([, v]) => Array.isArray(v) && v.length > 0)
    .map(([k]) => k);
  pass(`installed ${VANISHING} with resource kinds: ${kinds.join(", ")}`);

  const before = await run(`list --scope user`);
  show("list BEFORE the manifest entry disappears", before.text);
  if (before.text.includes(NOT_IN_MANIFEST)) {
    fail(
      "A0",
      `a freshly installed, still-declared plugin was stamped "${NOT_IN_MANIFEST}".`,
      before.text,
    );
  }
  pass(`A0 baseline: both declared plugins render without "${NOT_IN_MANIFEST}"`);

  // The manifest stays VALID -- only the entry goes away. That distinction is
  // the whole milestone: an unreadable manifest must never be reported as a
  // missing entry (BOUND-03), so the canary must not corrupt the file.
  await writeManifest(root, [STAYING, PARTIAL]);

  const after = await run(`list --scope user`);
  show("list AFTER the manifest entry disappears", after.text);

  assertManifestAbsenceRows(after);

  await assertRecordBackedSurfaces(run);
}

// ---------------------------------------------------------------------------
// Flow B -- disabled partial
// ---------------------------------------------------------------------------

async function flowB(ext) {
  const { run } = ext;

  const installed = await run(`install ${PARTIAL}@${MARKETPLACE_NAME} --scope user --partial`);
  show("install --partial", installed.text);

  const locations = locationsFor("user", REPO_ROOT);
  const state = await loadState(locations.extensionRoot);
  const record = state.marketplaces[MARKETPLACE_NAME]?.plugins?.[PARTIAL];
  if (record === undefined) {
    liveRuntimeRequired(
      "The partial install produced no record; the disabled-partial flow cannot run.",
      installed.text,
    );
  }
  if (record.compatibility?.installable !== false) {
    liveRuntimeRequired(
      `The fixture did not install PARTIALLY (compatibility.installable=${record.compatibility?.installable}); ` +
        `the disabled-partial flow needs the partial record shape.`,
      installed.text,
    );
  }
  pass(
    `B0: ${PARTIAL} installed partially (compatibility.installable=false) -- the repaired record shape`,
  );

  const disabled = await run(`disable ${PARTIAL}@${MARKETPLACE_NAME} --scope user`);
  show("disable on the partial", disabled.text);
  if (disabled.text.includes("(failed)")) {
    fail("B1", "disable failed on a partially installed plugin.", disabled.text);
  }
  pass(`B1 (ENBL-05/06): disable succeeds on a partially installed plugin`);

  const listed = await run(`list --scope user`);
  show("list with the disabled partial", listed.text);
  const partialRows = rowFor(listed.text, PARTIAL);
  if (!partialRows.some((l) => l.includes("(disabled)"))) {
    fail(
      "B2",
      "list does NOT render the disabled partial as (disabled) -- this is the exact ENBL-04 regression the milestone repaired.",
      partialRows.join("\n"),
    );
  }
  pass(`B2 (ENBL-06): list renders the disabled partial as (disabled)`);

  const infoDisabled = await run(`info ${PARTIAL}@${MARKETPLACE_NAME} --scope user`);
  show("info on the disabled partial", infoDisabled.text);
  if (!infoDisabled.text.includes("(disabled)")) {
    fail("B2", "info does NOT render the disabled partial as (disabled).", infoDisabled.text);
  }
  pass(`B2 (ENBL-06): info agrees -- the disabled partial is disabled on both surfaces`);

  const again = await run(`disable ${PARTIAL}@${MARKETPLACE_NAME} --scope user`);
  show("disable again (idempotency)", again.text);
  if (again.text.includes("(failed)")) {
    fail("B3", "a second disable on an already-disabled partial failed.", again.text);
  }
  pass(`B3 (ENBL-07): disable is idempotent on an already-disabled partial`);
}

// ---------------------------------------------------------------------------
// Section C -- live pi host-integration smoke
// ---------------------------------------------------------------------------

/**
 * Load the extension inside a REAL `pi` process. Flows A and B drive the
 * extension in-process against real disk, which is where every surface this
 * canary covers actually lives; this section adds the one thing in-process
 * cannot establish -- that the host imports the extension and runs its session
 * lifecycle without an extension error escaping the guards NFR-2 places around
 * `resources_discover` and `session_start`.
 *
 * A completed turn is what makes that observable, so the sandbox needs a
 * configured provider. Without one `pi` prints "No API key found" and tears
 * down before the lifecycle runs, which is a precondition miss rather than a
 * result: the harness routes it to human_needed instead of reading the quiet
 * exit as a pass. Do NOT substitute an on-disk self-heal probe here --
 * `planReconcile` diffs the declared config against the installation records,
 * not the records against staged artifacts, so an externally deleted artifact
 * is not something reconcile is meant to restore.
 */
async function flowC() {
  let versionOut;
  try {
    const { stdout } = await execFileAsync("pi", ["--version"], { timeout: 30_000 });
    versionOut = stdout.trim();
  } catch (err) {
    return { ok: false, reason: "`pi` CLI is not on PATH.", detail: String(err?.message ?? err) };
  }

  const args = [
    "-p",
    "--no-session",
    "--no-extensions",
    "--extension",
    EXTENSION_ENTRY,
    "--offline",
    "--no-tools",
    "--mode",
    "json",
    "--append-system-prompt",
    "Answer in one short sentence. Do not ask questions.",
    "Say the single word: ready.",
  ];

  const run = await new Promise((resolve) => {
    const child = spawn("pi", args, {
      cwd: REPO_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 2_000);
    }, PI_DRIVE_TIMEOUT_MS);
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, timedOut, code: null, message: String(err?.message ?? err) });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, timedOut, code });
    });
  });

  const combined = `${run.stdout}\n${run.stderr}`;
  // An extension that throws past resources_discover / session_start surfaces
  // here; that is a real failure, distinct from "no provider configured".
  const extensionError = /pi-claude-marketplace.*(error|failed)/i.test(combined);
  if (extensionError) {
    return {
      ok: false,
      hard: true,
      reason: "the extension reported an error under a real pi host.",
      detail: combined.slice(0, 4000),
    };
  }
  if (run.code !== 0) {
    return {
      ok: false,
      reason: `pi ${versionOut} exited ${run.code} (no configured provider in the sandbox is the usual cause).`,
      detail: combined.slice(0, 2000),
    };
  }
  return { ok: true, version: versionOut };
}

// ---------------------------------------------------------------------------

async function teardown(ext, root) {
  if (ext !== undefined) {
    for (const name of [VANISHING, STAYING, PARTIAL]) {
      await ext.quiet(`uninstall ${name}@${MARKETPLACE_NAME} --scope user`);
    }
    await ext.quiet(`marketplace remove ${MARKETPLACE_NAME} --scope user`);
  }
  if (root !== undefined) {
    await rm(root, { recursive: true, force: true });
  }
}

async function main() {
  const agentDir = await assertPreconditions();

  const root = await mkdtemp(path.join(tmpdir(), "manifest-absence-"));
  let ext;
  let cSummary;
  try {
    await buildMarketplace(root);
    ext = await loadExtension();

    // Pre-clean residue from a prior aborted run.
    await teardown(ext, undefined);

    console.log(`\n[manifest-absence] === Flow A: manifest absence ===`);
    await flowA(ext, root);

    console.log(`\n[manifest-absence] === Flow B: disabled partial ===`);
    await flowB(ext);

    console.log(`\n[manifest-absence] === Flow C: live pi host smoke ===`);
    cSummary = await flowC();
    if (cSummary.ok) {
      pass(
        `C (NFR-2): pi ${cSummary.version} loaded the extension and settled without an extension error`,
      );
    }
  } finally {
    await teardown(ext, root);
  }

  if (cSummary !== undefined && !cSummary.ok) {
    console.error(
      `\n[manifest-absence] SCRIPTABLE HALVES PROVEN, HOST SMOKE -> human_needed:` +
        `\n  Flows A and B passed against the real extension and real disk (above).` +
        `\n  The live-pi host smoke could NOT run: ${cSummary.reason}`,
    );
    if (cSummary.detail) {
      console.error(`\n${cSummary.detail}`);
    }
    throw new UatExit("host smoke requires a configured provider");
  }

  console.log(
    `\n[manifest-absence] OK -- manifest absence and disabled-partial flows proven end to end.`,
  );
}

main().then(
  () => process.exit(0),
  (err) => {
    if (err instanceof UatExit) {
      process.exit(1);
    }
    console.error(`\n[manifest-absence] LIVE RUNTIME REQUIRED -- unexpected harness error:`);
    console.error(String(err?.stack ?? err));
    process.exit(1);
  },
);
