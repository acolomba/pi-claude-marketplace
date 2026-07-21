// tests/integration/provenance-invisibility.test.ts
//
// T-d8i-01 headline safety claim, verified against pi-subagents' OWN parser:
// the provenance folded under the frontmatter `provenance:` mapping stays
// invisible to the child subagent. The child subagent's system prompt is
// exactly the `body` that pi-subagents' `parseFrontmatter` returns
// (agents.ts loads an agent file with `parseFrontmatter(content)` and sets
// `systemPrompt: body`), so running a real `emitGeneratedAgentFile(...)`
// output through that parser and inspecting its `body` + top-level
// `frontmatter` keys is the load-bearing check -- not this extension's own
// line-based parseFrontmatter (which trims lines and does NOT mirror
// pi-subagents' anchored `^([\w-]+):` key regex over indented content).
//
// pi-subagents is an OPTIONAL peer. Its package.json `exports` map exposes
// only ".", "./background-work", and "./delegation", so the agent frontmatter
// parser (src/agents/frontmatter.ts) cannot be imported by a bare specifier
// subpath. It also cannot be imported directly from node_modules: Node
// refuses native TypeScript type-stripping for any file whose resolved path
// contains a `node_modules` segment. This test reuses skill-path-resolution's
// pattern -- copy the installed package's real `src/` tree into a scratch
// directory outside node_modules and import the module by absolute file path
// via `pathToFileURL`, skipping gracefully on any failure so `npm run check`
// stays green where the optional peer is absent.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

import {
  emitGeneratedAgentFile,
  GENERATED_AGENT_MARKER,
} from "../../extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts";

interface PiSubagentsFrontmatterModule {
  readonly parseFrontmatter: (content: string) => {
    frontmatter: Record<string, string>;
    body: string;
  };
}

/**
 * Locates the installed pi-subagents package root. Checks an env override
 * first, then falls back to the conventional global npm install location
 * (`npm root -g`) -- identical to skill-path-resolution.test.ts.
 */
function resolvePiSubagentsPackageRoot(): string | undefined {
  const override = process.env.PI_SUBAGENTS_ROOT;
  if (override) {
    return override;
  }

  try {
    const globalNodeModules = execFileSync("npm", ["root", "-g"], {
      encoding: "utf8",
      timeout: 5000,
    }).trim();
    return globalNodeModules ? path.join(globalNodeModules, "pi-subagents") : undefined;
  } catch {
    // Global npm root lookup is best-effort; treated as "not reachable".
    return undefined;
  }
}

/**
 * Copies the installed package's real `src/` tree into
 * `<scratchRoot>/pi-subagents-src` (outside node_modules, sidestepping Node's
 * node_modules type-stripping restriction) and dynamically imports the agent
 * frontmatter parser module from there by absolute file path. Returns
 * undefined on ANY failure so callers can skip the test gracefully rather
 * than fail on absence.
 */
async function loadPiSubagentsFrontmatterModule(
  scratchRoot: string,
): Promise<PiSubagentsFrontmatterModule | undefined> {
  const packageRoot = resolvePiSubagentsPackageRoot();
  if (!packageRoot) {
    return undefined;
  }

  const installedSrcDir = path.join(packageRoot, "src");
  if (!existsSync(installedSrcDir)) {
    return undefined;
  }

  const scratchSrcDir = path.join(scratchRoot, "pi-subagents-src");
  try {
    await cp(installedSrcDir, scratchSrcDir, { recursive: true });
  } catch {
    return undefined;
  }

  const frontmatterModulePath = path.join(scratchSrcDir, "agents", "frontmatter.ts");
  if (!existsSync(frontmatterModulePath)) {
    return undefined;
  }

  try {
    return (await import(
      pathToFileURL(frontmatterModulePath).href
    )) as PiSubagentsFrontmatterModule;
  } catch {
    return undefined;
  }
}

test("T-d8i-01: provenance stays invisible to pi-subagents' own frontmatter parser", async (t) => {
  const tmpRoot = await mkdtemp(path.join(tmpdir(), "provenance-invis-"));
  try {
    const fm = await loadPiSubagentsFrontmatterModule(tmpRoot);
    if (!fm) {
      t.skip("pi-subagents frontmatter parser not reachable in this environment");
      return;
    }

    // A distinctive body so any provenance leak into the child system prompt
    // is unambiguous. Provenance values are equally distinctive.
    const bodyText = "CHILD SYSTEM PROMPT: perform the delegated task and report.";
    const agentFileContent = emitGeneratedAgentFile({
      frontmatter: {
        name: "pi-claude-marketplace-acme-bot",
        description: "An agent.",
        model: "anthropic/claude-sonnet-4-6",
        tools: ["read", "bash"],
        skills: ["acme-knowledge"],
        inheritSkills: true,
      },
      provenance: {
        pluginName: "acme",
        sourceName: "bot",
        sourcePath: "/abs/provenance-source.md",
        originalModel: "sonnet",
        // Exercises BOTH list forms: a non-empty block list (droppedFields,
        // warnings, each rendered `    - item`) and an empty inline `[]`
        // (droppedTools) -- the two shapes the safety claim must survive.
        droppedFields: ["provColorField"],
        droppedTools: [],
        warnings: ["provWarningText leaked check"],
      },
      body: bodyText,
    });

    const { frontmatter, body } = fm.parseFrontmatter(agentFileContent);

    // (a) The parsed body IS the child subagent's system prompt. It must carry
    //     none of the provenance keys, values, or the generated marker.
    const provenanceLeaks = [
      // keys
      "generatedBy",
      "sourcePlugin",
      "sourceAgent",
      "sourcePath",
      "originalModel",
      "droppedFields",
      "droppedTools",
      "warnings",
      // marker text
      GENERATED_AGENT_MARKER,
      // values
      "provColorField",
      "provWarningText",
      "/abs/provenance-source.md",
    ];
    for (const needle of provenanceLeaks) {
      assert.ok(
        !body.includes(needle),
        `child system prompt (body) must not contain provenance token ${JSON.stringify(needle)}`,
      );
    }

    // The boundary landed exactly at the closing `---`: the body pi-subagents
    // hands the child is precisely the source body (their parser .trim()s it),
    // proving the nested provenance block did not shift the frontmatter/body
    // split into the prompt.
    assert.equal(body, bodyText);

    // (b) None of the provenance member keys surfaced as TOP-LEVEL config
    //     keys -- pi-subagents folded the whole indented block under the single
    //     `provenance` key and never re-parsed its members.
    for (const provKey of [
      "generatedBy",
      "sourcePlugin",
      "sourceAgent",
      "sourcePath",
      "originalModel",
      "droppedFields",
      "droppedTools",
      "warnings",
    ]) {
      assert.equal(
        frontmatter[provKey],
        undefined,
        `provenance member ${provKey} must not become a top-level frontmatter key`,
      );
    }

    // The real top-level config keys parsed correctly (the boundary and key
    // set were not corrupted by the appended provenance mapping).
    assert.equal(frontmatter.name, "pi-claude-marketplace-acme-bot");
    assert.equal(frontmatter.model, "anthropic/claude-sonnet-4-6");
    assert.equal(frontmatter.tools, "read,bash");
    assert.equal(frontmatter.skills, "acme-knowledge");
    assert.equal(frontmatter.inheritSkills, "true");

    // The provenance block rode along as the single `provenance` key's value
    // (a multi-line string), carrying the marker -- so isOwnedAgentFile's
    // whole-file substring check still matches while the child never sees it.
    assert.ok(
      frontmatter.provenance?.includes(GENERATED_AGENT_MARKER),
      "the provenance mapping value must carry the generated marker",
    );
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
});
