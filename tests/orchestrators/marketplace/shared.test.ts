import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { mock, verify, when } from "strong-mock";

import {
  GENERATED_AGENT_MARKER,
  GENERATED_AGENT_PREFIX,
} from "../../../extensions/pi-claude-marketplace/bridges/agents/marker.ts";
import {
  AgentsUnstageFailureError,
  DEFAULT_GIT_OPS,
  cascadeUnstagePlugin,
  classifyAutoupdateFlip,
  loadVisibleMarketplaces,
  narrowCascadeFailure,
  refreshGitHubClone,
  resolveScopeFromState,
  resolveScopeOrNotifyNotAdded,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import * as defaultGit from "../../../extensions/pi-claude-marketplace/platform/git.ts";
import { atomicWriteJson } from "../../../extensions/pi-claude-marketplace/shared/atomic-json.ts";
import { MarketplaceNotFoundError } from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { createCredentialOpsFake } from "../../platform/credential-ops-fake.ts";

import type {
  AutoupdateFlipResult,
  GitAuthBundle,
  GitOps,
  UnstageOutcome,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type { AgentsIndex } from "../../../extensions/pi-claude-marketplace/persistence/agents-index-schema.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { AuthAttemptResult } from "../../../extensions/pi-claude-marketplace/platform/git.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { Scope } from "../../../extensions/pi-claude-marketplace/shared/types.ts";

type MarketplaceRecord = ExtensionState["marketplaces"][string];
type PluginRecord = MarketplaceRecord["plugins"][string];

type GitCall =
  | { readonly operation: "fetch"; readonly args: Parameters<GitOps["fetch"]>[0] }
  | { readonly operation: "resolveRef"; readonly args: Parameters<GitOps["resolveRef"]>[0] }
  | {
      readonly operation: "currentBranch";
      readonly args: Parameters<GitOps["currentBranch"]>[0];
    }
  | {
      readonly operation: "forceUpdateRef";
      readonly args: Parameters<GitOps["forceUpdateRef"]>[0];
    }
  | { readonly operation: "checkout"; readonly args: Parameters<GitOps["checkout"]>[0] }
  | { readonly operation: "fetchSucceeded" };

interface GitScenario {
  readonly resolveRefResult?: string;
  readonly currentBranchResult?: string;
  readonly fetchError?: Error;
  readonly resolveRefError?: Error;
  readonly currentBranchError?: Error;
  readonly forceUpdateRefError?: Error;
  readonly checkoutError?: Error;
}

interface NotificationExpectation {
  readonly message: string;
  readonly severity: "error";
}

void (DEFAULT_GIT_OPS satisfies GitOps);
void ({ changed: [], unchanged: [] } satisfies AutoupdateFlipResult);
void ({
  ok: true,
  dropped: { skills: [], commands: [], agents: [], hooks: [], mcpServers: [] },
} satisfies UnstageOutcome);

function createGitOps(scenario: GitScenario): {
  readonly gitOps: GitOps;
  readonly calls: GitCall[];
} {
  const calls: GitCall[] = [];
  const gitOps: GitOps = {
    clone(): Promise<void> {
      return Promise.reject(new Error("unexpected clone"));
    },
    fetch(args): Promise<void> {
      calls.push({ operation: "fetch", args: { ...args } });
      if (scenario.fetchError !== undefined) {
        return Promise.reject(scenario.fetchError);
      }

      return Promise.resolve();
    },
    resolveRef(args): Promise<string> {
      calls.push({ operation: "resolveRef", args: { ...args } });
      if (scenario.resolveRefError !== undefined) {
        return Promise.reject(scenario.resolveRefError);
      }

      return Promise.resolve(
        scenario.resolveRefResult ?? "1111111111111111111111111111111111111111",
      );
    },
    currentBranch(args): Promise<string | undefined> {
      calls.push({ operation: "currentBranch", args: { ...args } });
      if (scenario.currentBranchError !== undefined) {
        return Promise.reject(scenario.currentBranchError);
      }

      return Promise.resolve(scenario.currentBranchResult);
    },
    forceUpdateRef(args): Promise<void> {
      calls.push({ operation: "forceUpdateRef", args: { ...args } });
      if (scenario.forceUpdateRefError !== undefined) {
        return Promise.reject(scenario.forceUpdateRefError);
      }

      return Promise.resolve();
    },
    checkout(args): Promise<void> {
      calls.push({ operation: "checkout", args: { ...args } });
      if (scenario.checkoutError !== undefined) {
        return Promise.reject(scenario.checkoutError);
      }

      return Promise.resolve();
    },
    resolveRemoteRef(): Promise<string> {
      return Promise.reject(new Error("unexpected remote ref resolution"));
    },
  };

  return { gitOps, calls };
}

function pluginRecord(resources: Partial<PluginRecord["resources"]> = {}): PluginRecord {
  return {
    version: "1.2.3",
    resolvedSource: "/plugins/sample",
    compatibility: {
      installable: true,
      notes: [],
      supported: [],
      unsupported: [],
    },
    resources: {
      skills: resources.skills ?? [],
      prompts: resources.prompts ?? [],
      agents: resources.agents ?? [],
      hooks: resources.hooks ?? [],
      mcpServers: resources.mcpServers ?? [],
    },
    enabled: true,
    installedAt: "2026-08-31T12:00:00.000Z",
    updatedAt: "2026-08-31T12:00:00.000Z",
  };
}

function marketplaceRecord(name: string, scope: Scope, cwd: string): MarketplaceRecord {
  return {
    name,
    scope,
    source: { kind: "path", raw: `./${name}`, logical: `./${name}` },
    addedFromCwd: cwd,
    manifestPath: path.join(cwd, `${name}.marketplace.json`),
    marketplaceRoot: path.join(cwd, name),
    plugins: {},
  };
}

function legacyAutoupdateRecord(
  name: string,
  autoupdate: boolean | undefined,
): MarketplaceRecord & { readonly autoupdate?: boolean } {
  const record = marketplaceRecord(name, "project", "/work/project");
  return autoupdate === undefined ? record : Object.assign(record, { autoupdate });
}

async function createProjectScope(
  t: TestContext,
  label: string,
): Promise<{ readonly cwd: string; readonly locations: ScopedLocations }> {
  const cwd = await mkdtemp(path.join(tmpdir(), `marketplace-shared-${label}-`));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  return { cwd, locations };
}

async function createHermeticScopes(
  t: TestContext,
  label: string,
): Promise<{
  readonly cwd: string;
  readonly userLocations: ScopedLocations;
  readonly projectLocations: ScopedLocations;
}> {
  const cwd = await mkdtemp(path.join(tmpdir(), `marketplace-shared-${label}-cwd-`));
  const home = await mkdtemp(path.join(tmpdir(), `marketplace-shared-${label}-home-`));
  const homeExisted = Object.hasOwn(process.env, "HOME");
  const previousHome = process.env.HOME;
  t.after(async () => {
    if (homeExisted) {
      process.env.HOME = previousHome;
    } else {
      delete process.env.HOME;
    }

    await rm(cwd, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  });
  process.env.HOME = home;
  return {
    cwd,
    userLocations: locationsFor("user", cwd),
    projectLocations: locationsFor("project", cwd),
  };
}

async function saveMarketplaces(
  locations: ScopedLocations,
  records: readonly MarketplaceRecord[],
): Promise<void> {
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, {
    schemaVersion: 2,
    marketplaces: Object.fromEntries(records.map((record) => [record.name, record])),
  });
}

function notificationBoundary(expectation?: NotificationExpectation): {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  verifyAll(): void;
} {
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "extension UI" });
  if (expectation !== undefined) {
    when(() => ctx.ui).thenReturn(ui);
    when(() => pi.getAllTools())
      .thenReturn([])
      .twice();
    when(() => {
      ui.notify(expectation.message, expectation.severity);
    }).thenReturn(undefined);
  }

  return {
    ctx,
    pi,
    verifyAll(): void {
      verify(ctx);
      verify(pi);
      verify(ui);
    },
  };
}

function ownedAgentFile(generatedName: string): string {
  return `---\nname: ${generatedName}\ntools: read\n---\n\n<!--\n${GENERATED_AGENT_MARKER}\n-->\n\nBody.\n`;
}

async function seedAgent(
  locations: ScopedLocations,
  marketplace: string,
  plugin: string,
  contents: string,
): Promise<{ readonly generatedName: string; readonly targetPath: string }> {
  const generatedName = `${GENERATED_AGENT_PREFIX}${plugin}-agent`;
  const targetPath = path.join(locations.agentsDir, `${generatedName}.md`);
  await mkdir(locations.agentsDir, { recursive: true });
  await writeFile(targetPath, contents);
  const agentsIndex: AgentsIndex = {
    schemaVersion: 1,
    agents: [
      {
        plugin,
        marketplace,
        sourceAgent: "agent",
        generatedName,
        sourcePath: "/plugins/sample/agents/agent.md",
        targetPath,
        sourceHash: "source-hash",
        droppedFields: [],
        droppedTools: [],
        warnings: [],
      },
    ],
  };
  await atomicWriteJson(locations.agentsIndexPath, agentsIndex);
  return { generatedName, targetPath };
}

async function seedFullCascade(
  locations: ScopedLocations,
  marketplace: string,
  plugin: string,
): Promise<{ readonly record: PluginRecord; readonly agentName: string }> {
  const skillDir = path.join(locations.skillsTargetDir, "sample-skill");
  await mkdir(skillDir, { recursive: true });
  await writeFile(path.join(skillDir, "SKILL.md"), "---\nname: sample-skill\n---\nBody.\n");

  await mkdir(locations.promptsTargetDir, { recursive: true });
  await writeFile(path.join(locations.promptsTargetDir, "sample-command.md"), "Command.\n");

  const agentName = `${GENERATED_AGENT_PREFIX}${plugin}-agent`;
  await seedAgent(locations, marketplace, plugin, ownedAgentFile(agentName));

  const hookFile = path.join(locations.hooksDir, plugin, "hooks.json");
  await mkdir(path.dirname(hookFile), { recursive: true });
  await writeFile(hookFile, '{"hooks":{}}');

  await mkdir(path.dirname(locations.mcpJsonPath), { recursive: true });
  await writeFile(
    locations.mcpJsonPath,
    JSON.stringify({
      mcpServers: {
        "sample-server": {
          command: "node",
          _piClaudeMarketplace: { plugin, marketplace },
        },
      },
    }),
  );

  return {
    record: pluginRecord({
      skills: ["sample-skill"],
      prompts: ["sample-command"],
      agents: [agentName],
      hooks: [plugin],
      mcpServers: ["sample-server"],
    }),
    agentName,
  };
}

test("DEFAULT_GIT_OPS exposes every platform git function by exact reference", () => {
  // arrange
  const expectedReferences = {
    clone: defaultGit.clone,
    fetch: defaultGit.fetch,
    forceUpdateRef: defaultGit.forceUpdateRef,
    checkout: defaultGit.checkout,
    resolveRef: defaultGit.resolveRef,
    currentBranch: defaultGit.currentBranch,
    resolveRemoteRef: defaultGit.resolveRemoteRef,
  };

  // act
  const references = DEFAULT_GIT_OPS;

  // assert
  assert.deepStrictEqual(references, expectedReferences);
  assert.strictEqual(Reflect.get(references, "fetch"), Reflect.get(defaultGit, "fetch"));
});

test("AgentsUnstageFailureError preserves its typed failures and standard Error fields", () => {
  // arrange
  const failedAgents = [
    {
      generatedName: "pi-claude-marketplace-sample-agent",
      targetPath: "/scope/agents/pi-claude-marketplace-sample-agent.md",
      reason: "foreign content",
    },
  ];

  // act
  const error = new AgentsUnstageFailureError("Failed to remove 1 agent", failedAgents);

  // assert
  assert.equal(error.name, "AgentsUnstageFailureError");
  assert.equal(error.message, "Failed to remove 1 agent");
  assert.strictEqual(error.failedAgents, failedAgents);
  assert.ok(error instanceof Error);
});

test("refreshGitHubClone tracks the default branch and invokes its callback after authenticated fetch", async () => {
  // arrange
  const remoteSha = "2222222222222222222222222222222222222222";
  const { gitOps, calls } = createGitOps({
    resolveRefResult: remoteSha,
    currentBranchResult: "main",
  });
  const credentials = createCredentialOpsFake({ boundary: "memory" });
  const onAuthRequired = (): Promise<AuthAttemptResult> =>
    Promise.resolve({ ok: false, reason: "not invoked", authAttempted: true });
  const auth: GitAuthBundle = {
    credentialOps: credentials.credentialOps,
    host: "github.com",
    onAuthRequired,
  };
  const onFetchSucceeded = () => {
    calls.push({ operation: "fetchSucceeded" });
  };

  const expectedCalls: GitCall[] = [
    { operation: "fetch", args: { dir: "/cache/official", remote: "origin", auth } },
    { operation: "fetchSucceeded" },
    {
      operation: "resolveRef",
      args: { dir: "/cache/official", ref: "refs/remotes/origin/HEAD" },
    },
    { operation: "currentBranch", args: { dir: "/cache/official" } },
    {
      operation: "forceUpdateRef",
      args: { dir: "/cache/official", ref: "refs/heads/main", value: remoteSha },
    },
    { operation: "checkout", args: { dir: "/cache/official", ref: "main" } },
  ];

  // act
  await refreshGitHubClone("/cache/official", undefined, gitOps, onFetchSucceeded, auth);

  // assert
  assert.deepStrictEqual(calls, expectedCalls);
  assert.strictEqual(calls[0]?.operation === "fetch" ? calls[0].args.auth : undefined, auth);
});

test("refreshGitHubClone checks out the remote SHA when default-branch HEAD is detached", async () => {
  // arrange
  const remoteSha = "3333333333333333333333333333333333333333";
  const { gitOps, calls } = createGitOps({ resolveRefResult: remoteSha });
  const expectedCalls: GitCall[] = [
    { operation: "fetch", args: { dir: "/cache/detached", remote: "origin" } },
    {
      operation: "resolveRef",
      args: { dir: "/cache/detached", ref: "refs/remotes/origin/HEAD" },
    },
    { operation: "currentBranch", args: { dir: "/cache/detached" } },
    { operation: "checkout", args: { dir: "/cache/detached", ref: remoteSha } },
  ];

  // act
  await refreshGitHubClone("/cache/detached", undefined, gitOps);

  // assert
  assert.deepStrictEqual(calls, expectedCalls);
});

test("refreshGitHubClone advances a stored remote branch in lifecycle order", async () => {
  // arrange
  const remoteSha = "4444444444444444444444444444444444444444";
  const { gitOps, calls } = createGitOps({ resolveRefResult: remoteSha });
  const expectedCalls: GitCall[] = [
    { operation: "fetch", args: { dir: "/cache/branch", remote: "origin", ref: "release" } },
    {
      operation: "resolveRef",
      args: { dir: "/cache/branch", ref: "refs/remotes/origin/release" },
    },
    {
      operation: "forceUpdateRef",
      args: { dir: "/cache/branch", ref: "refs/heads/release", value: remoteSha },
    },
    { operation: "checkout", args: { dir: "/cache/branch", ref: "release" } },
  ];

  // act
  await refreshGitHubClone("/cache/branch", "release", gitOps);

  // assert
  assert.deepStrictEqual(calls, expectedCalls);
});

test("refreshGitHubClone treats only NotFoundError as a detached stored ref", async () => {
  // arrange
  const notFound = new Error("missing remote tag");
  notFound.name = "NotFoundError";
  const { gitOps, calls } = createGitOps({ resolveRefError: notFound });
  const expectedCalls: GitCall[] = [
    { operation: "fetch", args: { dir: "/cache/tag", remote: "origin", ref: "v1.2.3" } },
    {
      operation: "resolveRef",
      args: { dir: "/cache/tag", ref: "refs/remotes/origin/v1.2.3" },
    },
    { operation: "checkout", args: { dir: "/cache/tag", ref: "v1.2.3" } },
  ];

  // act
  await refreshGitHubClone("/cache/tag", "v1.2.3", gitOps);

  // assert
  assert.deepStrictEqual(calls, expectedCalls);
});

test("refreshGitHubClone propagates a non-NotFound ref failure without later work", async () => {
  // arrange
  const refError = Object.assign(new Error("cannot read packed refs"), { code: "EACCES" });
  const { gitOps, calls } = createGitOps({ resolveRefError: refError });
  let caught: unknown;

  // act
  try {
    await refreshGitHubClone("/cache/broken", "main", gitOps);
  } catch (error) {
    caught = error;
  }

  // assert
  assert.strictEqual(caught, refError);
  assert.deepStrictEqual(calls, [
    { operation: "fetch", args: { dir: "/cache/broken", remote: "origin", ref: "main" } },
    {
      operation: "resolveRef",
      args: { dir: "/cache/broken", ref: "refs/remotes/origin/main" },
    },
  ]);
});

test("refreshGitHubClone propagates fetch failure before callback and ref work", async () => {
  // arrange
  const fetchError = new Error("fetch failed");
  const { gitOps, calls } = createGitOps({ fetchError });
  const onFetchSucceeded = () => {
    calls.push({ operation: "fetchSucceeded" });
  };

  let caught: unknown;

  // act
  try {
    await refreshGitHubClone("/cache/fetch-failure", "main", gitOps, onFetchSucceeded);
  } catch (error) {
    caught = error;
  }

  // assert
  assert.strictEqual(caught, fetchError);
  assert.deepStrictEqual(calls, [
    {
      operation: "fetch",
      args: { dir: "/cache/fetch-failure", remote: "origin", ref: "main" },
    },
  ]);
});

for (const { title, scenario, storedRef, expectedCalls } of [
  {
    title: "current-branch failure",
    scenario: { currentBranchError: new Error("cannot read HEAD") },
    storedRef: undefined,
    expectedCalls: ["fetch", "resolveRef", "currentBranch"],
  },
  {
    title: "force-update failure",
    scenario: { forceUpdateRefError: new Error("cannot update branch") },
    storedRef: "main",
    expectedCalls: ["fetch", "resolveRef", "forceUpdateRef"],
  },
  {
    title: "checkout failure",
    scenario: { checkoutError: new Error("cannot checkout branch") },
    storedRef: "main",
    expectedCalls: ["fetch", "resolveRef", "forceUpdateRef", "checkout"],
  },
] satisfies readonly {
  readonly title: string;
  readonly scenario: GitScenario;
  readonly storedRef: string | undefined;
  readonly expectedCalls: readonly GitCall["operation"][];
}[]) {
  test(`refreshGitHubClone stops at ${title}`, async () => {
    // arrange
    const { gitOps, calls } = createGitOps(scenario);
    const expectedError =
      scenario.currentBranchError ?? scenario.forceUpdateRefError ?? scenario.checkoutError;
    let caught: unknown;

    // act
    try {
      await refreshGitHubClone("/cache/failure", storedRef, gitOps);
    } catch (error) {
      caught = error;
    }

    // assert
    assert.strictEqual(caught, expectedError);
    assert.deepStrictEqual(
      calls.map((call) => call.operation),
      expectedCalls,
    );
  });
}

test("cascadeUnstagePlugin returns every removed resource in five-kind order", async (t) => {
  // arrange
  const { locations } = await createProjectScope(t, "cascade-success");
  const { record, agentName } = await seedFullCascade(locations, "official", "sample");
  const expected: UnstageOutcome = {
    ok: true,
    dropped: {
      skills: ["sample-skill"],
      commands: ["sample-command"],
      agents: [agentName],
      hooks: ["sample"],
      mcpServers: ["sample-server"],
    },
  };

  // act
  const outcome = await cascadeUnstagePlugin("sample", "official", locations, record);

  // assert
  assert.deepStrictEqual(outcome, expected);
  assert.equal("cause" in outcome, false);
  assert.equal(Object.isFrozen(outcome), true);
  assert.equal(Object.isFrozen(outcome.dropped), true);
  assert.equal(Object.values(outcome.dropped).every(Object.isFrozen), true);
});

test("cascadeUnstagePlugin deletes the staged hooks subtree from the scope root", async (t) => {
  // arrange
  const { locations } = await createProjectScope(t, "cascade-hooks-subtree");
  const hookFile = path.join(locations.hooksDir, "sample", "hooks.json");
  await mkdir(path.dirname(hookFile), { recursive: true });
  await writeFile(hookFile, '{"hooks":{}}');
  const record = pluginRecord({ hooks: ["sample"] });

  // act
  const outcome = await cascadeUnstagePlugin("sample", "official", locations, record);

  // assert
  assert.equal(outcome.ok, true);
  assert.deepStrictEqual(outcome.dropped.hooks, ["sample"]);
  assert.deepStrictEqual(await readdir(locations.hooksDir), []);
});

test("cascadeUnstagePlugin stops before commands when skill validation fails", async (t) => {
  // arrange
  const { locations } = await createProjectScope(t, "cascade-skill-failure");
  const record = pluginRecord({ skills: ["../escape"], prompts: ["untouched"] });

  // act
  const outcome = await cascadeUnstagePlugin("sample", "official", locations, record);

  // assert
  assert.equal(outcome.ok, false);
  assert.deepStrictEqual(outcome.dropped, {
    skills: [],
    commands: [],
    agents: [],
    hooks: [],
    mcpServers: [],
  });
  assert.ok(outcome.cause instanceof Error);
  assert.equal(
    outcome.cause.message,
    'skill name to unstage "../escape" must not contain path separators.',
  );
});

test("cascadeUnstagePlugin normalizes a non-Error JavaScript boundary failure", async (t) => {
  // arrange
  const { locations } = await createProjectScope(t, "cascade-non-error-failure");
  const record = pluginRecord();
  Object.defineProperty(record.resources, "skills", {
    get(): never {
      // JavaScript collaborators can reject with unknown values even though
      // repository-owned bridges promise Error instances.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw "bridge rejected";
    },
  });

  // act
  const outcome = await cascadeUnstagePlugin("sample", "official", locations, record);

  // assert
  assert.equal(outcome.ok, false);
  assert.deepStrictEqual(outcome.dropped, {
    skills: [],
    commands: [],
    agents: [],
    hooks: [],
    mcpServers: [],
  });
  assert.ok(outcome.cause instanceof Error);
  assert.equal(outcome.cause.message, "bridge rejected");
});

test("cascadeUnstagePlugin preserves the skill partial when command containment fails", async (t) => {
  // arrange
  const { locations } = await createProjectScope(t, "cascade-command-failure");
  const skillDir = path.join(locations.skillsTargetDir, "sample-skill");
  await mkdir(skillDir, { recursive: true });
  await writeFile(path.join(skillDir, "SKILL.md"), "Skill.\n");
  const record = pluginRecord({ skills: ["sample-skill"], prompts: ["../escape"] });

  // act
  const outcome = await cascadeUnstagePlugin("sample", "official", locations, record);

  // assert
  assert.equal(outcome.ok, false);
  assert.deepStrictEqual(outcome.dropped, {
    skills: ["sample-skill"],
    commands: [],
    agents: [],
    hooks: [],
    mcpServers: [],
  });
  assert.ok(outcome.cause instanceof Error);
  assert.match(outcome.cause.message, /command to unstage/);
});

test("cascadeUnstagePlugin returns typed foreign-agent failure and stops before hooks", async (t) => {
  // arrange
  const { locations } = await createProjectScope(t, "cascade-agent-failure");
  const skillDir = path.join(locations.skillsTargetDir, "sample-skill");
  await mkdir(skillDir, { recursive: true });
  await writeFile(path.join(skillDir, "SKILL.md"), "Skill.\n");
  await mkdir(locations.promptsTargetDir, { recursive: true });
  await writeFile(path.join(locations.promptsTargetDir, "sample-command.md"), "Command.\n");
  const seededAgent = await seedAgent(
    locations,
    "official",
    "sample",
    "This file has no generated marker.\n",
  );
  const hookFile = path.join(locations.hooksDir, "sample", "hooks.json");
  await mkdir(path.dirname(hookFile), { recursive: true });
  await writeFile(hookFile, '{"hooks":{}}');
  const record = pluginRecord({
    skills: ["sample-skill"],
    prompts: ["sample-command"],
    agents: [seededAgent.generatedName],
    hooks: ["sample"],
  });

  // act
  const outcome = await cascadeUnstagePlugin("sample", "official", locations, record);

  // assert
  assert.equal(outcome.ok, false);
  assert.deepStrictEqual(outcome.dropped, {
    skills: ["sample-skill"],
    commands: ["sample-command"],
    agents: [],
    hooks: [],
    mcpServers: [],
  });
  assert.ok(outcome.cause instanceof AgentsUnstageFailureError);
  assert.deepStrictEqual(outcome.cause.failedAgents, [
    {
      generatedName: seededAgent.generatedName,
      targetPath: seededAgent.targetPath,
      reason: `target ${seededAgent.targetPath} is missing the generated marker`,
    },
  ]);
  await assert.doesNotReject(writeFile(hookFile, "still present\n"));
});

test("cascadeUnstagePlugin preserves earlier partials when hook name validation fails", async (t) => {
  // arrange
  const { locations } = await createProjectScope(t, "cascade-hook-failure");
  const skillDir = path.join(locations.skillsTargetDir, "sample-skill");
  await mkdir(skillDir, { recursive: true });
  await writeFile(path.join(skillDir, "SKILL.md"), "Skill.\n");
  await mkdir(locations.promptsTargetDir, { recursive: true });
  await writeFile(path.join(locations.promptsTargetDir, "sample-command.md"), "Command.\n");
  const record = pluginRecord({ skills: ["sample-skill"], prompts: ["sample-command"] });

  // act
  const outcome = await cascadeUnstagePlugin("..", "official", locations, record);

  // assert
  assert.equal(outcome.ok, false);
  assert.deepStrictEqual(outcome.dropped, {
    skills: ["sample-skill"],
    commands: ["sample-command"],
    agents: [],
    hooks: [],
    mcpServers: [],
  });
  assert.ok(outcome.cause instanceof Error);
  assert.equal(outcome.cause.message, 'hooks bridge plugin name must not be "." or "..".');
});

test("cascadeUnstagePlugin reports hook partial when malformed MCP JSON fails last", async (t) => {
  // arrange
  const { locations } = await createProjectScope(t, "cascade-mcp-failure");
  await mkdir(path.dirname(locations.mcpJsonPath), { recursive: true });
  await writeFile(locations.mcpJsonPath, "{");
  const record = pluginRecord({ mcpServers: ["sample-server"] });

  // act
  const outcome = await cascadeUnstagePlugin("sample", "official", locations, record);

  // assert
  assert.equal(outcome.ok, false);
  assert.deepStrictEqual(outcome.dropped, {
    skills: [],
    commands: [],
    agents: [],
    hooks: ["sample"],
    mcpServers: [],
  });
  assert.ok(outcome.cause instanceof Error);
  assert.match(outcome.cause.message, /malformed JSON/);
});

for (const { title, state, name, enable, expected } of [
  {
    title: "changes a named legacy-disabled marketplace when enabling",
    state: {
      schemaVersion: 2,
      marketplaces: { alpha: legacyAutoupdateRecord("alpha", false) },
    },
    name: "alpha",
    enable: true,
    expected: { changed: ["alpha"], unchanged: [] },
  },
  {
    title: "keeps a named legacy-enabled marketplace unchanged when enabling",
    state: {
      schemaVersion: 2,
      marketplaces: { alpha: legacyAutoupdateRecord("alpha", true) },
    },
    name: "alpha",
    enable: true,
    expected: { changed: [], unchanged: ["alpha"] },
  },
  {
    title: "reads an absent legacy flag as disabled when disabling",
    state: {
      schemaVersion: 2,
      marketplaces: { alpha: legacyAutoupdateRecord("alpha", undefined) },
    },
    name: "alpha",
    enable: false,
    expected: { changed: [], unchanged: ["alpha"] },
  },
  {
    title: "reads an absent legacy flag as disabled when enabling",
    state: {
      schemaVersion: 2,
      marketplaces: { alpha: legacyAutoupdateRecord("alpha", undefined) },
    },
    name: "alpha",
    enable: true,
    expected: { changed: ["alpha"], unchanged: [] },
  },
] satisfies readonly {
  readonly title: string;
  readonly state: ExtensionState;
  readonly name: string;
  readonly enable: boolean;
  readonly expected: AutoupdateFlipResult;
}[]) {
  test(`classifyAutoupdateFlip ${title}`, () => {
    // arrange
    const expectedResult = expected;

    // act
    const result = classifyAutoupdateFlip(state, name, enable);

    // assert
    assert.deepStrictEqual(result, expectedResult);
  });
}

test("classifyAutoupdateFlip partitions every marketplace in stored order", () => {
  // arrange
  const state: ExtensionState = {
    schemaVersion: 2,
    marketplaces: {
      alpha: legacyAutoupdateRecord("alpha", true),
      bravo: legacyAutoupdateRecord("bravo", false),
      charlie: legacyAutoupdateRecord("charlie", true),
    },
  };
  const expected: AutoupdateFlipResult = {
    changed: ["bravo"],
    unchanged: ["alpha", "charlie"],
  };

  // act
  const result = classifyAutoupdateFlip(state, undefined, true);

  // assert
  assert.deepStrictEqual(result, expected);
});

test("classifyAutoupdateFlip throws the complete missing-marketplace error", () => {
  // arrange
  const state: ExtensionState = { schemaVersion: 2, marketplaces: {} };

  // act & assert
  assert.throws(
    () => classifyAutoupdateFlip(state, "missing", true),
    (error: unknown) => {
      assert.ok(error instanceof MarketplaceNotFoundError);
      assert.equal(error.name, "MarketplaceNotFoundError");
      assert.equal(error.message, 'Marketplace "missing" not found in any scopes.');
      assert.equal(error.mpName, "missing");
      assert.deepStrictEqual(error.scopes, []);
      return true;
    },
  );
});

test("resolveScopeFromState gives project scope precedence when both scopes contain the name", async (t) => {
  // arrange
  const user = await createProjectScope(t, "resolve-both-user");
  const project = await createProjectScope(t, "resolve-both-project");
  await saveMarketplaces(user.locations, [marketplaceRecord("official", "user", user.cwd)]);
  await saveMarketplaces(project.locations, [
    marketplaceRecord("official", "project", project.cwd),
  ]);
  const expected = { scope: "project", locations: project.locations };

  // act
  const resolved = await resolveScopeFromState("official", user.locations, project.locations);

  // assert
  assert.deepStrictEqual(resolved, expected);
  assert.strictEqual(resolved.locations, project.locations);
});

test("resolveScopeFromState selects the sole user-scope record", async (t) => {
  // arrange
  const user = await createProjectScope(t, "resolve-user-user");
  const project = await createProjectScope(t, "resolve-user-project");
  await saveMarketplaces(user.locations, [marketplaceRecord("official", "user", user.cwd)]);
  await saveMarketplaces(project.locations, []);
  const expected = { scope: "user", locations: user.locations };

  // act
  const resolved = await resolveScopeFromState("official", user.locations, project.locations);

  // assert
  assert.deepStrictEqual(resolved, expected);
  assert.strictEqual(resolved.locations, user.locations);
});

test("resolveScopeFromState throws complete project-before-user absence diagnostics", async (t) => {
  // arrange
  const user = await createProjectScope(t, "resolve-missing-user");
  const project = await createProjectScope(t, "resolve-missing-project");
  await saveMarketplaces(user.locations, []);
  await saveMarketplaces(project.locations, []);
  let caught: unknown;

  // act
  try {
    await resolveScopeFromState("missing", user.locations, project.locations);
  } catch (error) {
    caught = error;
  }

  // assert
  assert.ok(caught instanceof MarketplaceNotFoundError);
  assert.equal(caught.name, "MarketplaceNotFoundError");
  assert.equal(caught.message, 'Marketplace "missing" not found in project, user scopes.');
  assert.equal(caught.mpName, "missing");
  assert.deepStrictEqual(caught.scopes, ["project", "user"]);
});

test("resolveScopeOrNotifyNotAdded returns a bare resolved scope without notification", async (t) => {
  // arrange
  const user = await createProjectScope(t, "notify-present-user");
  const project = await createProjectScope(t, "notify-present-project");
  await saveMarketplaces(user.locations, []);
  await saveMarketplaces(project.locations, [
    marketplaceRecord("official", "project", project.cwd),
  ]);
  const boundary = notificationBoundary();
  const expected = { scope: "project", locations: project.locations };

  // act
  const resolved = await resolveScopeOrNotifyNotAdded(
    { ctx: boundary.ctx, pi: boundary.pi, name: "official" },
    user.locations,
    project.locations,
  );

  // assert
  assert.deepStrictEqual(resolved, expected);
  boundary.verifyAll();
});

test("resolveScopeOrNotifyNotAdded emits exact bytes for a bare miss", async (t) => {
  // arrange
  const user = await createProjectScope(t, "notify-missing-user");
  const project = await createProjectScope(t, "notify-missing-project");
  await saveMarketplaces(user.locations, []);
  await saveMarketplaces(project.locations, []);
  const boundary = notificationBoundary({
    message: "A marketplace operation has failed.\n\n⊘ missing (failed) {not added}",
    severity: "error",
  });

  // act
  const resolved = await resolveScopeOrNotifyNotAdded(
    { ctx: boundary.ctx, pi: boundary.pi, name: "missing" },
    user.locations,
    project.locations,
  );

  // assert
  assert.equal(resolved, undefined);
  boundary.verifyAll();
});

test("resolveScopeOrNotifyNotAdded rethrows a non-not-found read failure without notification", async (t) => {
  // arrange
  const user = await createProjectScope(t, "notify-invalid-user");
  const project = await createProjectScope(t, "notify-invalid-project");
  await writeFile(path.join(user.locations.extensionRoot, "state.json"), "{");
  await saveMarketplaces(project.locations, []);
  const boundary = notificationBoundary();
  let caught: unknown;

  // act
  try {
    await resolveScopeOrNotifyNotAdded(
      { ctx: boundary.ctx, pi: boundary.pi, name: "official" },
      user.locations,
      project.locations,
    );
  } catch (error) {
    caught = error;
  }

  // assert
  assert.ok(caught instanceof Error);
  assert.match(caught.message, /is not valid JSON/);
  boundary.verifyAll();
});

for (const scope of ["project", "user"] satisfies readonly Scope[]) {
  test(`resolveScopeOrNotifyNotAdded returns an existing explicit ${scope} scope`, async (t) => {
    // arrange
    const user = await createProjectScope(t, `notify-explicit-${scope}-user`);
    const project = await createProjectScope(t, `notify-explicit-${scope}-project`);
    await saveMarketplaces(user.locations, [marketplaceRecord("official", "user", user.cwd)]);
    await saveMarketplaces(project.locations, [
      marketplaceRecord("official", "project", project.cwd),
    ]);
    const boundary = notificationBoundary();
    const expectedLocations = scope === "user" ? user.locations : project.locations;
    const expected = { scope, locations: expectedLocations };

    // act
    const resolved = await resolveScopeOrNotifyNotAdded(
      { ctx: boundary.ctx, pi: boundary.pi, name: "official", scope },
      user.locations,
      project.locations,
    );

    // assert
    assert.deepStrictEqual(resolved, expected);
    assert.strictEqual(resolved?.locations, expectedLocations);
    boundary.verifyAll();
  });
}

test("resolveScopeOrNotifyNotAdded emits exact scoped bytes for an explicit miss", async (t) => {
  // arrange
  const user = await createProjectScope(t, "notify-explicit-missing-user");
  const project = await createProjectScope(t, "notify-explicit-missing-project");
  await saveMarketplaces(user.locations, []);
  await saveMarketplaces(project.locations, []);
  const boundary = notificationBoundary({
    message: "A marketplace operation has failed.\n\n⊘ missing [user] (failed) {not added}",
    severity: "error",
  });

  // act
  const resolved = await resolveScopeOrNotifyNotAdded(
    { ctx: boundary.ctx, pi: boundary.pi, name: "missing", scope: "user" },
    user.locations,
    project.locations,
  );

  // assert
  assert.equal(resolved, undefined);
  boundary.verifyAll();
});

test("loadVisibleMarketplaces preserves input record order in one selected scope", async (t) => {
  // arrange
  const { cwd, locations } = await createProjectScope(t, "visible-project");
  const alpha = marketplaceRecord("alpha", "project", cwd);
  const bravo = marketplaceRecord("bravo", "project", cwd);
  await saveMarketplaces(locations, [alpha, bravo]);
  const expected = [
    {
      scope: "project",
      record: {
        name: "alpha",
        scope: "project",
        source: { kind: "path", raw: "./alpha", logical: "./alpha" },
        addedFromCwd: cwd,
        manifestPath: path.join(cwd, "alpha.marketplace.json"),
        marketplaceRoot: path.join(cwd, "alpha"),
        plugins: {},
      },
    },
    {
      scope: "project",
      record: {
        name: "bravo",
        scope: "project",
        source: { kind: "path", raw: "./bravo", logical: "./bravo" },
        addedFromCwd: cwd,
        manifestPath: path.join(cwd, "bravo.marketplace.json"),
        marketplaceRoot: path.join(cwd, "bravo"),
        plugins: {},
      },
    },
  ];

  // act
  const visible = await loadVisibleMarketplaces({ cwd, scope: "project" });

  // assert
  assert.deepStrictEqual(visible, expected);
});

test("loadVisibleMarketplaces enumerates project before user and preserves each block order", async (t) => {
  // arrange
  const { cwd, userLocations, projectLocations } = await createHermeticScopes(t, "visible-both");
  await saveMarketplaces(projectLocations, [
    marketplaceRecord("project-alpha", "project", cwd),
    marketplaceRecord("project-bravo", "project", cwd),
  ]);
  await saveMarketplaces(userLocations, [
    marketplaceRecord("user-alpha", "user", cwd),
    marketplaceRecord("user-bravo", "user", cwd),
  ]);
  const expectedNames = ["project-alpha", "project-bravo", "user-alpha", "user-bravo"];
  const expectedScopes: Scope[] = ["project", "project", "user", "user"];

  // act
  const visible = await loadVisibleMarketplaces({ cwd });

  // assert
  assert.deepStrictEqual(
    visible.map(({ record }) => record.name),
    expectedNames,
  );
  assert.deepStrictEqual(
    visible.map(({ scope }) => scope),
    expectedScopes,
  );
  assert.equal(visible.length, 4);
});

test("loadVisibleMarketplaces rejects a later user read after the project block", async (t) => {
  // arrange
  const { cwd, userLocations, projectLocations } = await createHermeticScopes(
    t,
    "visible-user-failure",
  );
  await saveMarketplaces(projectLocations, [marketplaceRecord("project-alpha", "project", cwd)]);
  await mkdir(userLocations.extensionRoot, { recursive: true });
  await writeFile(path.join(userLocations.extensionRoot, "state.json"), "{");

  // act & assert
  await assert.rejects(loadVisibleMarketplaces({ cwd }), /is not valid JSON/);
});

for (const { title, cause, expected } of [
  {
    title: "foreign agent ownership",
    cause: new AgentsUnstageFailureError("foreign agent", [
      { generatedName: "agent", targetPath: "/agents/agent.md", reason: "foreign content" },
    ]),
    expected: "source mismatch",
  },
  {
    title: "EACCES errno",
    cause: Object.assign(new Error("opaque"), { code: "EACCES" }),
    expected: "permission denied",
  },
  {
    title: "ENOENT errno",
    cause: Object.assign(new Error("opaque"), { code: "ENOENT" }),
    expected: "source missing",
  },
  {
    title: "EPERM errno",
    cause: Object.assign(new Error("opaque"), { code: "EPERM" }),
    expected: "permission denied",
  },
  {
    title: "unknown errno with unreadable text",
    cause: Object.assign(new Error("manifest unreadable"), { code: "EIO" }),
    expected: "unreadable",
  },
  {
    title: "unparseable text",
    cause: new Error("manifest is UNPARSEABLE"),
    expected: "unparseable",
  },
  {
    title: "explicit not-in-manifest text",
    cause: new Error("plugin not in manifest"),
    expected: "not in manifest",
  },
  {
    title: "unclassified fallback",
    cause: new Error("unexpected cascade failure"),
    expected: "not in manifest",
  },
] satisfies readonly {
  readonly title: string;
  readonly cause: Error;
  readonly expected:
    | "source mismatch"
    | "permission denied"
    | "source missing"
    | "unreadable"
    | "unparseable"
    | "not in manifest";
}[]) {
  test(`narrowCascadeFailure maps ${title} to its closed reason`, () => {
    // arrange
    const expectedReason = expected;

    // act
    const reason = narrowCascadeFailure(cause);

    // assert
    assert.equal(reason, expectedReason);
  });
}
