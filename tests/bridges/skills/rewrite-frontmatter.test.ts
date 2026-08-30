import assert from "node:assert/strict";
import { test } from "node:test";

import { rewriteFrontmatterName } from "../../../extensions/pi-claude-marketplace/bridges/skills/rewrite-frontmatter.ts";

for (const { description, skillDocument, generatedName, expectedSkillDocument } of [
  {
    description: "replaces an existing scalar name and preserves every remaining byte",
    skillDocument:
      '---\nname: old-name\ndescription: "keep: punctuation"\nlicense: MIT\n---\n\n# Body\n\nBody text.\n',
    generatedName: "new-name",
    expectedSkillDocument:
      '---\nname: new-name\ndescription: "keep: punctuation"\nlicense: MIT\n---\n\n# Body\n\nBody text.\n',
  },
  {
    description: "inserts a missing name as the first frontmatter field",
    skillDocument:
      "---\ndescription: Skill without a name\nlicense: Apache-2.0\n---\n\nBody text.\n",
    generatedName: "inserted-name",
    expectedSkillDocument:
      "---\nname: inserted-name\ndescription: Skill without a name\nlicense: Apache-2.0\n---\n\nBody text.\n",
  },
]) {
  test(description, () => {
    // arrange
    const sourceSkillDocument = skillDocument;
    const expectedRewrittenSkillDocument = expectedSkillDocument;

    // act
    const rewrittenSkillDocument = rewriteFrontmatterName(sourceSkillDocument, generatedName);

    // assert
    assert.strictEqual(rewrittenSkillDocument, expectedRewrittenSkillDocument);
  });
}
