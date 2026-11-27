/**
 * test/architecture/no-token-variable-read.test.ts -- no extension source names
 * a token variable.
 *
 * The invariant (SG-AUTH-01):
 *   Git authenticates only with what the machine holds: an ssh key or agent,
 *   and the git credential helpers the user configured. The extension reads
 *   no `GITHUB_TOKEN`, `GH_TOKEN`, or `GITLAB_TOKEN` into a URL, a header, a
 *   git argument, or a config value it gives git, as Claude Code reads none.
 *
 *   The cost of losing it: a token in a URL or an argument shows in process
 *   lists, git's own error text, and the clone's recorded origin. A token the
 *   extension sends also bypasses the helper the user chose, so a user who
 *   signed out of a host keeps reaching it.
 *
 * How it is checked:
 *   A read needs the variable's name, so the case scans the comment-stripped
 *   source of every extension module for the three names as whole words. The
 *   word boundary keeps out longer names that end in one of them, such as
 *   `OVERRIDE_GITHUB_TOKEN` in the hook credential denylist. A second case
 *   requires the same scan to find a module that reads `process.env`, so a
 *   moved or empty tree cannot pass the first.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { filesMatching } from "./source-scan.ts";

const EXTENSION_ROOT = "extensions/pi-claude-marketplace";
const TOKEN_VARIABLE = /\b(?:GITHUB_TOKEN|GH_TOKEN|GITLAB_TOKEN)\b/u;
const ENVIRONMENT_READ = /process\.env/u;

test("SG-AUTH-01: no extension module names GITHUB_TOKEN, GH_TOKEN, or GITLAB_TOKEN", async () => {
  // act
  const naming = await filesMatching(EXTENSION_ROOT, TOKEN_VARIABLE);

  // assert
  assert.deepStrictEqual(naming, []);
});

test("SG-AUTH-01: the token scan reads extension modules that read process.env", async () => {
  // act
  const reading = await filesMatching(EXTENSION_ROOT, ENVIRONMENT_READ);

  // assert
  assert.notStrictEqual(reading.length, 0);
});
