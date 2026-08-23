import assert from "node:assert/strict";
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { discoverPluginSkills } from "../../../extensions/pi-claude-marketplace/bridges/skills/discover.ts";
import { cleanupStaging } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";

import type { ResolvedPluginInstallable } from "../../../extensions/pi-claude-marketplace/domain/resolver.ts";

// Resolve fixture root relative to THIS file (worktree-safe; do NOT use cwd).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, "..", "_fixtures");

function makeResolved(
  pluginRoot: string,
  skillsDirAbs: string | undefined,
): ResolvedPluginInstallable {
  // D-07: componentPaths.skills is `readonly string[]`. Tests pass the
  // absolute fixture dir directly (verbatim element); the bridge accepts
  // both absolute and relative-to-pluginRoot elements.
  return {
    state: "installable",
    name: "acme",
    pluginRoot,
    supported: [],
    unsupported: [],
    notes: [],
    componentPaths: {
      skills: skillsDirAbs === undefined ? [] : [skillsDirAbs],
      commands: [],
      agents: [],
    },
    mcpServers: {},
    defaultEnabled: true,
  };
}

test("SK-5 discoverPluginSkills returns sorted DiscoveredSkill[] for fixture plugin", async () => {
  const pluginRoot = path.join(FIXTURES, "test-plugin");
  const skillsDir = path.join(pluginRoot, "skills");
  const resolved = makeResolved(pluginRoot, skillsDir);

  const { discovered, warnings } = await discoverPluginSkills({ pluginName: "acme", resolved });
  assert.equal(discovered.length, 2, "expected 2 discovered skills");
  assert.deepEqual([...warnings], [], "no warnings expected on happy path");

  // Alphabetic sort: "acme-knowledge" < "helper".
  assert.equal(discovered[0]!.sourceName, "acme-knowledge");
  assert.equal(discovered[1]!.sourceName, "helper");
});

test("SK-2 discoverPluginSkills generates name 'acme-knowledge' (elided) for source already prefixed", async () => {
  const pluginRoot = path.join(FIXTURES, "test-plugin");
  const skillsDir = path.join(pluginRoot, "skills");
  const resolved = makeResolved(pluginRoot, skillsDir);

  const { discovered } = await discoverPluginSkills({ pluginName: "acme", resolved });
  const acmeKnowledge = discovered.find((s) => s.sourceName === "acme-knowledge");
  assert.ok(acmeKnowledge, "acme-knowledge entry missing");
  assert.equal(acmeKnowledge.generatedName, "acme-knowledge");
});

test("SK-2 discoverPluginSkills generates name 'acme-helper' for unprefixed source", async () => {
  const pluginRoot = path.join(FIXTURES, "test-plugin");
  const skillsDir = path.join(pluginRoot, "skills");
  const resolved = makeResolved(pluginRoot, skillsDir);

  const { discovered } = await discoverPluginSkills({ pluginName: "acme", resolved });
  const helper = discovered.find((s) => s.sourceName === "helper");
  assert.ok(helper, "helper entry missing");
  assert.equal(helper.generatedName, "acme-helper");
});

test("SK-5 discoverPluginSkills returns [] when skills dir missing (ENOENT graceful)", async () => {
  // empty-mcp fixture has no `skills/` dir.
  const pluginRoot = path.join(FIXTURES, "empty-mcp");
  const skillsDir = path.join(pluginRoot, "skills");
  const resolved = makeResolved(pluginRoot, skillsDir);

  const { discovered, warnings } = await discoverPluginSkills({ pluginName: "acme", resolved });
  assert.deepEqual([...discovered], []);
  assert.deepEqual([...warnings], []);
});

test("SK-5 discoverPluginSkills returns [] when componentPaths.skills is empty", async () => {
  const resolved = makeResolved("/anywhere", undefined);
  const { discovered, warnings } = await discoverPluginSkills({ pluginName: "acme", resolved });
  assert.deepEqual([...discovered], []);
  assert.deepEqual([...warnings], []);
});

test("discoverPluginSkills skips dotfile-prefixed directories", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-dotfiles-"));
  try {
    const skillsDir = path.join(tmp, "skills");
    await mkdir(skillsDir, { recursive: true });
    // Hidden dir with SKILL.md should be skipped.
    await mkdir(path.join(skillsDir, ".hidden"));
    await writeFile(path.join(skillsDir, ".hidden", "SKILL.md"), "---\nname: x\n---\nbody");
    // Visible dir should be included.
    await mkdir(path.join(skillsDir, "visible"));
    await writeFile(path.join(skillsDir, "visible", "SKILL.md"), "---\nname: visible\n---\nbody");

    const resolved = makeResolved(tmp, skillsDir);
    const { discovered } = await discoverPluginSkills({ pluginName: "acme", resolved });
    assert.equal(discovered.length, 1);
    assert.equal(discovered[0]!.sourceName, "visible");
  } finally {
    await cleanupStaging(tmp, "test-cleanup");
  }
});

test("discoverPluginSkills skips entries without SKILL.md", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-no-skillmd-"));
  try {
    const skillsDir = path.join(tmp, "skills");
    await mkdir(skillsDir, { recursive: true });
    // Dir without SKILL.md should be skipped.
    await mkdir(path.join(skillsDir, "no-skill-md"));
    await writeFile(path.join(skillsDir, "no-skill-md", "README.md"), "no skill here");
    // Dir with SKILL.md present.
    await mkdir(path.join(skillsDir, "with-skill"));
    await writeFile(path.join(skillsDir, "with-skill", "SKILL.md"), "---\nname: with-skill\n---");

    const resolved = makeResolved(tmp, skillsDir);
    const { discovered } = await discoverPluginSkills({ pluginName: "acme", resolved });
    assert.equal(discovered.length, 1);
    assert.equal(discovered[0]!.sourceName, "with-skill");
  } finally {
    await cleanupStaging(tmp, "test-cleanup");
  }
});

test("discoverPluginSkills skips symlinked skill dirs (T-03-15 hardening)", async (t) => {
  if (process.platform === "win32") {
    t.skip("symlink semantics differ on Windows");
    return;
  }

  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-symlink-"));
  try {
    const skillsDir = path.join(tmp, "skills");
    await mkdir(skillsDir, { recursive: true });
    // Real directory outside skillsDir.
    const elsewhere = path.join(tmp, "elsewhere");
    await mkdir(elsewhere);
    await writeFile(path.join(elsewhere, "SKILL.md"), "---\nname: evil\n---");
    // Symlink inside skillsDir pointing to elsewhere.
    await symlink(elsewhere, path.join(skillsDir, "evil-link"));
    // Plus a regular skill so we know discovery itself ran.
    await mkdir(path.join(skillsDir, "real-skill"));
    await writeFile(path.join(skillsDir, "real-skill", "SKILL.md"), "---\nname: real\n---");

    const resolved = makeResolved(tmp, skillsDir);
    const { discovered } = await discoverPluginSkills({ pluginName: "acme", resolved });
    assert.equal(discovered.length, 1);
    assert.equal(discovered[0]!.sourceName, "real-skill");
  } finally {
    await cleanupStaging(tmp, "test-cleanup");
  }
});

// ──────────────────────────────────────────────────────────────────────────
// D-07 (COMP-01): multi-element componentPaths.skills with first-wins dedup.
// ──────────────────────────────────────────────────────────────────────────

test("D-07 discoverPluginSkills iterates multi-element componentPaths.skills (no collision)", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-multi-"));
  try {
    // Two independent skills dirs, no overlap.
    const a = path.join(tmp, "a");
    const b = path.join(tmp, "b");
    await mkdir(path.join(a, "one"), { recursive: true });
    await writeFile(path.join(a, "one", "SKILL.md"), "---\nname: one\n---\nbody");
    await mkdir(path.join(b, "two"), { recursive: true });
    await writeFile(path.join(b, "two", "SKILL.md"), "---\nname: two\n---\nbody");

    const resolved: ResolvedPluginInstallable = {
      state: "installable",
      name: "acme",
      pluginRoot: tmp,
      supported: ["skills"],
      unsupported: [],
      notes: [],
      componentPaths: { skills: [a, b], commands: [], agents: [] },
      mcpServers: {},
      defaultEnabled: true,
    };

    const { discovered, warnings } = await discoverPluginSkills({ pluginName: "acme", resolved });
    assert.equal(discovered.length, 2, "both dirs' sources discovered");
    const names = discovered.map((d) => d.sourceName).sort();
    assert.deepEqual(names, ["one", "two"]);
    assert.deepEqual([...warnings], [], "no warnings when generated names disjoint");
  } finally {
    await cleanupStaging(tmp, "test-cleanup");
  }
});

test("D-07 discoverPluginSkills first-wins dedup across array elements (collision -> warning)", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-dedup-"));
  try {
    // Dir `a` holds `acme-shared/`, dir `b` holds `shared/`. Both elide to
    // the generated name "acme-shared" (SK-2 drops the `acme-` head and
    // re-prefixes). First-wins: dir `a` is kept; dir `b` surfaces a soft-fail
    // warning. The two source names are deliberately DIFFERENT so the exact
    // string below discriminates the winner from the loser -- with both named
    // "shared" it read the same whichever the code passed. The within-entry
    // case takes the same branch and is covered by the D-141-04 test below.
    const a = path.join(tmp, "a");
    const b = path.join(tmp, "b");
    await mkdir(path.join(a, "acme-shared"), { recursive: true });
    await writeFile(path.join(a, "acme-shared", "SKILL.md"), "---\nname: shared\n---\nfrom-a");
    await mkdir(path.join(b, "shared"), { recursive: true });
    await writeFile(path.join(b, "shared", "SKILL.md"), "---\nname: shared\n---\nfrom-b");

    const resolved: ResolvedPluginInstallable = {
      state: "installable",
      name: "acme",
      pluginRoot: tmp,
      supported: ["skills"],
      unsupported: [],
      notes: [],
      componentPaths: { skills: [a, b], commands: [], agents: [] },
      mcpServers: {},
      defaultEnabled: true,
    };

    const { discovered, warnings } = await discoverPluginSkills({ pluginName: "acme", resolved });
    assert.equal(discovered.length, 1, "first-wins keeps only one");
    assert.equal(discovered[0]!.skillDir, path.join(a, "acme-shared"), "dir 'a' wins");
    assert.equal(discovered[0]!.sourceName, "acme-shared");
    assert.equal(warnings.length, 1);
    // The warning names the WINNING source, not an "earlier entry".
    assert.equal(
      warnings[0],
      `skill source "shared" in "${b}" elides to generated name "acme-shared", ` +
        `already produced by skill source "acme-shared"; ignoring duplicate.`,
    );
  } finally {
    await cleanupStaging(tmp, "test-cleanup");
  }
});

test("D-141-04 two skill dirs under ONE componentPaths.skills entry take the first-wins skip", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-within-entry-"));
  try {
    // One declared entry holding two skill dirs that elide to the same
    // generated name: `generatedSkillName` drops the `acme-` head and
    // re-prefixes, so `acme-foo/` and `foo/` both name `acme-foo`.
    // Discovery sorts by `name.localeCompare`, so `acme-foo` wins.
    const skillsDir = path.join(tmp, "skills");
    await mkdir(path.join(skillsDir, "acme-foo"), { recursive: true });
    await writeFile(path.join(skillsDir, "acme-foo", "SKILL.md"), "---\nname: foo\n---\nfrom-acme");
    await mkdir(path.join(skillsDir, "foo"), { recursive: true });
    await writeFile(path.join(skillsDir, "foo", "SKILL.md"), "---\nname: foo\n---\nfrom-bare");

    const resolved: ResolvedPluginInstallable = {
      state: "installable",
      name: "acme",
      pluginRoot: tmp,
      supported: ["skills"],
      unsupported: [],
      notes: [],
      componentPaths: { skills: [skillsDir], commands: [], agents: [] },
      mcpServers: {},
      defaultEnabled: true,
    };

    const { discovered, warnings } = await discoverPluginSkills({ pluginName: "acme", resolved });

    assert.equal(discovered.length, 1, "first-wins keeps only one");
    assert.equal(discovered[0]!.sourceName, "acme-foo", "the localeCompare-first source wins");
    assert.equal(discovered[0]!.generatedName, "acme-foo");
    assert.equal(warnings.length, 1);
    // There IS no earlier `componentPaths.skills` entry here -- one entry
    // holds both sides -- so the warning names the winner instead.
    assert.equal(
      warnings[0],
      `skill source "foo" in "${skillsDir}" elides to generated name "acme-foo", ` +
        `already produced by skill source "acme-foo"; ignoring duplicate.`,
    );
  } finally {
    await cleanupStaging(tmp, "test-cleanup");
  }
});

test("discoverPluginSkills treats a declared path that is itself a skill dir as one discovered skill", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-self-skill-"));
  try {
    const skillDir = path.join(tmp, "implement");
    await mkdir(skillDir, { recursive: true });
    await writeFile(path.join(skillDir, "SKILL.md"), "---\nname: implement\n---\nbody");

    const resolved: ResolvedPluginInstallable = {
      state: "installable",
      name: "mattpocock-skills",
      pluginRoot: tmp,
      supported: ["skills"],
      unsupported: [],
      notes: [],
      componentPaths: { skills: [skillDir], commands: [], agents: [] },
      mcpServers: {},
      defaultEnabled: true,
    };

    const { discovered, warnings } = await discoverPluginSkills({
      pluginName: "mattpocock-skills",
      resolved,
    });

    assert.deepEqual([...warnings], []);
    assert.equal(discovered.length, 1);
    assert.equal(discovered[0]!.sourceName, "implement");
    assert.equal(discovered[0]!.skillDir, skillDir);
    assert.equal(discovered[0]!.generatedName, "mattpocock-skills-implement");
  } finally {
    await cleanupStaging(tmp, "test-cleanup");
  }
});

test("discoverPluginSkills keeps first-wins dedup when one entry is a self skill dir", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-self-skill-dedup-"));
  try {
    const direct = path.join(tmp, "implement");
    await mkdir(direct, { recursive: true });
    await writeFile(path.join(direct, "SKILL.md"), "---\nname: implement\n---\nbody");

    const container = path.join(tmp, "skills");
    await mkdir(path.join(container, "implement"), { recursive: true });
    await writeFile(
      path.join(container, "implement", "SKILL.md"),
      "---\nname: implement\n---\nbody",
    );

    const resolved: ResolvedPluginInstallable = {
      state: "installable",
      name: "mattpocock-skills",
      pluginRoot: tmp,
      supported: ["skills"],
      unsupported: [],
      notes: [],
      componentPaths: { skills: [direct, container], commands: [], agents: [] },
      mcpServers: {},
      defaultEnabled: true,
    };

    const { discovered, warnings } = await discoverPluginSkills({
      pluginName: "mattpocock-skills",
      resolved,
    });

    assert.equal(discovered.length, 1);
    assert.equal(discovered[0]!.skillDir, direct);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /mattpocock-skills-implement/);
  } finally {
    await cleanupStaging(tmp, "test-cleanup");
  }
});

test("discoverPluginSkills reports the loss on the self skill dir when it arrives second", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-self-skill-loses-"));
  try {
    // The sibling test above orders the array [direct, container], so the self
    // skill dir always WINS and the loss is reported by the subdir-enumeration
    // loop. That leaves `collectSelfSkillDir`'s own duplicate branch
    // unexecuted. Reversing the order routes the loss through it instead.
    //
    // The two source names differ (`mattpocock-skills-implement` in the
    // container, `implement` as the self skill dir) so the exact string below
    // discriminates winner from loser; both elide to the same generated name.
    const container = path.join(tmp, "skills");
    await mkdir(path.join(container, "mattpocock-skills-implement"), { recursive: true });
    await writeFile(
      path.join(container, "mattpocock-skills-implement", "SKILL.md"),
      "---\nname: implement\n---\nfrom-container",
    );

    const direct = path.join(tmp, "implement");
    await mkdir(direct, { recursive: true });
    await writeFile(path.join(direct, "SKILL.md"), "---\nname: implement\n---\nfrom-direct");

    // A skill subdir UNDER the self skill dir, generating a name that collides
    // with nothing. It is discovered only if the branch falls through to
    // subdir enumeration, so `discovered.length` below also guards the
    // branch's `return true`.
    await mkdir(path.join(direct, "nested"), { recursive: true });
    await writeFile(path.join(direct, "nested", "SKILL.md"), "---\nname: nested\n---\nbody");

    const resolved: ResolvedPluginInstallable = {
      state: "installable",
      name: "mattpocock-skills",
      pluginRoot: tmp,
      supported: ["skills"],
      unsupported: [],
      notes: [],
      componentPaths: { skills: [container, direct], commands: [], agents: [] },
      mcpServers: {},
      defaultEnabled: true,
    };

    const { discovered, warnings } = await discoverPluginSkills({
      pluginName: "mattpocock-skills",
      resolved,
    });

    assert.equal(discovered.length, 1, "the self skill dir loses and its subdirs stay unwalked");
    assert.equal(discovered[0]!.sourceName, "mattpocock-skills-implement");
    assert.equal(
      discovered[0]!.skillDir,
      path.join(container, "mattpocock-skills-implement"),
      "the container entry wins",
    );
    assert.equal(warnings.length, 1);
    assert.equal(
      warnings[0],
      `skill source "implement" in "${direct}" elides to generated name ` +
        `"mattpocock-skills-implement", already produced by skill source ` +
        `"mattpocock-skills-implement"; ignoring duplicate.`,
    );
  } finally {
    await cleanupStaging(tmp, "test-cleanup");
  }
});
