import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { CREDENTIAL_LEAK_TARGETS } from "./gate-targets.ts";

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
 * Every file each scan addresses is declared in `CREDENTIAL_LEAK_TARGETS`
 * (`tests/architecture/gate-targets.ts`), and each scan asserts it opened what
 * it declared. A target that stops resolving FAILS its scan rather than leaving
 * it vacuously satisfied: a gate that greens over a file it never read buys
 * confidence it has not earned (D-07-03).
 *
 * Comment stripping: docstrings can legitimately mention these field names
 * (this very file does). Both tests strip `/\* ... *\/` blocks and `//`
 * line comments before applying the forbidden-pattern regex so the gate
 * only catches the semantic uses.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * The AUTH-09 group in its declared order, split into the subsets each scan
 * below covers. Position is what aims each scan, so the module basenames are
 * pinned in the first case (D-07-03): a member reordered, added, or dropped in
 * the registry would otherwise point a regex at a file it was never written
 * for and still report success.
 */
const [
  STATE_IO_FILE,
  MIGRATE_FILE,
  WITH_STATE_GUARD_FILE,
  GIT_CREDENTIAL_FILE,
  GITHUB_AUTH_FILE,
  GIT_PLATFORM_FILE,
  AUTH_REGISTRY_FILE,
  AUTH_HOST_FILE,
  MARKETPLACE_ADD_FILE,
  MARKETPLACE_UPDATE_FILE,
] = CREDENTIAL_LEAK_TARGETS;

/** The module basenames the destructuring above binds, in registry order. */
const DECLARED_MODULE_ORDER: ReadonlyArray<string> = [
  "state-io.ts",
  "migrate.ts",
  "with-state-guard.ts",
  "git-credential.ts",
  "github-auth.ts",
  "git.ts",
  "auth-registry.ts",
  "auth-host.ts",
  "add.ts",
  "update.ts",
];

const STATE_WRITE_FILES: ReadonlyArray<string> = [
  STATE_IO_FILE,
  MIGRATE_FILE,
  WITH_STATE_GUARD_FILE,
];

const FORBIDDEN_STATE_FIELDS = /\b(password|access_token|githubToken|gitToken)\b/i;

const PROVIDER_FILES: ReadonlyArray<string> = [
  AUTH_REGISTRY_FILE,
  // buildAuthForHost binds the provider flow + notifyFn per host; a token
  // interpolation regression here would leak, so the PROV-05 scan covers it.
  AUTH_HOST_FILE,
];

/**
 * The marketplace verbs that construct the Device Flow `onAuthRequired`
 * closure. The closure captures `credentialOps` by reference, so both are
 * scanned for a credential interpolated into an Error or a notify message.
 */
const CREDENTIAL_CAPTURING_ORCHESTRATORS: ReadonlyArray<string> = [
  MARKETPLACE_ADD_FILE,
  MARKETPLACE_UPDATE_FILE,
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

/** Every credential field name a message literal may never carry. */
const CREDENTIAL_IN_LITERAL =
  /\b(access_?token|cred\.[a-z]+|r\.accessToken|password|accessToken|githubToken|gitToken)\b/i;

/**
 * Asserts that no COMPLETE template literal reached by `callSite` names a
 * credential field. `callSite` is a global regex whose capture group 1 matches
 * the whole backtick-delimited literal that follows the call form being
 * guarded.
 *
 * Every scan in this file pairs its bounded-prefix regex with this check,
 * because the bounded form alone stops at the first literal `)` or `}` it
 * meets and therefore cannot see an interpolation that follows a nested call
 * or a preceding `${...}` (AUTH-09).
 */
function assertNoCredentialInLiterals(rel: string, stripped: string, callSite: RegExp): void {
  const offenders = fullTemplateLiteralsAfter(stripped, callSite).filter((lit) =>
    CREDENTIAL_IN_LITERAL.test(lit),
  );
  assert.deepEqual(
    offenders,
    [],
    `AUTH-09 violation: a message template literal in ${rel} interpolates a credential field past a literal ) or beyond the first interpolation: ${offenders.join(", ")}`,
  );
}

/** The `new Error(\`...\`)` call form, capturing the whole literal. */
const ERROR_LITERAL_CALL_SITE = /new\s+Error\s*\(\s*(`(?:[^`\\]|\\.)*`)/g;

/** The `new Error(\`...\`)` / `notifyFn(\`...\`)` call forms. */
const ERROR_OR_NOTIFY_FN_LITERAL_CALL_SITE =
  /(?:new\s+Error\s*\(|notifyFn\s*\()\s*(`(?:[^`\\]|\\.)*`)/g;

/** The `new Error(\`...\`)` / `ctx.ui.notify(\`...\`)` call forms. */
const ERROR_OR_UI_NOTIFY_LITERAL_CALL_SITE =
  /(?:new\s+Error\s*\(|ctx\.ui\.notify\s*\()\s*(`(?:[^`\\]|\\.)*`)/g;

test("AUTH-09: no credential field name appears in any state-write code path", async () => {
  assert.ok(
    CREDENTIAL_LEAK_TARGETS.length > 0,
    "D-07-03: an empty CREDENTIAL_LEAK_TARGETS leaves every scan in this gate reporting success over zero declared files.",
  );
  assert.deepEqual(
    CREDENTIAL_LEAK_TARGETS.map((rel) => path.basename(rel)),
    DECLARED_MODULE_ORDER,
    "D-07-03: every scan in this gate is aimed by POSITION in CREDENTIAL_LEAK_TARGETS. A member reordered, added, or dropped in the registry re-aims a regex at a file it was never written for, and the scan would still report success.",
  );

  const offenders: string[] = [];
  const visited: string[] = [];
  for (const rel of STATE_WRITE_FILES) {
    const src = await readFile(path.join(REPO_ROOT, rel), "utf8");
    visited.push(rel);
    const stripped = stripComments(src);
    if (FORBIDDEN_STATE_FIELDS.test(stripped)) {
      offenders.push(`${rel} contains a forbidden credential-field reference`);
    }
  }

  assert.deepEqual(
    visited,
    [...STATE_WRITE_FILES],
    "D-07-03: the scan must have opened every declared state-write path; one that stopped resolving drops out of this list.",
  );
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
  assert.ok(
    exists,
    `D-07-03: ${GIT_CREDENTIAL_FILE} is declared in CREDENTIAL_LEAK_TARGETS but does not resolve, so the scan below would report success having opened nothing.`,
  );

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

  assertNoCredentialInLiterals(GIT_CREDENTIAL_FILE, stripped, ERROR_LITERAL_CALL_SITE);
});

test("AUTH-09: domain/github-auth.ts never interpolates a token in an Error or notifyFn message", async () => {
  const absPath = path.join(REPO_ROOT, GITHUB_AUTH_FILE);
  const exists = await access(absPath).then(
    () => true,
    () => false,
  );
  assert.ok(
    exists,
    `D-07-03: ${GITHUB_AUTH_FILE} is declared in CREDENTIAL_LEAK_TARGETS but does not resolve, so the scan below would report success having opened nothing.`,
  );

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

  assertNoCredentialInLiterals(GITHUB_AUTH_FILE, stripped, ERROR_OR_NOTIFY_FN_LITERAL_CALL_SITE);
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
  // kept unchanged so it still catches every case it already covers (a
  // concatenation leak, or a leak as the FIRST interpolation). The second closes
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

  assertNoCredentialInLiterals(GITHUB_AUTH_FILE, stripped, /reason:\s*(`(?:[^`\\]|\\.)*`)/g);
});

test("AUTH-09: platform/git.ts hookDebugLog calls never interpolate a credential field", async () => {
  // buildAuthCallbacks routes onAuth/onAuthFailure failure reasons through
  // hookDebugLog (see the CP-10 discussion above buildAuthCallbacks). That
  // call form is not `new Error(...)` or `notifyFn(...)`, so it falls
  // outside every other gate in this file; this test closes that gap.
  //
  // Two checks combine here (mirroring the twin `reason:` gate above). The
  // first is the original bounded-prefix scan, kept unchanged so it still
  // catches every case it already covers. The second closes a proven bypass:
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

  assertNoCredentialInLiterals(
    GIT_PLATFORM_FILE,
    stripped,
    /hookDebugLog\s*\(\s*(`(?:[^`\\]|\\.)*`)/g,
  );
});

test("PROV-05: every provider file is scanned for token interpolation in an Error or notifyFn message", async () => {
  // Each provider descriptor file carries credential-shaping logic
  // (credentialFrom) and endpoint/clientId literals. A regression that
  // interpolated a token into an Error or notifyFn here would leak it, so the
  // AUTH-09 gate must cover the whole provider set, not just github-auth.ts.
  const errorOrNotifyWithToken =
    /(new\s+Error\s*\(|notifyFn\s*\()(?:[^)]*\$\{[^}]*(access_?token|cred\.[a-z]+|r\.accessToken)|[^)]*\+\s*(access_?token|cred\.[a-z]+|r\.accessToken))/i;

  assert.ok(
    PROVIDER_FILES.length > 0,
    "D-07-03: with no provider file declared, the PROV-05 scan reports success having opened nothing.",
  );

  const visited: string[] = [];
  for (const rel of PROVIDER_FILES) {
    const absPath = path.join(REPO_ROOT, rel);
    const src = await readFile(absPath, "utf8");
    visited.push(rel);
    const stripped = stripComments(src);
    assert.equal(
      errorOrNotifyWithToken.test(stripped),
      false,
      `Error or notifyFn in ${rel} interpolates a token field (AUTH-09 violation)`,
    );
    assertNoCredentialInLiterals(rel, stripped, ERROR_OR_NOTIFY_FN_LITERAL_CALL_SITE);
  }

  assert.deepEqual(
    visited,
    [...PROVIDER_FILES],
    "D-07-03: the scan must have opened every declared provider file; one that stopped resolving drops out of this list.",
  );
});

test("AUTH-09: orchestrators/marketplace/{add,update}.ts never interpolate a credential field in an Error or ctx.ui.notify message", async () => {
  // Closes review WR-02. The two marketplace verbs construct the Device Flow
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

  assert.ok(
    CREDENTIAL_CAPTURING_ORCHESTRATORS.length > 0,
    "D-07-03: with no credential-capturing orchestrator declared, this scan reports success having opened nothing.",
  );

  const visited: string[] = [];
  for (const rel of CREDENTIAL_CAPTURING_ORCHESTRATORS) {
    const absPath = path.join(REPO_ROOT, rel);
    const src = await readFile(absPath, "utf8");
    visited.push(rel);
    const stripped = stripComments(src);
    assert.equal(
      forbidden.test(stripped),
      false,
      `Error or ctx.ui.notify in ${rel} interpolates a credential field (AUTH-09 violation; closes review WR-02)`,
    );
    assertNoCredentialInLiterals(rel, stripped, ERROR_OR_UI_NOTIFY_LITERAL_CALL_SITE);
  }

  assert.deepEqual(
    visited,
    [...CREDENTIAL_CAPTURING_ORCHESTRATORS],
    "D-07-03: the scan must have opened both credential-capturing orchestrators; one that stopped resolving drops out of this list.",
  );
});
