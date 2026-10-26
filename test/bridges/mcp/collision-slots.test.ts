import assert from "node:assert/strict";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { walkMcpSources } from "../../../extensions/pi-claude-marketplace/bridges/mcp/collision-slots.ts";
import {
  createHermeticEnvironment,
  enterHermeticEnvironment,
  type HermeticEnvironment,
} from "../../platform/hermetic-environment.ts";

interface SourcePaths {
  readonly cwd: string;
  readonly sharedGlobal: string;
  readonly agentsGlobal: string;
  readonly agentsNestedGlobal: string;
  readonly piMcpGlobal: string;
  readonly piGlobal: string;
  readonly sharedProject: string;
  readonly piMcpProject: string;
  readonly piProject: string;
}

function sourcePathsIn({ agentDir, cwd, home }: HermeticEnvironment): SourcePaths {
  return {
    cwd,
    sharedGlobal: path.join(home, ".config", "mcp", "mcp.json"),
    agentsGlobal: path.join(home, ".agents", "mcp.json"),
    agentsNestedGlobal: path.join(home, ".agents", "mcp", "mcp.json"),
    piMcpGlobal: path.join(agentDir, "mcp.json"),
    piGlobal: path.join(agentDir, "mcp-adapter.json"),
    sharedProject: path.join(cwd, ".mcp.json"),
    piMcpProject: path.join(cwd, ".pi", "mcp.json"),
    piProject: path.join(cwd, ".pi", "mcp-adapter.json"),
  };
}

async function allocateSourcePaths(t: TestContext): Promise<SourcePaths> {
  return sourcePathsIn(await createHermeticEnvironment(t, "mcp-collision-slots-"));
}

async function writeSource(filePath: string, text: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, text, "utf8");
}

test("AFILE-05: lists the fixed sources in adapter precedence order", async (t) => {
  // arrange
  const sources = await allocateSourcePaths(t);
  const fixedSources = [
    sources.sharedGlobal,
    sources.agentsGlobal,
    sources.agentsNestedGlobal,
    sources.piMcpGlobal,
    sources.piGlobal,
    sources.sharedProject,
    sources.piMcpProject,
    sources.piProject,
  ];
  for (const [index, sourcePath] of fixedSources.entries()) {
    await writeSource(
      sourcePath,
      JSON.stringify({ mcpServers: { [`server-${index}`]: { command: `command-${index}` } } }),
    );
  }

  const expectedDeclarations = new Map(
    fixedSources.map((sourcePath, index) => [
      `server-${index}`,
      [{ sourcePath, entry: { command: `command-${index}` } }],
    ]),
  );

  // act
  const walk = await walkMcpSources(sources.cwd);

  // assert
  assert.deepStrictEqual(walk, {
    sourcePaths: fixedSources,
    declarations: expectedDeclarations,
  });
});

test("AFILE-05: lists a name declared in several sources lowest precedence first", async (t) => {
  // arrange
  const sources = await allocateSourcePaths(t);
  await writeSource(sources.sharedProject, '{"mcpServers":{"shared":{"command":"project"}}}');
  await writeSource(sources.sharedGlobal, '{"mcpServers":{"shared":{"command":"global"}}}');
  await writeSource(sources.piMcpGlobal, '{"mcpServers":{"shared":{"url":"https://agent"}}}');

  // act
  const walk = await walkMcpSources(sources.cwd);

  // assert
  assert.deepStrictEqual(
    walk.declarations,
    new Map([
      [
        "shared",
        [
          { sourcePath: sources.sharedGlobal, entry: { command: "global" } },
          { sourcePath: sources.piMcpGlobal, entry: { url: "https://agent" } },
          { sourcePath: sources.sharedProject, entry: { command: "project" } },
        ],
      ],
    ]),
  );
});

test("AFILE-05: a partial entry with no transport never declares a server", async (t) => {
  // arrange
  const sources = await allocateSourcePaths(t);
  await writeSource(
    sources.piProject,
    JSON.stringify({
      mcpServers: {
        disabled: { disabled: true },
        env: { env: { TOKEN: "token" } },
        socket: { socket: "/run/mcp.sock" },
      },
    }),
  );

  // act
  const walk = await walkMcpSources(sources.cwd);

  // assert
  assert.deepStrictEqual(
    walk.declarations,
    new Map([["socket", [{ sourcePath: sources.piProject, entry: { socket: "/run/mcp.sock" } }]]]),
  );
});

test("AFILE-05: reads an adapter-format source that holds only mcp-servers", async (t) => {
  // arrange
  const sources = await allocateSourcePaths(t);
  await writeSource(sources.agentsGlobal, '{"mcp-servers":{"legacy":{"command":"legacy"}}}');

  // act
  const walk = await walkMcpSources(sources.cwd);

  // assert
  assert.deepStrictEqual(
    walk.declarations,
    new Map([["legacy", [{ sourcePath: sources.agentsGlobal, entry: { command: "legacy" } }]]]),
  );
});

test("AFILE-05: ignores mcp-servers in a Pi-format mcp.json source", async (t) => {
  // arrange
  const sources = await allocateSourcePaths(t);
  await writeSource(sources.piMcpGlobal, '{"mcp-servers":{"ignored":{"command":"ignored"}}}');
  await writeSource(sources.piMcpProject, '{"mcp-servers":{"ignored":{"command":"ignored"}}}');

  // act
  const walk = await walkMcpSources(sources.cwd);

  // assert
  assert.deepStrictEqual(walk.declarations, new Map());
});

test("AFILE-05: parses a JSONC source with comments and trailing commas", async (t) => {
  // arrange
  const sources = await allocateSourcePaths(t);
  await writeSource(
    sources.agentsNestedGlobal,
    '// user servers\n{\n  "mcpServers": {\n    /* main */ "main": { "command": "main", },\n  },\n}\n',
  );

  // act
  const walk = await walkMcpSources(sources.cwd);

  // assert
  assert.deepStrictEqual(
    walk.declarations,
    new Map([["main", [{ sourcePath: sources.agentsNestedGlobal, entry: { command: "main" } }]]]),
  );
});

for (const { label, text } of [
  { label: "invalid JSONC", text: '{"mcpServers":{"broken":{"command":"x"}}' },
  { label: "a top-level array", text: '[{"mcpServers":{"broken":{"command":"x"}}}]' },
  { label: "a non-object mcpServers", text: '{"mcpServers":["broken"]}' },
]) {
  test(`AFILE-05: a source holding ${label} contributes nothing`, async (t) => {
    // arrange
    const sources = await allocateSourcePaths(t);
    await writeSource(sources.sharedGlobal, text);
    await writeSource(sources.piGlobal, '{"mcpServers":{"survivor":{"command":"survivor"}}}');

    // act
    const walk = await walkMcpSources(sources.cwd);

    // assert
    assert.deepStrictEqual(
      walk.declarations,
      new Map([["survivor", [{ sourcePath: sources.piGlobal, entry: { command: "survivor" } }]]]),
    );
  });
}

test("AFILE-05: a bare server map without a server key declares nothing", async (t) => {
  // arrange
  const sources = await allocateSourcePaths(t);
  await writeSource(sources.sharedProject, '{"name":{"command":"x"}}');

  // act
  const walk = await walkMcpSources(sources.cwd);

  // assert
  assert.deepStrictEqual(walk.declarations, new Map());
});

test("treats a non-directory path component as an absent source", async (t) => {
  // arrange
  const sources = await allocateSourcePaths(t);
  await writeSource(path.dirname(path.dirname(sources.sharedGlobal)), "not a directory\n");

  // act
  const walk = await walkMcpSources(sources.cwd);

  // assert
  assert.deepStrictEqual(walk.declarations, new Map());
});

test("propagates an unreadable source", async (t) => {
  // arrange
  const { environment, restore } = await enterHermeticEnvironment("mcp-collision-slots-");
  const sources = sourcePathsIn(environment);
  t.after(async () => {
    await chmod(sources.agentsGlobal, 0o600);
    await restore();
  });
  await writeSource(sources.agentsGlobal, '{"mcpServers":{}}');
  await chmod(sources.agentsGlobal, 0o000);

  // act & assert
  await assert.rejects(walkMcpSources(sources.cwd), { code: "EACCES" });
});

interface AncestorProject {
  readonly home: string;
  readonly agentDir: string;
  readonly cwd: string;
}

/** A hermetic HOME with the project at `~/work/repo`, under the ancestor root `~/work`. */
async function allocateAncestorProject(t: TestContext): Promise<AncestorProject> {
  const { agentDir, home } = await createHermeticEnvironment(t, "mcp-collision-ancestor-walk-");
  const cwd = path.join(home, "work", "repo");
  await mkdir(cwd, { recursive: true });
  return { home, agentDir, cwd };
}

function ancestorRootsSetting(roots: readonly string[]): string {
  return JSON.stringify({ settings: { ancestorConfigRoots: roots } });
}

test("AFILE-05: places ancestor sources between the user mcp-adapter.json and the project .mcp.json", async (t) => {
  // arrange
  const { home, agentDir, cwd } = await allocateAncestorProject(t);
  const ancestorPath = path.join(home, "work", ".mcp.json");
  await writeSource(path.join(home, ".agents", "mcp.json"), ancestorRootsSetting(["~/work"]));
  await writeSource(ancestorPath, '{"mcpServers":{"ancestor":{"command":"ancestor"}}}');

  // act
  const walk = await walkMcpSources(cwd);

  // assert
  assert.deepStrictEqual(walk, {
    sourcePaths: [
      path.join(home, ".config", "mcp", "mcp.json"),
      path.join(home, ".agents", "mcp.json"),
      path.join(home, ".agents", "mcp", "mcp.json"),
      path.join(agentDir, "mcp.json"),
      path.join(agentDir, "mcp-adapter.json"),
      ancestorPath,
      path.join(home, "work", ".pi", "mcp-adapter.json"),
      path.join(cwd, ".mcp.json"),
      path.join(cwd, ".pi", "mcp.json"),
      path.join(cwd, ".pi", "mcp-adapter.json"),
    ],
    declarations: new Map([
      ["ancestor", [{ sourcePath: ancestorPath, entry: { command: "ancestor" } }]],
    ]),
  });
});

test("AFILE-05: the last user-global source that sets ancestorConfigRoots wins", async (t) => {
  // arrange
  const { home, agentDir, cwd } = await allocateAncestorProject(t);
  await writeSource(path.join(home, ".config", "mcp", "mcp.json"), ancestorRootsSetting([home]));
  await writeSource(path.join(agentDir, "mcp-adapter.json"), ancestorRootsSetting(["~/work"]));
  await writeSource(path.join(home, ".agents", "mcp", "mcp.json"), '{"settings":"invalid"}');
  await writeSource(path.join(home, ".agents", "mcp.json"), '{"settings":{"toolPrefix":"short"}}');

  // act
  const walk = await walkMcpSources(cwd);

  // assert
  assert.deepStrictEqual(walk.sourcePaths.slice(5, -3), [
    path.join(home, "work", ".mcp.json"),
    path.join(home, "work", ".pi", "mcp-adapter.json"),
  ]);
});

test("AFILE-05: ignores ancestorConfigRoots set in a project file or a Pi-format mcp.json", async (t) => {
  // arrange
  const { home, agentDir, cwd } = await allocateAncestorProject(t);
  await writeSource(path.join(cwd, ".mcp.json"), ancestorRootsSetting(["~/work"]));
  await writeSource(path.join(cwd, ".pi", "mcp-adapter.json"), ancestorRootsSetting(["~/work"]));
  await writeSource(path.join(agentDir, "mcp.json"), ancestorRootsSetting(["~/work"]));

  // act
  const walk = await walkMcpSources(cwd);

  // assert
  assert.deepStrictEqual(walk.sourcePaths, [
    path.join(home, ".config", "mcp", "mcp.json"),
    path.join(home, ".agents", "mcp.json"),
    path.join(home, ".agents", "mcp", "mcp.json"),
    path.join(agentDir, "mcp.json"),
    path.join(agentDir, "mcp-adapter.json"),
    path.join(cwd, ".mcp.json"),
    path.join(cwd, ".pi", "mcp.json"),
    path.join(cwd, ".pi", "mcp-adapter.json"),
  ]);
});

test("AFILE-05: does not repeat an ancestor path that is already a global source", async (t) => {
  // arrange
  const { home, cwd } = await allocateAncestorProject(t);
  const agentDir = path.join(home, "work", ".pi");
  // The hermetic environment restores PI_CODING_AGENT_DIR after the case.
  process.env.PI_CODING_AGENT_DIR = agentDir;
  await writeSource(path.join(home, ".agents", "mcp.json"), ancestorRootsSetting(["~/work"]));

  // act
  const walk = await walkMcpSources(cwd);

  // assert
  assert.deepStrictEqual(walk.sourcePaths, [
    path.join(home, ".config", "mcp", "mcp.json"),
    path.join(home, ".agents", "mcp.json"),
    path.join(home, ".agents", "mcp", "mcp.json"),
    path.join(agentDir, "mcp.json"),
    path.join(agentDir, "mcp-adapter.json"),
    path.join(home, "work", ".mcp.json"),
    path.join(cwd, ".mcp.json"),
    path.join(cwd, ".pi", "mcp.json"),
    path.join(cwd, ".pi", "mcp-adapter.json"),
  ]);
});
