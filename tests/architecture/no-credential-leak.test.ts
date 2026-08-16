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

const GIT_PLATFORM_FILE = "extensions/pi-claude-marketplace/platform/git.ts";

const PROVIDER_FILES: ReadonlyArray<string> = [
  "extensions/pi-claude-marketplace/domain/auth-registry.ts",
  // buildAuthForHost binds the provider flow + notifyFn per host; a token
  // interpolation regression here would leak, so the PROV-05 scan covers it.
  "extensions/pi-claude-marketplace/orchestrators/auth-host.ts",
];

const PHASE_35_ORCHESTRATOR_FILES: ReadonlyArray<string> = [
  "extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts",
  "extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts",
];

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/**
 * Finds every occurrence of `marker` (a global regex whose capture group 1
 * matches a COMPLETE backtick-delimited template literal, e.g.
 * `/reason:\s*(`(?:[^`\\]|\\.)*`)/g`) in `src` and returns each captured
 * literal in full, backticks included.
 *
 * Capturing the whole literal -- rather than bounding a scan window with a
 * character class such as `[^)]*` or `[^,}]*` -- is what lets a caller
 * inspect EVERY `${...}` interpolation inside a multi-interpolation
 * literal, and prevents a literal `)`/`,`/`}` character in the SAFE portion
 * of the text (e.g. "reject() threw for ...") from truncating the scan
 * before it ever reaches the interpolation that follows it. Both are
 * proven bypasses of the older bounded-prefix gates in this file.
 */
function fullTemplateLiteralsAfter(src: string, marker: RegExp): string[] {
  const literals: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = marker.exec(src)) !== null) {
    if (match[1] !== undefined) {
      literals.push(match[1]);
    }
  }

  return literals;
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

test("AUTH-09: describeDeviceCodeErrorBody never references a credential field", async () => {
  // The gate above scans new Error(...)/notifyFn(...) call sites; it cannot
  // see through the describeDeviceCodeErrorBody(res) call inside
  // requestCodeImpl's `new Error(...)` -- a lexical scan of that call site
  // only ever sees `res.status` and a function-call expression. This test
  // instead scans the helper's OWN body directly: at this point in the flow
  // no credential has been issued yet, so describeDeviceCodeErrorBody may
  // only ever read the provider's `error` / `error_description` fields.
  const absPath = path.join(REPO_ROOT, GITHUB_AUTH_FILE);
  const src = await readFile(absPath, "utf8");
  const stripped = stripComments(src);
  const fnMatch = /async function describeDeviceCodeErrorBody\([\s\S]*?\n}\n/.exec(stripped);
  assert.ok(fnMatch, "describeDeviceCodeErrorBody function body not found for AUTH-09 scan");

  const forbiddenField =
    /\b(password|access_token|accessToken|cred\.[a-z]+|githubToken|gitToken)\b/i;
  // The named-field check above matches specific field NAMES only. A
  // regression that dumps the whole response body instead of reading the
  // named `error`/`error_description` fields (e.g. via JSON.stringify(data)
  // or res.text()) would slip past it undetected, so it is forbidden here
  // too.
  const forbiddenBodyDump = /JSON\.stringify\s*\(|(?:res|response)\.text\s*\(/i;
  assert.equal(
    forbiddenField.test(fnMatch[0]) || forbiddenBodyDump.test(fnMatch[0]),
    false,
    "describeDeviceCodeErrorBody references a credential field or dumps the whole response body (AUTH-09 violation)",
  );
});

test("AUTH-09: domain/github-auth.ts reason: fields never interpolate a token", async () => {
  // DeviceFlowResult's failure arm is built as a plain object literal
  // (`{ ok: false, reason: ... }`), not a `new Error(...)`/`notifyFn(...)`
  // call, so the gate above does not scan it. This test covers that
  // construction form directly.
  //
  // Two checks combine here. The first is the original bounded-prefix scan,
  // kept unchanged so no case it used to catch (a concatenation leak, or a
  // leak as the FIRST interpolation) stops being caught. The second closes
  // a proven bypass: `[^,}]*` cannot cross the `}` that closes a preceding
  // `${...}`, so it only ever inspects the FIRST interpolation in a
  // multi-interpolation template literal (e.g.
  // `` `Device Flow failed: ${r.error}${r.accessToken}` `` -- the SECOND
  // interpolation was invisible to the bounded scan). The second check
  // captures the COMPLETE template literal following each `reason:` as one
  // token (see `fullTemplateLiteralsAfter`) and scans it in full.
  const absPath = path.join(REPO_ROOT, GITHUB_AUTH_FILE);
  const src = await readFile(absPath, "utf8");
  const stripped = stripComments(src);

  const reasonFieldWithToken =
    /reason:\s*(?:[^,}]*\$\{[^}]*(access_?token|cred\.[a-z]+|r\.accessToken)|[^,}]*\+\s*(access_?token|cred\.[a-z]+|r\.accessToken))/i;
  assert.equal(
    reasonFieldWithToken.test(stripped),
    false,
    "a reason: field in domain/github-auth.ts interpolates a token field (AUTH-09 violation)",
  );

  const forbiddenInLiteral =
    /\b(access_?token|cred\.[a-z]+|r\.accessToken|password|accessToken)\b/i;
  const reasonLiterals = fullTemplateLiteralsAfter(stripped, /reason:\s*(`(?:[^`\\]|\\.)*`)/g);
  const literalOffenders = reasonLiterals.filter((lit) => forbiddenInLiteral.test(lit));
  assert.deepEqual(
    literalOffenders,
    [],
    `a reason: template literal in domain/github-auth.ts interpolates a credential field beyond the first interpolation (AUTH-09 violation): ${literalOffenders.join(", ")}`,
  );
});

test("AUTH-09: platform/git.ts hookDebugLog calls never interpolate a credential field", async () => {
  // buildAuthCallbacks routes onAuth/onAuthFailure failure reasons through
  // hookDebugLog (see the CP-10 discussion above buildAuthCallbacks). That
  // call form is not `new Error(...)` or `notifyFn(...)`, so it falls
  // outside every other gate in this file; this test closes that gap.
  //
  // Two checks combine here (mirroring the twin `reason:` gate above). The
  // first is the original bounded-prefix scan, kept unchanged so no case it
  // used to catch stops being caught. The second closes a proven bypass:
  // `[^)]*` does not allow a literal `)` before the interpolation it is
  // scanning for, and onAuthFailure's own message text contains one
  // (`` `onAuthFailure: reject() threw for ${opts.host}: ...` `` -- the
  // literal `)` in "reject()" stops the scan before it ever reaches EITHER
  // `${...}`). The second check captures the COMPLETE template literal
  // following each `hookDebugLog(` as one token and scans it in full, so a
  // leak appended after a nested function call's closing paren (e.g. after
  // `${errorMessage(err)}`) is caught too.
  const absPath = path.join(REPO_ROOT, GIT_PLATFORM_FILE);
  const src = await readFile(absPath, "utf8");
  const stripped = stripComments(src);

  const hookDebugLogWithToken =
    /hookDebugLog\s*\((?:[^)]*\$\{[^}]*(access_?token|cred\.[a-z]+|r\.accessToken)|[^)]*\+\s*(access_?token|cred\.[a-z]+|r\.accessToken))/i;
  assert.equal(
    hookDebugLogWithToken.test(stripped),
    false,
    "hookDebugLog in platform/git.ts interpolates a credential field (AUTH-09 violation)",
  );

  const forbiddenInLiteral =
    /\b(access_?token|cred\.[a-z]+|r\.accessToken|password|accessToken)\b/i;
  const hookDebugLogLiterals = fullTemplateLiteralsAfter(
    stripped,
    /hookDebugLog\s*\(\s*(`(?:[^`\\]|\\.)*`)/g,
  );
  const literalOffenders = hookDebugLogLiterals.filter((lit) => forbiddenInLiteral.test(lit));
  assert.deepEqual(
    literalOffenders,
    [],
    `a hookDebugLog template literal in platform/git.ts interpolates a credential field past a literal ) or beyond the first interpolation (AUTH-09 violation): ${literalOffenders.join(", ")}`,
  );
});

test("PROV-05: every provider file is scanned for token interpolation in an Error or notifyFn message", async () => {
  // Each provider descriptor file carries credential-shaping logic
  // (credentialFrom) and endpoint/clientId literals. A regression that
  // interpolated a token into an Error or notifyFn here would leak it, so the
  // AUTH-09 gate must cover the whole provider set, not just github-auth.ts.
  const errorOrNotifyWithToken =
    /(new\s+Error\s*\(|notifyFn\s*\()(?:[^)]*\$\{[^}]*(access_?token|cred\.[a-z]+|r\.accessToken)|[^)]*\+\s*(access_?token|cred\.[a-z]+|r\.accessToken))/i;

  for (const rel of PROVIDER_FILES) {
    const absPath = path.join(REPO_ROOT, rel);
    const exists = await access(absPath).then(
      () => true,
      () => false,
    );
    if (!exists) {
      // A not-yet-authored provider file leaves the gate vacuously satisfied
      // for that file; its creation activates the scan.
      continue;
    }

    const src = await readFile(absPath, "utf8");
    const stripped = stripComments(src);
    assert.equal(
      errorOrNotifyWithToken.test(stripped),
      false,
      `Error or notifyFn in ${rel} interpolates a token field (AUTH-09 violation)`,
    );
  }
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
