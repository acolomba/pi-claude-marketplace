import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import { mock, verify, when } from "strong-mock";

import { loadQualifiedSkillAliases } from "../../extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts";

import type { ExtensionAPI } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

test("maps loaded skills to plugin-qualified names and leaves command collisions alone", async () => {
  // arrange
  const agentDir = "/agent";
  const cwd = "/work";
  const skillPath = (name: string): string =>
    path.join(agentDir, "pi-claude-marketplace", "resources", "skills", name, "SKILL.md");
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  when(() => pi.getCommands())
    .thenReturn([
      {
        name: "skill:foo-bar",
        source: "skill",
        sourceInfo: {
          path: skillPath("foo-bar"),
          source: "user",
          scope: "user",
          origin: "top-level",
        },
      },
      {
        name: "skill:foo",
        source: "skill",
        sourceInfo: {
          path: skillPath("foo"),
          source: "user",
          scope: "user",
          origin: "top-level",
        },
      },
      {
        name: "foo:bar",
        source: "prompt",
        sourceInfo: {
          path: "/agent/prompts/foo:bar.md",
          source: "user",
          scope: "user",
          origin: "top-level",
        },
      },
    ])
    .times(1);
  const loadedRoots: string[] = [];

  // act
  const aliases = await loadQualifiedSkillAliases(pi, cwd, {
    getAgentDir: () => agentDir,
    loadState: (root) => {
      loadedRoots.push(root);
      return Promise.resolve({
        marketplaces: {
          marketplace: {
            plugins: {
              foo: { resources: { skills: ["foo-bar", "foo", "foo-missing", "other"] } },
              "": { resources: { skills: ["invalid"] } },
            },
          },
        },
      });
    },
  });

  // assert
  assert.deepStrictEqual([...aliases], [["foo:foo", "foo"]]);
  assert.deepStrictEqual(loadedRoots, [
    path.join(agentDir, "pi-claude-marketplace"),
    path.join(cwd, ".pi", "pi-claude-marketplace"),
  ]);
  verify(pi);
});

test("uses project state when user state cannot be read", async () => {
  // arrange
  const agentDir = "/agent";
  const cwd = "/work";
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  when(() => pi.getCommands())
    .thenReturn([
      {
        name: "skill:foo-bar",
        source: "skill",
        sourceInfo: {
          path: path.join(
            cwd,
            ".pi",
            "pi-claude-marketplace",
            "resources",
            "skills",
            "foo-bar",
            "SKILL.md",
          ),
          source: "project",
          scope: "project",
          origin: "top-level",
        },
      },
    ])
    .times(1);

  // act
  const aliases = await loadQualifiedSkillAliases(pi, cwd, {
    getAgentDir: () => agentDir,
    loadState: (root) =>
      root.startsWith(agentDir)
        ? Promise.reject(new Error("unreadable user state"))
        : Promise.resolve({
            marketplaces: {
              marketplace: { plugins: { foo: { resources: { skills: ["foo-bar"] } } } },
            },
          }),
  });

  // assert
  assert.deepStrictEqual([...aliases], [["foo:bar", "foo-bar"]]);
  verify(pi);
});
