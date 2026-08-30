import assert from "node:assert/strict";
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
import { unstagePluginSkills as definingUnstagePluginSkills } from "../../../extensions/pi-claude-marketplace/bridges/skills/unstage.ts";

import type {
  PreparedSkillsStaging as BarrelPreparedSkillsStaging,
  SkillsReplacement as BarrelSkillsReplacement,
} from "../../../extensions/pi-claude-marketplace/bridges/skills/index.ts";
import type {
  PreparedSkillsStaging as DefiningPreparedSkillsStaging,
  SkillsReplacement as DefiningSkillsReplacement,
} from "../../../extensions/pi-claude-marketplace/bridges/skills/types.ts";

type Same<Left, Right> = [Left] extends [Right] ? ([Right] extends [Left] ? true : false) : false;

void (true satisfies Same<BarrelPreparedSkillsStaging, DefiningPreparedSkillsStaging>);
void (true satisfies Same<BarrelSkillsReplacement, DefiningSkillsReplacement>);

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
  test("re-exports the defining binding", () => {
    // arrange
    const expectedUnstagePluginSkills = definingUnstagePluginSkills;

    // act
    const skillsUnstagePluginSkills = unstagePluginSkills;

    // assert
    assert.strictEqual(skillsUnstagePluginSkills, expectedUnstagePluginSkills);
  });
});
