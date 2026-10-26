import assert from "node:assert/strict";
import { test } from "node:test";

import { SCOPES, type Scope } from "../../extensions/pi-claude-marketplace/shared/types.ts";

void ("user" satisfies Scope);
void ("project" satisfies Scope);
// @ts-expect-error Scope intentionally excludes the Claude Code local scope
void ("local" satisfies Scope);
// @ts-expect-error Scope excludes unrelated scope names
void ("workspace" satisfies Scope);

test("exports the complete scope set in canonical order", () => {
  // arrange
  const expectedScopes = ["user", "project"];

  // act
  const scopes = SCOPES;

  // assert
  assert.deepStrictEqual(scopes, expectedScopes);
});
