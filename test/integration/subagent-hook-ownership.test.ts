// test/integration/subagent-hook-ownership.test.ts
//
// One multi-process case (ITSCOPE-01) of the process ownership of async hooks
// (D-PG3-09). A main Pi, a pi-subagents background child, and a live sibling
// child each run as a real Pi process in RPC mode with the real extension,
// the scripted model, and a plugin installed through `/claude:plugin`, whose
// waiting script hooks stand in for slow async rewake hooks. When the child's
// Pi dies, the next main load stops the child's waiting hook, because the
// hook process carries the dispatch marker that the dead child's journal
// names, and it leaves the live sibling's hook and journal alone. No scenario
// kills a child's Pi while a sibling runs. A child that loads and stops while
// other hooks wait is in "Loading and stopping a child leaves parent and
// sibling hooks running" (`features/plugin/subagent-child.feature`).
//
// Every stage waits at most `STAGE_TIMEOUT_MS` and each case at most
// `CASE_TIMEOUT_MS`. Each case's release stops every Pi it started and kills
// the process group of every hook script of its sandbox, also after a failed
// assertion.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { parseRecordingHooks, publishRecordingHooks } from "../../features/lib/hook-files.ts";
import { writeMarketplace } from "../../features/lib/path-marketplace.ts";
import { runCommand } from "../../features/lib/pi-commands.ts";
import { writeModelScript } from "../../features/lib/scripted-model/script.ts";
import {
  createSubagentHookSession,
  STAGE_TIMEOUT_MS,
} from "../../features/lib/subagent-hook-session.ts";
import { harnessDirectory } from "../../features/lib/turn-records.ts";

import type { ScriptStep } from "../../features/lib/scripted-model/script.ts";
import type {
  SubagentHookSession,
  WaitingHook,
  WaitingHookObservation,
} from "../../features/lib/subagent-hook-session.ts";
import type { TestContext } from "node:test";

const CASE_TIMEOUT_MS = 120_000;

const SCRIPTED_MODEL_EXTENSION = fileURLToPath(
  new URL("../../features/lib/scripted-model/extension.ts", import.meta.url),
);

// One waiting hook per child: the sibling's bash call and the child's read
// each start one, and neither matches the other's tool.
const WAITING_HOOKS = [
  ["name", "event", "matcher", "form", "async rewake", "waits"],
  ["sibling-wait", "PreToolUse", "Bash", "script", "true", "true"],
  ["child-wait", "PreToolUse", "Read", "script", "true", "true"],
] as const;

const SIBLING_TURN: readonly ScriptStep[] = [
  { tool: "bash", arguments: { command: "echo sibling" } },
  { reply: "Sibling done." },
];

const CHILD_TURN: readonly ScriptStep[] = [
  { tool: "read", arguments: { path: "notes.txt" } },
  { reply: "Child done." },
];

// The Pis of every case compile the same extensions, so they share one jiti
// cache, which the first Pi fills.
let compileCache = "";

before(async () => {
  compileCache = await mkdtemp(path.join(tmpdir(), "subagent-hook-ownership-jiti-"));
});

after(async () => {
  await rm(compileCache, { recursive: true, force: true });
});

function kept(hook: WaitingHook): WaitingHookObservation {
  return { hook: hook.hook, running: true, record: "kept" };
}

// Creates a sandbox whose project trusts itself and holds `notes.txt`,
// installs the plugin `demo` with the waiting hooks in its project scope
// through a main Pi, and arms `script`. Registers the session's close and the
// sandbox's removal with `t`.
async function installedSession(
  t: TestContext,
  script: readonly ScriptStep[],
): Promise<SubagentHookSession> {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "subagent-hook-ownership-")));
  let session: SubagentHookSession | undefined = undefined;
  t.after(async () => {
    try {
      await session?.close();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  const home = path.join(root, "home");
  const agentDir = path.join(home, ".pi", "agent");
  const cwd = path.join(root, "project");
  const temporaryDirectory = path.join(home, "tmp");
  await mkdir(agentDir, { recursive: true });
  await mkdir(cwd);
  await mkdir(temporaryDirectory);
  await mkdir(harnessDirectory(home));
  await symlink(compileCache, path.join(temporaryDirectory, "jiti"));
  await writeFile(path.join(agentDir, "trust.json"), `${JSON.stringify({ [cwd]: true })}\n`);
  await writeFile(path.join(cwd, "notes.txt"), "child notes\n");
  const certificates = path.join(root, "no-extra-certificates.pem");
  await writeFile(certificates, "");
  const marketplace = path.join(home, "marketplaces", "fixtures");
  const manifestPath = path.join(marketplace, ".claude-plugin", "marketplace.json");
  await writeMarketplace(
    marketplace,
    "fixtures",
    [{ name: "demo", version: "1.0.0" }],
    manifestPath,
  );
  await publishRecordingHooks(
    { kind: "dir", root: marketplace, source: marketplace, manifestPath },
    "demo",
    parseRecordingHooks(WAITING_HOOKS),
  );
  await writeModelScript(harnessDirectory(home), script);
  session = createSubagentHookSession({
    sandbox: { home, agentDir, cwd },
    git: {
      NODE_EXTRA_CA_CERTS: certificates,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: path.join(home, ".gitconfig"),
      GIT_SSL_CAINFO: certificates,
      PATH: process.env.PATH ?? "",
    },
    temporaryDirectory,
    extensions: [SCRIPTED_MODEL_EXTENSION],
    dataRoot: path.join(cwd, ".pi", "pi-claude-marketplace", "data"),
  });
  const installer = await session.start("main");
  for (const command of [
    `/claude:plugin marketplace add ${marketplace} --scope project`,
    "/claude:plugin install demo@fixtures --scope project",
  ]) {
    const payload = await runCommand(installer, command);
    assert.strictEqual(payload.severity, "info", JSON.stringify(payload));
  }

  await installer.stop();
  return session;
}

// Reads `hooks` again until `matches` accepts what it reads, and fails after
// `STAGE_TIMEOUT_MS` with the last observation.
async function observeUntil(
  session: SubagentHookSession,
  hooks: readonly WaitingHook[],
  expected: readonly WaitingHookObservation[],
): Promise<void> {
  const deadline = Date.now() + STAGE_TIMEOUT_MS;
  let observed = await session.observe(hooks);
  while (JSON.stringify(observed) !== JSON.stringify(expected) && Date.now() < deadline) {
    await delay(50);
    observed = await session.observe(hooks);
  }

  assert.deepStrictEqual(observed, expected);
}

test(
  "a main load stops the waiting hook of a child whose Pi died and keeps a live sibling's",
  { timeout: CASE_TIMEOUT_MS },
  async (t) => {
    // arrange
    const session = await installedSession(t, [...SIBLING_TURN, ...CHILD_TURN]);
    const sibling = await session.start("child");
    const siblingHook = await session.promptPastWaitingHook(
      sibling,
      "run the sibling",
      "sibling-wait",
    );
    const child = await session.start("child");
    const childHook = await session.promptPastWaitingHook(child, "read the notes", "child-wait");
    const childJournal: unknown = JSON.parse(await readFile(childHook.journal, "utf8"));
    assert.deepStrictEqual(
      (
        childJournal as { readonly entries: readonly { readonly dispatchId: string }[] }
      ).entries.map((entry) => entry.dispatchId),
      [childHook.dispatchId],
    );
    await child.crash();
    assert.deepStrictEqual(await session.observe([siblingHook, childHook]), [
      kept(siblingHook),
      kept(childHook),
    ]);

    // act
    await session.start("main");

    // assert
    await observeUntil(
      session,
      [siblingHook, childHook],
      [kept(siblingHook), { hook: "child-wait", running: false, record: "removed" }],
    );
    assert.deepStrictEqual(await session.release("sibling-wait"), {
      hook: "sibling-wait",
      pid: siblingHook.pid,
      phase: "end",
      code: 0,
    });
  },
);
