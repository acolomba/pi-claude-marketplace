import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import { discoverPluginSkills as definingDiscoverPluginSkills } from "../../../extensions/pi-claude-marketplace/bridges/skills/discover.ts";
import {
  abortPreparedSkills,
  commitPreparedSkills,
  discoverPluginSkills,
  finalizeSkillsReplacement,
  prepareStageSkills,
  replacePreparedSkills,
  rollbackSkillsReplacement,
  unstagePluginSkills,
} from "../../../extensions/pi-claude-marketplace/bridges/skills/index.ts";
import {
  abortPreparedSkills as definingAbortPreparedSkills,
  commitPreparedSkills as definingCommitPreparedSkills,
  finalizeSkillsReplacement as definingFinalizeSkillsReplacement,
  prepareStageSkills as definingPrepareStageSkills,
  replacePreparedSkills as definingReplacePreparedSkills,
  rollbackSkillsReplacement as definingRollbackSkillsReplacement,
} from "../../../extensions/pi-claude-marketplace/bridges/skills/stage.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type * as SkillsBarrel from "../../../extensions/pi-claude-marketplace/bridges/skills/index.ts";
import type {
  PreparedSkillsStaging as BarrelPreparedSkillsStaging,
  SkillsReplacement as BarrelSkillsReplacement,
} from "../../../extensions/pi-claude-marketplace/bridges/skills/index.ts";
import type {
  PreparedSkillsStaging as DefiningPreparedSkillsStaging,
  SkillsReplacement as DefiningSkillsReplacement,
} from "../../../extensions/pi-claude-marketplace/bridges/skills/types.ts";

type Same<Left, Right> = [Left] extends [Right] ? ([Right] extends [Left] ? true : false) : false;
type PreparedSkillsNoop = Extract<BarrelPreparedSkillsStaging, { kind: "noop" }>;
type PreparedSkillsStaged = Extract<BarrelPreparedSkillsStaging, { kind: "staged" }>;
type SkillsReplacementNoop = Extract<BarrelSkillsReplacement, { kind: "noop" }>;
type SkillsReplacementReplaced = Extract<BarrelSkillsReplacement, { kind: "replaced" }>;
type SkillsRuntimeExport =
  keyof typeof import("../../../extensions/pi-claude-marketplace/bridges/skills/index.ts");

void (true satisfies Same<BarrelPreparedSkillsStaging, DefiningPreparedSkillsStaging>);
void (true satisfies Same<BarrelSkillsReplacement, DefiningSkillsReplacement>);
void (true satisfies Same<PreparedSkillsNoop["kind"], "noop">);
void (true satisfies Same<PreparedSkillsStaged["kind"], "staged">);
void (true satisfies Same<SkillsReplacementNoop["kind"], "noop">);
void (true satisfies Same<SkillsReplacementReplaced["kind"], "replaced">);
void (true satisfies Same<SkillsReplacementNoop["prepared"], PreparedSkillsNoop>);
void (true satisfies Same<SkillsReplacementReplaced["prepared"], PreparedSkillsStaged>);
void (true satisfies Same<keyof SkillsReplacementNoop, "kind" | "prepared">);
void (true satisfies Same<keyof SkillsReplacementReplaced, "kind" | "prepared">);
void (true satisfies Same<
  SkillsRuntimeExport,
  | "abortPreparedSkills"
  | "commitPreparedSkills"
  | "discoverPluginSkills"
  | "finalizeSkillsReplacement"
  | "prepareStageSkills"
  | "replacePreparedSkills"
  | "rollbackSkillsReplacement"
  | "unstagePluginSkills"
>);
void ({
  kind: "noop",
  result: { stagedNames: [], recorded: [], warnings: [], degraded: [] },
} satisfies BarrelPreparedSkillsStaging);
void ({
  kind: "noop",
  prepared: {
    kind: "noop",
    result: { stagedNames: [], recorded: [], warnings: [], degraded: [] },
  },
} satisfies BarrelSkillsReplacement);

// @ts-expect-error staging internals require narrowing to the staged handle
void ("/staging" satisfies BarrelPreparedSkillsStaging["stagingRoot"]);
// @ts-expect-error a skill preparation handle has a closed discriminant set
void ({ kind: "missing" } satisfies BarrelPreparedSkillsStaging);
// @ts-expect-error a skill replacement handle has a closed discriminant set
void ({ kind: "staged" } satisfies BarrelSkillsReplacement);
// @ts-expect-error the barrel keeps the staged implementation type private
void ({} satisfies { readonly retired?: SkillsBarrel.PreparedSkillsStaged });
// @ts-expect-error the barrel does not export the commit-result implementation type
void ({} satisfies { readonly retired?: SkillsBarrel.StageSkillsCommitResult });

describe("abortPreparedSkills", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedAbortPreparedSkills = definingAbortPreparedSkills;

    // act
    const skillsAbortPreparedSkills = abortPreparedSkills;

    // assert
    assert.strictEqual(skillsAbortPreparedSkills, expectedAbortPreparedSkills);
  });
});

describe("commitPreparedSkills", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedCommitPreparedSkills = definingCommitPreparedSkills;

    // act
    const skillsCommitPreparedSkills = commitPreparedSkills;

    // assert
    assert.strictEqual(skillsCommitPreparedSkills, expectedCommitPreparedSkills);
  });
});

describe("discoverPluginSkills", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedDiscoverPluginSkills = definingDiscoverPluginSkills;

    // act
    const skillsDiscoverPluginSkills = discoverPluginSkills;

    // assert
    assert.strictEqual(skillsDiscoverPluginSkills, expectedDiscoverPluginSkills);
  });
});

describe("finalizeSkillsReplacement", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedFinalizeSkillsReplacement = definingFinalizeSkillsReplacement;

    // act
    const skillsFinalizeSkillsReplacement = finalizeSkillsReplacement;

    // assert
    assert.strictEqual(skillsFinalizeSkillsReplacement, expectedFinalizeSkillsReplacement);
  });
});

describe("prepareStageSkills", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedPrepareStageSkills = definingPrepareStageSkills;

    // act
    const skillsPrepareStageSkills = prepareStageSkills;

    // assert
    assert.strictEqual(skillsPrepareStageSkills, expectedPrepareStageSkills);
  });
});

describe("replacePreparedSkills", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedReplacePreparedSkills = definingReplacePreparedSkills;

    // act
    const skillsReplacePreparedSkills = replacePreparedSkills;

    // assert
    assert.strictEqual(skillsReplacePreparedSkills, expectedReplacePreparedSkills);
  });
});

describe("rollbackSkillsReplacement", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedRollbackSkillsReplacement = definingRollbackSkillsReplacement;

    // act
    const skillsRollbackSkillsReplacement = rollbackSkillsReplacement;

    // assert
    assert.strictEqual(skillsRollbackSkillsReplacement, expectedRollbackSkillsReplacement);
  });
});

describe("unstagePluginSkills", () => {
  test("removes only recorded skill trees and tolerates a missing name through the Node remover", async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "skills-bridge-remove-"));
    t.after(() => rm(root, { recursive: true, force: true, maxRetries: 3 }));
    const locations = locationsFor("project", root);
    const firstDirectory = path.join(locations.skillsTargetDir, "acme-first");
    const secondDirectory = path.join(locations.skillsTargetDir, "acme-second");
    const foreignDirectory = path.join(locations.skillsTargetDir, "foreign-keep");
    const foreignFile = path.join(foreignDirectory, "SKILL.md");
    await mkdir(path.join(firstDirectory, "resources"), { recursive: true });
    await mkdir(secondDirectory);
    await mkdir(foreignDirectory);
    await writeFile(path.join(firstDirectory, "resources", "nested.json"), '{"nested":true}\n');
    await writeFile(path.join(secondDirectory, "SKILL.md"), "second skill bytes\n");
    await writeFile(foreignFile, "foreign skill bytes\n");
    const previousSkillNames = ["acme-second", "acme-missing", "acme-first"];

    // act
    const removedSkills = await unstagePluginSkills({ locations, previousSkillNames });
    const remainingNames = await readdir(locations.skillsTargetDir);
    const repeatedRemoval = await unstagePluginSkills({ locations, previousSkillNames });

    // assert
    assert.deepStrictEqual(removedSkills, {
      removedNames: ["acme-second", "acme-first"],
      warnings: [],
    });
    assert.deepStrictEqual(repeatedRemoval, { removedNames: [], warnings: [] });
    assert.strictEqual(Object.isFrozen(removedSkills.removedNames), true);
    assert.strictEqual(Object.isFrozen(removedSkills.warnings), true);
    assert.strictEqual(Object.isFrozen(repeatedRemoval.removedNames), true);
    assert.strictEqual(Object.isFrozen(repeatedRemoval.warnings), true);
    assert.deepStrictEqual(remainingNames, ["foreign-keep"]);
    assert.deepStrictEqual(await readdir(locations.skillsTargetDir), ["foreign-keep"]);
    assert.strictEqual(await readFile(foreignFile, "utf8"), "foreign skill bytes\n");
  });
});
