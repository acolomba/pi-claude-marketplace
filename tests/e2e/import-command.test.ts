import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { registerClaudePluginCommand } from "../../extensions/pi-claude-marketplace/edge/register.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { loadState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";

import { makeCtx, makeMockPi } from "./_helpers.ts";

import type { GitOps } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";

const FIXTURE_ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../fixtures/import-command",
);

async function withImportFixture<T>(
  fn: (env: { root: string; home: string; cwd: string }) => Promise<T>,
): Promise<T> {
  const originalHome = process.env.HOME;
  const originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;
  const originalCwd = process.cwd();
  const root = await mkdtemp(path.join(tmpdir(), "pi-cm-import-e2e-"));
  const home = path.join(root, "home");
  const cwd = path.join(root, "project");
  const claudeConfigDir = path.join(root, "user-claude");

  try {
    await mkdir(home, { recursive: true });
    await cp(path.join(FIXTURE_ROOT, "user-claude"), claudeConfigDir, { recursive: true });
    await cp(path.join(FIXTURE_ROOT, "project"), cwd, { recursive: true });
    await cp(
      path.join(FIXTURE_ROOT, "directory-marketplace"),
      path.join(cwd, "directory-marketplace"),
      {
        recursive: true,
      },
    );
    await cp(
      path.join(FIXTURE_ROOT, "mismatched-directory-marketplace"),
      path.join(cwd, "mismatched-directory-marketplace"),
      { recursive: true },
    );
    process.env.HOME = home;
    process.env.CLAUDE_CONFIG_DIR = claudeConfigDir;
    process.chdir(cwd);
    return await fn({ root, home, cwd });
  } finally {
    process.chdir(originalCwd);
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    if (originalClaudeConfigDir === undefined) {
      delete process.env.CLAUDE_CONFIG_DIR;
    } else {
      process.env.CLAUDE_CONFIG_DIR = originalClaudeConfigDir;
    }

    await rm(root, { recursive: true, force: true });
  }
}

function fixtureGitOps(): GitOps {
  const cloneFixtures = new Map<string, string>([
    [
      "https://github.com/anthropics/claude-plugins-official.git",
      path.join(FIXTURE_ROOT, "official-marketplace"),
    ],
    [
      "https://github.com/example/github-marketplace.git",
      path.join(FIXTURE_ROOT, "github-marketplace"),
    ],
  ]);

  return {
    async clone(opts): Promise<void> {
      const source = cloneFixtures.get(opts.url);
      if (source === undefined) {
        throw new Error(`unexpected clone url ${opts.url}`);
      }

      await cp(source, opts.dir, { recursive: true });
    },
    async fetch(): Promise<void> {
      await Promise.resolve();
    },
    async forceUpdateRef(): Promise<void> {
      await Promise.resolve();
    },
    async checkout(): Promise<void> {
      await Promise.resolve();
    },
    resolveRef(): Promise<string> {
      return Promise.resolve("0000000000000000000000000000000000000001");
    },
    currentBranch(): Promise<string> {
      return Promise.resolve("main");
    },
  };
}

function registerImportCommand(cwd: string, gitOps: GitOps) {
  const mock = makeMockPi([
    { name: "subagent" },
    { name: "mcp", sourceInfo: { source: "pi-mcp-adapter" } },
  ]);
  registerClaudePluginCommand(mock.pi, {
    gitOps,
    pluginUpdate: () =>
      Promise.resolve({
        partition: "unchanged",
        name: "unused",
        fromVersion: "0.0.0",
        toVersion: "0.0.0",
        declaresAgents: false,
        declaresMcp: false,
      }),
  });
  const command = mock.commands.get("claude:plugin");
  assert.ok(command, "claude:plugin command should be registered");
  const { ctx, notifications } = makeCtx(cwd);
  return { command, ctx, notifications };
}

test("/claude:plugin import imports enabled Claude settings across both scopes", async () => {
  await withImportFixture(async ({ cwd }) => {
    const gitOps = fixtureGitOps();
    const { command, ctx, notifications } = registerImportCommand(cwd, gitOps);

    await command.handler("marketplace add ./directory-marketplace --scope user", ctx);
    await command.handler("install preinstalled-plugin@directory-marketplace --scope user", ctx);
    notifications.length = 0;

    await command.handler("import", ctx);

    const userState = await loadState(locationsFor("user", cwd).extensionRoot);
    const projectState = await loadState(locationsFor("project", cwd).extensionRoot);

    assert.ok(userState.marketplaces["claude-plugins-official"]?.plugins["official-plugin"]);
    assert.ok(userState.marketplaces["directory-marketplace"]?.plugins["local-plugin"]);
    assert.ok(userState.marketplaces["directory-marketplace"]?.plugins["preinstalled-plugin"]);
    assert.ok(userState.marketplaces["github-marketplace"]?.plugins["github-plugin"]);
    assert.equal(
      userState.marketplaces["directory-marketplace"]?.plugins["disabled-by-local"],
      undefined,
    );
    assert.equal(
      userState.marketplaces["directory-marketplace"]?.plugins["unavailable-plugin"],
      undefined,
    );

    assert.ok(projectState.marketplaces["claude-plugins-official"]?.plugins["official-plugin"]);
    assert.ok(projectState.marketplaces["directory-marketplace"]?.plugins["local-plugin"]);
    assert.ok(projectState.marketplaces["github-marketplace"]?.plugins["github-plugin"]);

    const userSkill = await readFile(
      path.join(locationsFor("user", cwd).skillsTargetDir, "local-plugin-local-skill", "SKILL.md"),
      "utf8",
    );
    assert.match(userSkill, /Local plugin skill/);

    const messages = notifications.map((notification) => notification.message).join("\n");
    // The folded renderer emits per-marketplace headers with 2-space-indented
    // child rows; plugin rows carry neither a [scope] bracket nor an
    // @marketplace suffix (the scope and marketplace live on the parent header).
    assert.match(messages, /● claude-plugins-official \[project\] \(added\)/);
    assert.match(messages, / {2}● official-plugin \(installed\)/);
    assert.match(messages, / {2}⊘ preinstalled-plugin \(skipped\) \{already installed\}/);
    assert.match(messages, / {2}⊘ unavailable-plugin \(unavailable\) \{no longer installable\}/);
    assert.equal((messages.match(/\/reload to pick up changes/g) ?? []).length, 1);
  });
});

test("/claude:plugin import --scope project narrows writes to project scope", async () => {
  await withImportFixture(async ({ cwd }) => {
    const { command, ctx, notifications } = registerImportCommand(cwd, fixtureGitOps());

    await command.handler("import --scope project", ctx);

    const userState = await loadState(locationsFor("user", cwd).extensionRoot);
    const projectState = await loadState(locationsFor("project", cwd).extensionRoot);
    assert.deepEqual(userState.marketplaces, {});
    assert.ok(projectState.marketplaces["directory-marketplace"]?.plugins["local-plugin"]);

    const messages = notifications.map((notification) => notification.message).join("\n");
    // Folded under the `● directory-marketplace [project] (added)` header; the
    // child row carries no [scope] bracket (scope lives on the parent header).
    assert.match(messages, / {2}● local-plugin \(installed\)/);
    assert.doesNotMatch(messages, /local-plugin \[user\]/);
  });
});

test("/claude:plugin import reports source mismatches and skips dependent plugins", async () => {
  await withImportFixture(async ({ cwd }) => {
    const { command, ctx, notifications } = registerImportCommand(cwd, fixtureGitOps());

    await command.handler(
      "marketplace add ./mismatched-directory-marketplace --scope project",
      ctx,
    );
    notifications.length = 0;

    await command.handler("import --scope project", ctx);

    const projectState = await loadState(locationsFor("project", cwd).extensionRoot);
    assert.equal(
      projectState.marketplaces["directory-marketplace"]?.plugins["local-plugin"],
      undefined,
    );

    const messages = notifications.map((notification) => notification.message).join("\n");
    // The source-mismatch cascade renders a FAILED marketplace header with a
    // FAILED folded child (not skipped); the child has no [scope] bracket.
    assert.match(messages, /⊘ directory-marketplace \[project\] \(failed\)/);
    assert.match(messages, / {2}⊘ local-plugin \(failed\) \{source mismatch\}/);
  });
});
