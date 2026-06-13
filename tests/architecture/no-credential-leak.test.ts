import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

/**
 * AUTH-09 architecture gate.
 *
 * Two static-grep assertions that together prevent the most common
 * credential-leak surfaces:
 *
 *   1. No state-write code path (persistence/state-io.ts,
 *      persistence/migrate.ts, transaction/with-state-guard.ts) references
 *      a credential field name (`password`, `access_token`, `githubToken`,
 *      `gitToken`). Tokens must remain in-memory only; no path may serialize
 *      them to state.json.
 *   2. The platform/git-credential.ts module (which legitimately handles
 *      credentials) MUST NOT interpolate a credential field into an Error
 *      constructor. Error messages reference operation name + exit code or
 *      timeout-ms only.
 *
 * Test (2) passes vacuously when
 * platform/git-credential.ts does not exist on disk; the file's
 * presence activates the test, and
 * the file-header docstring + Error-message discipline ensure it stays
 * GREEN once active.
 *
 * Comment stripping: docstrings can legitimately mention these field names
 * (this very file does). Both tests strip `/\* ... *\/` blocks and `//`
 * line comments before applying the forbidden-pattern regex so the gate
 * only catches the semantic uses.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const STATE_WRITE_FILES: ReadonlyArray<string> = [
  "extensions/pi-claude-marketplace/persistence/state-io.ts",
  "extensions/pi-claude-marketplace/persistence/migrate.ts",
  "extensions/pi-claude-marketplace/transaction/with-state-guard.ts",
];

const FORBIDDEN_STATE_FIELDS = /\b(password|access_token|githubToken|gitToken)\b/i;

const GIT_CREDENTIAL_FILE = "extensions/pi-claude-marketplace/platform/git-credential.ts";

const GITHUB_AUTH_FILE = "extensions/pi-claude-marketplace/domain/github-auth.ts";

const PHASE_35_ORCHESTRATOR_FILES: ReadonlyArray<string> = [
  "extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts",
  "extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts",
];

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

test("AUTH-09: no credential field name appears in any state-write code path", async () => {
  const offenders: string[] = [];
  for (const rel of STATE_WRITE_FILES) {
    const src = await readFile(path.join(REPO_ROOT, rel), "utf8");
    const stripped = stripComments(src);
    if (FORBIDDEN_STATE_FIELDS.test(stripped)) {
      offenders.push(`${rel} contains a forbidden credential-field reference`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `AUTH-09 violation: state-write code path leaks a credential field name:\n  ${offenders.join("\n  ")}`,
  );
});

test("AUTH-09: platform/git-credential.ts never interpolates a password in an Error message", async () => {
  const absPath = path.join(REPO_ROOT, GIT_CREDENTIAL_FILE);
  const exists = await access(absPath).then(
    () => true,
    () => false,
  );
  if (!exists) {
    // Until git-credential.ts is authored, this
    // gate is vacuously satisfied. The file's creation activates it.
    assert.ok(
      true,
      "platform/git-credential.ts not yet authored; AUTH-09 Error-interpolation gate inactive until the file exists",
    );
    return;
  }

  const src = await readFile(absPath, "utf8");
  const stripped = stripComments(src);
  // Forbidden: template literal OR string concatenation that puts `password`,
  // `access_token`, or `cred.<field>` inside an Error(...) constructor.
  const errorWithCred =
    /new\s+Error\s*\((?:[^)]*\$\{[^}]*(password|access_token|cred\.[a-z]+)|[^)]*\+\s*(password|access_token|cred\.[a-z]+))/i;
  assert.equal(
    errorWithCred.test(stripped),
    false,
    "Error constructor in git-credential.ts interpolates a credential field (AUTH-09 violation)",
  );
});

test("AUTH-09: domain/github-auth.ts never interpolates a token in an Error or notifyFn message", async () => {
  const absPath = path.join(REPO_ROOT, GITHUB_AUTH_FILE);
  const exists = await access(absPath).then(
    () => true,
    () => false,
  );
  if (!exists) {
    // Until domain/github-auth.ts is
    // authored, this gate is vacuously satisfied. The file's creation
    // activates the gate automatically.
    assert.ok(
      true,
      "domain/github-auth.ts not yet authored; AUTH-09 gate inactive until the file exists",
    );
    return;
  }

  const src = await readFile(absPath, "utf8");
  const stripped = stripComments(src);
  // Forbidden: template literal OR string concatenation that interpolates
  //   - access_token, accessToken
  //   - cred.<field> (e.g. cred.password, cred.access_token)
  //   - r.accessToken (from the PollResult success branch)
  // INSIDE a `new Error(...)` constructor OR a `notifyFn(...)` call.
  const errorOrNotifyWithToken =
    /(new\s+Error\s*\(|notifyFn\s*\()(?:[^)]*\$\{[^}]*(access_?token|cred\.[a-z]+|r\.accessToken)|[^)]*\+\s*(access_?token|cred\.[a-z]+|r\.accessToken))/i;
  assert.equal(
    errorOrNotifyWithToken.test(stripped),
    false,
    "Error or notifyFn in domain/github-auth.ts interpolates a token field (AUTH-09 violation)",
  );
});

test("AUTH-09: orchestrators/marketplace/{add,update}.ts never interpolate a credential field in an Error or ctx.ui.notify message", async () => {
  // Closes review WR-02. add.ts and update.ts construct the Device Flow
  // onAuthRequired closure. The closure captures `credentialOps` by
  // reference -- a future regression that interpolates
  // `credentialOps.fill(...).then(c => ctx.ui.notify(\`got ${c.password}\`))`
  // would be an AUTH-09 violation. This gate scans for that class of
  // bug in the orchestrator files.
  //
  // The regex mirrors the github-auth.ts gate: forbidden is a
  // template literal OR string concatenation that interpolates
  //   - access_token, accessToken
  //   - cred.<field> (e.g. cred.password)
  //   - r.accessToken
  // INSIDE a `new Error(...)` constructor OR a `ctx.ui.notify(...)` call.
  const forbidden =
    /(new\s+Error\s*\(|ctx\.ui\.notify\s*\()(?:[^)]*\$\{[^}]*(access_?token|cred\.[a-z]+|r\.accessToken)|[^)]*\+\s*(access_?token|cred\.[a-z]+|r\.accessToken))/i;

  for (const rel of PHASE_35_ORCHESTRATOR_FILES) {
    const absPath = path.join(REPO_ROOT, rel);
    const exists = await access(absPath).then(
      () => true,
      () => false,
    );
    if (!exists) {
      // If a file doesn't exist yet on disk, this gate is vacuously
      // satisfied for that file.
      continue;
    }

    const src = await readFile(absPath, "utf8");
    const stripped = stripComments(src);
    assert.equal(
      forbidden.test(stripped),
      false,
      `Error or ctx.ui.notify in ${rel} interpolates a credential field (AUTH-09 violation; closes review WR-02)`,
    );
  }
});
