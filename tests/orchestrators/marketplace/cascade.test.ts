import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { cascadeUnstagePlugin } from "../../../extensions/claude-marketplace/orchestrators/marketplace/shared.ts";
import { locationsFor } from "../../../extensions/claude-marketplace/persistence/locations.ts";

import type { ExtensionState } from "../../../extensions/claude-marketplace/persistence/state-io.ts";

type PluginRecord = ExtensionState["marketplaces"][string]["plugins"][string];

function makePluginRecord(
  over: Partial<PluginRecord> & { resources?: Partial<PluginRecord["resources"]> } = {},
): PluginRecord {
  return {
    version: over.version ?? "0.0.1",
    resolvedSource: over.resolvedSource ?? "/tmp",
    compatibility: over.compatibility ?? {
      installable: true,
      notes: [],
      supported: [],
      unsupported: [],
    },
    resources: {
      skills: over.resources?.skills ?? [],
      prompts: over.resources?.prompts ?? [],
      agents: over.resources?.agents ?? [],
      mcpServers: over.resources?.mcpServers ?? [],
    },
    installedAt: over.installedAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: over.updatedAt ?? "2026-01-01T00:00:00.000Z",
  };
}

async function withTmpScope<T>(
  fn: (env: { cwd: string; locations: ReturnType<typeof locationsFor> }) => Promise<T>,
): Promise<T> {
  const cwd = await mkdtemp(path.join(tmpdir(), "mp-cascade-"));
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  try {
    return await fn({ cwd, locations });
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

test("cascadeUnstagePlugin (a): empty resources -- all bridges return cleanly with empty dropped", async () => {
  await withTmpScope(async ({ locations }) => {
    const outcome = await cascadeUnstagePlugin(
      "hello",
      "valid-marketplace",
      locations,
      makePluginRecord({ resources: { skills: [], prompts: [], agents: [], mcpServers: [] } }),
    );
    assert.equal(outcome.ok, true);
    assert.deepEqual(outcome.dropped, { skills: [], commands: [], agents: [], mcpServers: [] });
    assert.equal(outcome.cause, undefined);
  });
});

test("cascadeUnstagePlugin (a): real skills unstage path -- pre-staged skill is dropped", async () => {
  await withTmpScope(async ({ locations }) => {
    // Pre-stage a skill at <skillsTargetDir>/hello-greet/SKILL.md (the
    // path the skills bridge expects for an installed skill named
    // "hello-greet").
    const skillDir = path.join(locations.skillsTargetDir, "hello-greet");
    await mkdir(skillDir, { recursive: true });
    await writeFile(path.join(skillDir, "SKILL.md"), "---\nname: hello-greet\n---\nbody\n");

    const outcome = await cascadeUnstagePlugin(
      "hello",
      "valid-marketplace",
      locations,
      makePluginRecord({
        resources: { skills: ["hello-greet"], prompts: [], agents: [], mcpServers: [] },
      }),
    );
    assert.equal(outcome.ok, true);
    assert.deepEqual(outcome.dropped.skills, ["hello-greet"]);
  });
});

test("cascadeUnstagePlugin (c): bogus locations -- agents-index.json IO surface assertion (shape)", async () => {
  // We trip the agents bridge by passing a locations bundle that points
  // at a path the bridge cannot create or read. Create a regular file
  // where the agents bridge expects a directory (or vice versa). The
  // exact failure mode is bridge-specific -- this test asserts the
  // SHAPE: outcome.ok === false and outcome.cause is set, OR outcome.ok
  // === true and outcome.dropped.agents is [] (the cascade primitive's
  // contract is satisfied either way).
  await withTmpScope(async ({ locations }) => {
    // Pre-place a regular FILE at agents-staging path so any bridge
    // attempt to create that directory will fail with ENOTDIR.
    await writeFile(locations.agentsStagingDir, "not-a-directory");

    const outcome = await cascadeUnstagePlugin(
      "hello",
      "valid-marketplace",
      locations,
      // Force the agents path: by giving a skills source dir that doesn't
      // exist, the skills bridge no-ops silently (idempotent); but the
      // agents bridge's lstat against agentsStagingDir will fail.
      makePluginRecord({
        resources: {
          skills: [],
          prompts: [],
          agents: ["claude-marketplace-hello-greet-agent"],
          mcpServers: [],
        },
      }),
    );
    // The cascade primitive may catch into ok:false OR may pass through
    // skills/commands cleanly and only fail at agents -- assert the
    // shape, not the specific bridge.
    if (outcome.ok === false) {
      assert.ok(outcome.cause instanceof Error);
    } else {
      // If the agents bridge accommodates this case as a clean miss,
      // the cascade returns ok:true with empty dropped -- that is also
      // acceptable; the test guards the SHAPE.
      assert.deepEqual(outcome.dropped.agents, []);
    }
  });
});
