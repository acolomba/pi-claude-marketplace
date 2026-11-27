import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { ManualRecoveryError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import { resolveCommandError } from "../../extensions/pi-claude-marketplace/shared/notification-command-error.ts";
import {
  notify,
  notifyCommandError,
} from "../../extensions/pi-claude-marketplace/shared/notification-dispatch.ts";
import {
  composeReconcileAppliedBody,
  formatEnvelopeArguments,
  formatRawSurface,
  renderMarketplaceNotAdded,
} from "../../extensions/pi-claude-marketplace/shared/notification-grammar.ts";
import { toWirePayload } from "../../extensions/pi-claude-marketplace/shared/notification-json.ts";
import { presentNotification } from "../../extensions/pi-claude-marketplace/shared/notification-present.ts";
import { resolveRawSurface } from "../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";
import { createCommandRunState } from "../../extensions/pi-claude-marketplace/shared/notification-run.ts";
import { createJsonCapture } from "../edge/json-capture.ts";
import { runWithAllLoaded } from "../shared/notification-run-seeds.ts";

import { CREDENTIAL_LEAK_TARGETS, EXTENSION_ROOT_REL } from "./gate-targets.ts";
import { REPO_ROOT, stripComments } from "./source-scan.ts";

import type { NotificationContext } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { NotificationPresentation } from "../../extensions/pi-claude-marketplace/shared/notification-present.ts";
import type {
  MarketplaceNotificationMessage,
  NotificationMessage,
  PluginNotificationMessage,
  RawSurface,
} from "../../extensions/pi-claude-marketplace/shared/notification-types.ts";

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
 *   2. The git modules, platform/git.ts and platform/git-process.ts, MUST
 *      NOT put a credential field into a message or a debug line. Error
 *      messages reference operation name + exit code or timeout-ms only.
 *
 * Every file each scan addresses is declared in `CREDENTIAL_LEAK_TARGETS`
 * (`test/architecture/gate-targets.ts`), and each scan asserts it opened what
 * it declared. A target that stops resolving FAILS its scan rather than leaving
 * it vacuously satisfied: a gate that greens over a file it never read buys
 * confidence it has not earned (D-07-03).
 *
 * Comment stripping: docstrings can legitimately mention these field names
 * (this very file does). Both tests strip `/\* ... *\/` blocks and `//`
 * line comments before applying the forbidden-pattern regex so the gate
 * only catches the semantic uses.
 */

/**
 * The AUTH-09 group in its declared order, split into the subsets each scan
 * below covers. Position is what aims each scan, so the whole subpath of each
 * module under the extension root is pinned in the first case (D-07-03): a
 * member reordered, added, or dropped in the registry would otherwise point a
 * regex at a file it was never written for and still report success. A
 * basename would leave that pin green for an entry repointed at a different
 * module of the same name.
 */
const [
  STATE_IO_FILE,
  MIGRATE_FILE,
  WITH_STATE_GUARD_FILE,
  GIT_PLATFORM_FILE,
  MARKETPLACE_ADD_FILE,
  MARKETPLACE_UPDATE_FILE,
  HOSTED_MANIFEST_FETCH_FILE,
  GIT_PROCESS_FILE,
  AUTH_HOST_FILE,
  PLUGIN_UPDATE_FLOW_FILE,
] = CREDENTIAL_LEAK_TARGETS;

/**
 * The modules the destructuring above binds, in registry order, each spelled
 * relative to the extension root.
 */
const DECLARED_MODULE_ORDER: ReadonlyArray<string> = [
  "persistence/state-io.ts",
  "persistence/migrate.ts",
  "transaction/with-state-guard.ts",
  "platform/git.ts",
  "orchestrators/marketplace/add.ts",
  "orchestrators/marketplace/update.ts",
  "platform/hosted-manifest-fetch.ts",
  "platform/git-process.ts",
  "orchestrators/auth-host.ts",
  "orchestrators/plugin/update-flow.ts",
];

const STATE_WRITE_FILES: ReadonlyArray<string> = [
  STATE_IO_FILE,
  MIGRATE_FILE,
  WITH_STATE_GUARD_FILE,
];

const FORBIDDEN_STATE_FIELDS = /\b(password|access_token|githubToken|gitToken)\b/i;

/**
 * The orchestrator modules that build the host-bound credential bundles and
 * place the GAUTH-04 stored-credential hint: the two marketplace verbs, the
 * bundle module, and the plugin update verb. Each is scanned for a credential
 * interpolated into an Error or a notify message.
 */
const CREDENTIAL_CAPTURING_ORCHESTRATORS: ReadonlyArray<string> = [
  MARKETPLACE_ADD_FILE,
  MARKETPLACE_UPDATE_FILE,
  AUTH_HOST_FILE,
  PLUGIN_UPDATE_FLOW_FILE,
];

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
  assert.deepStrictEqual(
    offenders,
    [],
    `AUTH-09 violation: a message template literal in ${rel} interpolates a credential field past a literal ) or beyond the first interpolation: ${offenders.join(", ")}`,
  );
}

/** The `new Error(\`...\`)` / `ctx.ui.notify(\`...\`)` call forms. */
const ERROR_OR_UI_NOTIFY_LITERAL_CALL_SITE =
  /(?:new\s+Error\s*\(|ctx\.ui\.notify\s*\()\s*(`(?:[^`\\]|\\.)*`)/g;

test("AUTH-09: no credential field name appears in any state-write code path", async () => {
  assert.ok(
    CREDENTIAL_LEAK_TARGETS.length > 0,
    "D-07-03: an empty CREDENTIAL_LEAK_TARGETS leaves every scan in this gate reporting success over zero declared files.",
  );
  assert.deepStrictEqual(
    CREDENTIAL_LEAK_TARGETS.map((rel) => path.relative(EXTENSION_ROOT_REL, rel)),
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

  assert.deepStrictEqual(
    visited,
    [...STATE_WRITE_FILES],
    "D-07-03: the scan must have opened every declared state-write path; one that stopped resolving drops out of this list.",
  );
  assert.deepStrictEqual(
    offenders,
    [],
    `AUTH-09 violation: state-write code path leaks a credential field name:\n  ${offenders.join("\n  ")}`,
  );
});

test("AUTH-09: platform/git-process.ts never puts a credential or a run's stdout in a message or a debug line", async () => {
  const absPath = path.join(REPO_ROOT, GIT_PROCESS_FILE);
  const exists = await access(absPath).then(
    () => true,
    () => false,
  );
  assert.ok(
    exists,
    `D-07-03: ${GIT_PROCESS_FILE} is declared in CREDENTIAL_LEAK_TARGETS but does not resolve, so the scan below would report success having opened nothing.`,
  );

  // A run's stdout is what git printed, which no message or debug line repeats.
  const stripped = stripComments(await readFile(absPath, "utf8"));
  const messageCallSite = /(?:new\s+(?:GitCommand)?Error|hookDebugLog)\s*\(\s*(`(?:[^`\\]|\\.)*`)/g;
  const literals = fullTemplateLiteralsAfter(stripped, messageCallSite);
  assert.ok(
    literals.length > 0,
    `D-07-03: no message or debug-log template literal exists in ${GIT_PROCESS_FILE}, so the scan below passes over nothing. Re-aim the gate at the module that now builds them.`,
  );

  assertNoCredentialInLiterals(GIT_PROCESS_FILE, stripped, messageCallSite);
  const runOutput = literals.filter((lit) => /\$\{[^}]*\bstdout\b/.test(lit));
  assert.deepStrictEqual(
    runOutput,
    [],
    `AUTH-09 violation: a message or debug-log template literal in ${GIT_PROCESS_FILE} interpolates a run's stdout: ${runOutput.join(", ")}`,
  );
});

/**
 * D-PL5-07: a request member or a header name that would send something of
 * the user's: a `headers`, `credentials`, `authorization`, or `cookie` key or
 * shorthand member, an `authorization` or `cookie` string, or a property of
 * that name. Reading `response.headers` stays allowed.
 */
const REQUEST_CREDENTIAL_MEMBER =
  /\b(?:headers|credentials|authorization|cookie)\s*:|[{,]\s*(?:headers|credentials)\s*[,}]|["'`](?:authorization|cookie)["'`]|\.(?:credentials|authorization|cookie)\b/i;

test("AUTH-09 / D-PL5-07: platform/hosted-manifest-fetch.ts sends no header, credential, or cookie", async () => {
  const absPath = path.join(REPO_ROOT, HOSTED_MANIFEST_FETCH_FILE);
  const exists = await access(absPath).then(
    () => true,
    () => false,
  );
  assert.ok(
    exists,
    `D-07-03: ${HOSTED_MANIFEST_FETCH_FILE} is declared in CREDENTIAL_LEAK_TARGETS but does not resolve, so the scan below would report success having opened nothing.`,
  );

  const stripped = stripComments(await readFile(absPath, "utf8"));
  assert.match(
    stripped,
    /\bfetch\(/,
    `D-07-03: ${HOSTED_MANIFEST_FETCH_FILE} calls no fetch, so this scan passes over nothing. Re-aim it at the module that downloads a hosted catalog.`,
  );
  assert.doesNotMatch(
    stripped,
    REQUEST_CREDENTIAL_MEMBER,
    `AUTH-09 / D-PL5-07 violation: ${HOSTED_MANIFEST_FETCH_FILE} names a request header, credential, or cookie`,
  );
});

test("AUTH-09: the git hookDebugLog calls never interpolate a credential field", async () => {
  // platform/git.ts logs with hookDebugLog around the ssh probe and settings
  // reads, and this scan keeps a credential field out of those calls. That
  // call form is not `new Error(...)`, so it falls outside every other gate in
  // this file; this test closes that gap.
  //
  // Two checks combine here. The
  // first is the original bounded-prefix scan, kept unchanged so it still
  // catches every case it already covers. The second closes a proven bypass:
  // `[^)]*` does not allow a literal `)` before the interpolation it is
  // scanning for, and a message text may contain one (such as
  // `` `reject() threw for ${host}: ...` `` -- the literal `)` in "reject()"
  // stops the scan before it ever reaches EITHER `${...}`). The second check captures the COMPLETE template literal
  // following each `hookDebugLog(` as one token and scans it in full, so a
  // leak appended after a nested function call's closing paren (e.g. after
  // `${errorMessage(err)}`) is caught too.
  const hookDebugLogWithToken =
    /hookDebugLog\s*\((?:[^)]*\$\{[^}]*(access_?token|cred\.[a-z]+|r\.accessToken)|[^)]*\+\s*(access_?token|cred\.[a-z]+|r\.accessToken))/i;
  const hookDebugLogCall = /hookDebugLog\s*\(/g;
  const SCANNED = [GIT_PLATFORM_FILE];

  const sources = new Map<string, string>();
  let scannedCallSites = 0;
  for (const rel of SCANNED) {
    const src = await readFile(path.join(REPO_ROOT, rel), "utf8");
    const stripped = stripComments(src);
    sources.set(rel, stripped);
    scannedCallSites += [...stripped.matchAll(hookDebugLogCall)].length;
  }

  // D-07-03: the subject is counted BEFORE either check runs, because both
  // checks are satisfied by a file that holds no `hookDebugLog(` at all --
  // which is how an AUTH-09 scan aimed at a module the calls no longer live in
  // reports success over nothing.
  assert.ok(
    scannedCallSites > 0,
    `AUTH-09 / D-07-03: no hookDebugLog call site exists in ${SCANNED.join(" or ")}, so both checks below pass over nothing. Re-aim the gate at the module that now carries the calls.`,
  );

  for (const [rel, stripped] of sources) {
    assert.doesNotMatch(
      stripped,
      hookDebugLogWithToken,
      `hookDebugLog in ${rel} interpolates a credential field (AUTH-09 violation)`,
    );

    assertNoCredentialInLiterals(rel, stripped, /hookDebugLog\s*\(\s*(`(?:[^`\\]|\\.)*`)/g);
  }
});

test("AUTH-09: the credential-capturing orchestrators never interpolate a credential field in an Error or ctx.ui.notify message", async () => {
  // Closes review WR-02. These modules bind each request to its host and
  // place the GAUTH-04 stored-credential hint; a bundle holds only the host
  // (D-SG-27). A future
  // regression that interpolated a credential field into an Error or a
  // notify message would still be an AUTH-09 violation, so this gate scans
  // for that class of bug in the orchestrator files.
  //
  // Forbidden is a template literal OR string concatenation that interpolates
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
    assert.doesNotMatch(
      stripped,
      forbidden,
      `Error or ctx.ui.notify in ${rel} interpolates a credential field (AUTH-09 violation; closes review WR-02)`,
    );
    assertNoCredentialInLiterals(rel, stripped, ERROR_OR_UI_NOTIFY_LITERAL_CALL_SITE);
  }

  assert.deepStrictEqual(
    visited,
    [...CREDENTIAL_CAPTURING_ORCHESTRATORS],
    "D-07-03: the scan must have opened every credential-capturing orchestrator; one that stopped resolving drops out of this list.",
  );
});

test("AUTH-09 / GAUTH-04: the stored-credential hint in orchestrators/auth-host.ts interpolates the host and nothing else", async () => {
  // The hint is a String.raw literal, not an Error or notify literal, so the
  // scan above never reads it. Its `password=<token>` text is a placeholder,
  // so this scan pins the interpolations instead of the field names.
  const stripped = stripComments(await readFile(path.join(REPO_ROOT, AUTH_HOST_FILE), "utf8"));
  const hints = fullTemplateLiteralsAfter(
    stripped,
    /NO_STORED_CREDENTIAL_CAUSE\b[^=]*=[^`]*String\.raw\s*(`(?:[^`\\]|\\.)*`)/g,
  );
  assert.strictEqual(
    hints.length,
    1,
    `D-07-03: ${AUTH_HOST_FILE} must define NO_STORED_CREDENTIAL_CAUSE as one String.raw literal, or this scan passes over nothing. Re-aim it at the module that now builds the hint.`,
  );

  const interpolations = [...(hints[0] ?? "").matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1]);
  assert.deepStrictEqual(
    interpolations,
    ["host", "host"],
    `AUTH-09 violation: the stored-credential hint in ${AUTH_HOST_FILE} interpolates more than the host`,
  );
});

/**
 * AUTH-09 / PMOD-04 (D-07): the JSON path. Each row plants one credential at
 * one site that can carry a thrown message and reads three strings back: the
 * presentation (or the resolved raw surface), the JSON strategy's payload, and
 * the text the text strategy builds from the same value. A structured message
 * reaches its text through `notify`, the production text strategy, so a
 * credential that the dispatch formatter re-introduces fails the row. A raw
 * surface reaches its text through `formatRawSurface`.
 *
 * The subject-name rows compose their text with `formatEnvelopeArguments` over
 * the grammar function the text strategy uses for that presentation kind. The
 * block and row subjects sit in a reconcile-applied cascade, whose text body is
 * `composeReconcileAppliedBody`. They make no notify call, because D-13
 * approves exactly the nine gate emissions and the corpus lock rejects any
 * further one.
 */
interface LeakProbe {
  readonly presentation: string;
  readonly payload: string;
  readonly text: string;
}

const GITHUB_TOKEN = "ghp_0123456789abcdefghijklmnopqrstuvwxyz"; // trufflehog:ignore -- fake token fixture
const USERINFO_URL = "https://alice:s3cret@github.com/o/r.git";
const USERINFO = ["alice:s3cret@", "s3cret"];
const FAILED_ADD_SOURCE = "https://alice:s3cret@gitlab.example.com/team/private-mp";
// The reconcile planner splits the `enabledPlugins` key
// `foo@https://alice:s3cret@github.com/o/r.git` at its last `@`. That `@` ends
// the URL userinfo, so the plugin half keeps the password with no `@` after it.
const SPLIT_KEY_PLUGIN = "foo@https://alice:s3cret";
const SPLIT_KEY_MARKETPLACE = "github.com/o/r.git";

function probePresentation(message: NotificationMessage): LeakProbe {
  const presentation = presentNotification(runWithAllLoaded(), message);
  const delivered: string[] = [];
  const ctx: NotificationContext = {
    mode: "tui",
    hasUI: true,
    ui: {
      notify: (text) => {
        delivered.push(text);
      },
    },
  };
  notify(ctx, runWithAllLoaded(), message);
  assert.strictEqual(delivered.length, 1, "AUTH-09 / PMOD-04: notify delivers one text");
  return {
    presentation: JSON.stringify(presentation),
    payload: JSON.stringify(
      toWirePayload(presentation, {
        kind: "command",
        commandId: "plugin",
        invocationId: "test-run",
      }),
    ),
    text: delivered.join("\n"),
  };
}

function probeRawSurface(surface: RawSurface): LeakProbe {
  const resolved = resolveRawSurface(surface);
  return {
    presentation: JSON.stringify(resolved),
    payload: JSON.stringify(
      toWirePayload(resolved, { kind: "command", commandId: "plugin", invocationId: "test-run" }),
    ),
    text: formatRawSurface(resolved, "/reload")?.[0] ?? "",
  };
}

function probeComposedText(presentation: NotificationPresentation, body: string): LeakProbe {
  return {
    presentation: JSON.stringify(presentation),
    payload: JSON.stringify(
      toWirePayload(presentation, {
        kind: "command",
        commandId: "plugin",
        invocationId: "test-run",
      }),
    ),
    text: formatEnvelopeArguments(presentation.envelope, body, "/reload")[0],
  };
}

function probeReconcileAppliedSubject(
  marketplaces: readonly MarketplaceNotificationMessage[],
): LeakProbe {
  const presentation = presentNotification(runWithAllLoaded(), {
    kind: "reconcile-applied-cascade",
    marketplaces,
  });
  assert.ok(
    presentation.kind === "reconcile-applied-cascade",
    "AUTH-09 / PMOD-04: the message presents a reconcile-applied cascade",
  );
  return probeComposedText(presentation, composeReconcileAppliedBody(presentation.marketplaces));
}

function probeNotAddedSubject(message: NotificationMessage): LeakProbe {
  const presentation = presentNotification(runWithAllLoaded(), message);
  assert.ok(
    presentation.kind === "marketplace-not-added",
    "AUTH-09 / PMOD-04: the message presents a marketplace-not-added",
  );
  return probeComposedText(
    presentation,
    renderMarketplaceNotAdded(presentation.message, presentation.reason),
  );
}

function rowCascade(row: PluginNotificationMessage): NotificationMessage {
  return { marketplaces: [{ name: "mp", scope: "user", plugins: [row] }] };
}

/**
 * Fails with an `AUTH-09 / PMOD-04` message when any of the three strings
 * carries a planted credential, or when the payload or the text lacks the
 * `***` marker that shows the redaction ran.
 */
function assertNoPlantedCredential(probe: LeakProbe, planted: readonly string[]): void {
  const fields = [
    ["presentation", probe.presentation],
    ["payload", probe.payload],
    ["text", probe.text],
  ] as const;
  for (const [field, text] of fields) {
    for (const secret of planted) {
      assert.ok(
        !text.includes(secret),
        `AUTH-09 / PMOD-04: the ${field} shows a planted credential`,
      );
    }
  }

  assert.ok(probe.payload.includes("***"), "AUTH-09 / PMOD-04: the payload lacks the *** marker");
  assert.ok(probe.text.includes("***"), "AUTH-09 / PMOD-04: the text lacks the *** marker");
}

const PLANTED_CREDENTIAL_SITES: ReadonlyArray<{
  readonly site: string;
  readonly planted: readonly string[];
  readonly probe: () => LeakProbe;
}> = [
  {
    site: "a failed row's cause",
    planted: USERINFO,
    probe: () =>
      probePresentation(
        rowCascade({
          name: "alpha",
          status: "failed",
          severity: "error",
          reasons: [],
          cause: new Error(`clone ${USERINFO_URL} failed`),
        }),
      ),
  },
  {
    site: "a failed row's cause whose password carries an @",
    planted: ["alice:p@ss@", "@ss@"],
    probe: () =>
      probePresentation(
        rowCascade({
          name: "alpha",
          status: "failed",
          severity: "error",
          reasons: [],
          cause: new Error("clone https://alice:p@ss@github.com/o/r.git failed"),
        }),
      ),
  },
  {
    site: "a rollback entry's cause",
    planted: [GITHUB_TOKEN],
    probe: () =>
      probePresentation(
        rowCascade({
          name: "alpha",
          status: "failed",
          severity: "error",
          reasons: ["rollback partial"],
          cause: new Error("install failed"),
          rollbackPartial: [
            { phase: "skills", cause: new Error(`restore with ${GITHUB_TOKEN} failed`) },
          ],
        }),
      ),
  },
  {
    site: "a manual-recovery leak",
    planted: [GITHUB_TOKEN],
    probe: () =>
      probePresentation(
        rowCascade({
          name: "alpha",
          status: "manual recovery",
          severity: "error",
          reasons: ["rollback partial"],
          cause: new ManualRecoveryError("stuck", [`/tmp/clone-${GITHUB_TOKEN}`]),
        }),
      ),
  },
  {
    site: "a disabled row's remedy cause",
    planted: ["tok123secret"],
    probe: () =>
      probePresentation(
        rowCascade({
          name: "alpha",
          status: "disabled",
          severity: "warning",
          needsReload: true,
          cause: new Error("dependency fetch sent x-access-token:tok123secret"),
        }),
      ),
  },
  {
    site: "the reconcile-aborted cause",
    planted: ["abc.def.secret"],
    probe: () =>
      probeRawSurface({
        kind: "reconcile-aborted",
        cause: new Error("fetch with Bearer abc.def.secret failed"),
      }),
  },
  {
    site: "the plugin-path-skipped reason",
    planted: USERINFO,
    probe: () =>
      probeRawSurface({
        kind: "plugin-path-skipped",
        scope: "user",
        reason: `clone ${USERINFO_URL} failed`,
      }),
  },
  {
    site: "a background update row's name and version",
    planted: USERINFO,
    probe: () =>
      probeRawSurface({
        kind: "background-update",
        plugins: [
          {
            name: USERINFO_URL,
            marketplace: "tools",
            scope: "user",
            toVersion: `${USERINFO_URL}#1.1.0`,
          },
        ],
      }),
  },
  {
    site: "the usage-error message",
    planted: [GITHUB_TOKEN],
    probe: () =>
      probeRawSurface({
        kind: "usage-error",
        message: `invalid token ${GITHUB_TOKEN}`,
        usage: "usage: marketplace add <source>",
      }),
  },
  {
    site: "a diagnostic header",
    planted: USERINFO,
    probe: () =>
      probeRawSurface({
        kind: "diagnostic",
        header: `import of ${USERINFO_URL} skipped:`,
        lines: ["  plain line"],
      }),
  },
  {
    site: "a diagnostic line whose secrets are glued to word characters",
    planted: [...USERINFO, GITHUB_TOKEN],
    probe: () =>
      probeRawSurface({
        kind: "diagnostic",
        header: "import skipped:",
        lines: [`  remote_${USERINFO_URL} and x${GITHUB_TOKEN}_suffix rejected`],
      }),
  },
  {
    site: "a diagnostic line",
    planted: ["tok123secret"],
    probe: () =>
      probeRawSurface({
        kind: "diagnostic",
        header: "import skipped:",
        lines: ["  x-access-token:tok123secret rejected"],
      }),
  },
  {
    site: "a url-source marketplace-info",
    planted: USERINFO,
    probe: () =>
      probePresentation({
        kind: "marketplace-info",
        name: "mp",
        scope: "user",
        details: { autoupdate: false },
        source: { sourceKind: "url", url: USERINFO_URL },
      }),
  },
  {
    site: "the prune-committed-warning cause",
    planted: [GITHUB_TOKEN],
    probe: () =>
      probePresentation({
        kind: "prune-committed-warning",
        scope: "user",
        cause: new Error(`state save with ${GITHUB_TOKEN} failed`),
      }),
  },
  {
    site: "a cascade advisory",
    planted: ["abc.def.secret"],
    probe: () =>
      probePresentation({
        marketplaces: [],
        advisories: ["retained staging: Bearer abc.def.secret"],
      }),
  },
  {
    site: "a plugin-info note",
    planted: ["tok123secret"],
    probe: () =>
      probePresentation({
        kind: "plugin-info",
        marketplaceName: "mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "available",
          name: "alpha",
          componentsResolved: false,
          notes: ["workflow wf: x-access-token:tok123secret rejected"],
        },
      }),
  },
  {
    site: "a marketplace block's clone note",
    planted: USERINFO,
    probe: () =>
      probePresentation({
        marketplaces: [
          {
            name: "mp",
            scope: "user",
            status: "added",
            clone: { note: "via-https", url: USERINFO_URL, retries: [USERINFO_URL] },
            plugins: [],
          },
        ],
      }),
  },
  {
    site: "a plugin row's clone note",
    planted: USERINFO,
    probe: () =>
      probePresentation(
        rowCascade({
          name: "alpha",
          status: "installed",
          severity: "info",
          needsReload: true,
          dependencies: [],
          clone: { note: "via-https", url: USERINFO_URL, retries: [USERINFO_URL] },
        }),
      ),
  },
  {
    site: "a plugin-info clone note",
    planted: USERINFO,
    probe: () =>
      probePresentation({
        kind: "plugin-info",
        marketplaceName: "mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "available",
          name: "alpha",
          componentsResolved: false,
          clone: { note: "via-https", url: USERINFO_URL, retries: [USERINFO_URL] },
        },
      }),
  },
  {
    site: "the block name of a failed marketplace add",
    planted: USERINFO,
    probe: () =>
      probeReconcileAppliedSubject([
        {
          name: FAILED_ADD_SOURCE,
          scope: "project",
          status: "failed",
          reasons: ["authentication required"],
          severity: "error",
          plugins: [],
        },
      ]),
  },
  {
    site: "a plugin row name",
    planted: USERINFO,
    probe: () =>
      probeReconcileAppliedSubject([
        { name: "mp", scope: "user", plugins: [{ status: "will install", name: USERINFO_URL }] },
      ]),
  },
  {
    site: "a plugin row name split from an enabledPlugins key",
    planted: USERINFO,
    probe: () =>
      probeReconcileAppliedSubject([
        {
          name: SPLIT_KEY_MARKETPLACE,
          scope: "user",
          status: "failed",
          reasons: ["dangling reference"],
          severity: "error",
          plugins: [
            {
              status: "failed",
              name: SPLIT_KEY_PLUGIN,
              reasons: ["dangling reference"],
              severity: "error",
              needsReload: false,
            },
          ],
        },
      ]),
  },
  {
    site: "the id of a failed row whose subject is a marketplace",
    planted: USERINFO,
    probe: () =>
      probeReconcileAppliedSubject([
        {
          name: USERINFO_URL,
          scope: "project",
          status: "failed",
          severity: "error",
          plugins: [
            {
              status: "failed",
              name: USERINFO_URL,
              reasons: ["network error"],
              marketplaceSubject: true,
              severity: "error",
              needsReload: false,
            },
          ],
        },
      ]),
  },
  {
    site: "the marketplace-not-added name",
    planted: USERINFO,
    probe: () =>
      probeNotAddedSubject({ kind: "marketplace-not-added", name: USERINFO_URL, scope: "user" }),
  },
];

for (const { site, planted, probe } of PLANTED_CREDENTIAL_SITES) {
  test(`AUTH-09 / PMOD-04: neither strategy shows a credential planted in ${site}`, () => {
    // arrange
    const plantedCredentials = planted;

    // act
    const strings = probe();

    // assert
    assertNoPlantedCredential(strings, plantedCredentials);
  });
}

test("AUTH-09 / PMOD-04: the planted-credential assertion reports an unredacted string", () => {
  // arrange
  const unredacted = `clone ${USERINFO_URL} failed`;
  const strings = { presentation: unredacted, payload: unredacted, text: unredacted };

  // act & assert
  assert.throws(
    () => {
      assertNoPlantedCredential(strings, USERINFO);
    },
    (error: unknown) => {
      assert.ok(error instanceof assert.AssertionError);
      assert.match(
        error.message,
        /^AUTH-09 \/ PMOD-04: the presentation shows a planted credential/,
      );
      return true;
    },
  );
});

for (const root of [
  "\\",
  "E:\\",
  "\\\\host\\share\\",
  "\\\\?\\UNC\\host\\share\\",
  "\\\\?\\E:\\",
  "/",
  "//host/share/",
]) {
  for (const { tail, safeMessage } of [
    { tail: "ClientLedger", safeMessage: "open '[path]'" },
    { tail: "O'ClientLedger", safeMessage: "Command failure details omitted." },
    { tail: "\nClientLedger", safeMessage: "Command failure details omitted." },
    { tail: "<ClientLedger>", safeMessage: "Command failure details omitted." },
  ]) {
    for (const mode of ["json", "rpc"]) {
      test(`AUTH-09 root-form delivery and controls: ${JSON.stringify({ root, tail, mode })}`, () => {
        // arrange
        const message = `open '${root}${tail}'`;
        const capture = createJsonCapture();
        const origin = {
          kind: "command",
          commandId: "plugin update",
          invocationId: "root-error",
        } as const;
        const expected = {
          schemaVersion: 1,
          kind: "internal-error",
          origin,
          severity: "error",
          needsReload: false,
          summary: "Command failed unexpectedly.",
          cause: { causeChain: [safeMessage], truncated: false },
        };
        const ctx: NotificationContext = {
          mode,
          hasUI: mode === "tui" || mode === "rpc",
          get ui() {
            return capture.ui;
          },
        };

        // act
        notifyCommandError(
          ctx,
          capture.entrySink,
          origin,
          createCommandRunState(),
          new Error(message),
        );

        // assert
        assert.deepStrictEqual(capture.entries, [
          { customType: "claude-plugin", payload: expected },
        ]);
        capture.assertValid();
        assertSafeCommandPayload(capture.entries, [safeMessage]);
        for (const disclosure of [message, `open '[path]${tail}[path]'`]) {
          const planted = { ...expected, cause: { causeChain: [disclosure], truncated: false } };
          assert.throws(() => {
            assertSafeCommandPayload(planted, [safeMessage]);
          }, assert.AssertionError);
        }
      });
    }
  }
}

/** Checks exact cause messages and every string without inventing a text renderer. */
function assertSafeCommandPayload(payload: unknown, expectedCauseChain: readonly string[]): void {
  if (typeof payload === "string") {
    assert.doesNotMatch(payload, /gh[pousr]_[A-Za-z0-9]+|alice:s3cret|s3cret|Bearer secret123/);
    for (const disclosure of [
      "private",
      "Private Data",
      "用户",
      "秘密",
      "server",
      "file:/",
      "Confidential Client",
      "Connor",
    ]) {
      assert.strictEqual(payload.includes(disclosure), false, `Disclosed ${disclosure}`);
    }

    return;
  }

  if (payload !== null && typeof payload === "object") {
    for (const [key, member] of Object.entries(payload)) {
      if (key === "causeChain") {
        assert.deepStrictEqual(member, expectedCauseChain);
      }

      assertSafeCommandPayload(member, expectedCauseChain);
    }
  }
}

for (const mode of ["json", "rpc"] as const) {
  test(`AUTH-09: internal-error resolution and ${mode} delivery hide credentials and local paths`, () => {
    // arrange
    const capture = createJsonCapture();
    const origin = {
      kind: "command",
      commandId: "plugin update",
      invocationId: "safe-error",
    } as const;
    const cause = new Error(`${USERINFO_URL} Bearer secret123 ${GITHUB_TOKEN}`, {
      cause: new Error(
        "/private/work/config.json C:\\private\\work\\config.json \\\\server file:///private/work/config.json file:/private/work/config.json",
        {
          cause: new Error(
            'open "/Private Data/client/secret.json" and "/用户/秘密/config.json" and "C:\\Private Data\\client\\secret.json"; failed at:/private/work/config.json',
          ),
        },
      ),
    });
    const ctx: NotificationContext = {
      mode,
      hasUI: mode === "rpc",
      get ui() {
        return capture.ui;
      },
    };
    const expected = {
      schemaVersion: 1,
      kind: "internal-error",
      origin,
      severity: "error",
      needsReload: false,
      summary: "Command failed unexpectedly.",
      cause: {
        causeChain: [
          "https://***@github.com/o/r.git Bearer *** ***",
          "[path]",
          "Command failure details omitted.",
        ],
        truncated: false,
      },
    };

    // act
    const converted = toWirePayload(resolveCommandError(cause, false), origin);
    notifyCommandError(ctx, capture.entrySink, origin, createCommandRunState(), cause);

    // assert
    assert.deepStrictEqual(converted, expected);
    assert.deepStrictEqual(capture.entries, [{ customType: "claude-plugin", payload: expected }]);
    assertSafeCommandPayload(converted, expected.cause.causeChain);
    assertSafeCommandPayload(capture.entries, expected.cause.causeChain);
    capture.assertValid();
  });
}

for (const message of [
  "ENOENT: no such file or directory, open '/tmp/review-absent/'Confidential Client'/secret.json'",
  "ENOENT: no such file or directory, open '/tmp/review-absent/O'Connor/secret.json'",
  "ENOENT: no such file or directory, open '/tmp/review-absent/\nConfidential Client/secret.json'",
  "failed at /Users/<Confidential Client>/secret.json",
]) {
  for (const mode of ["json", "rpc"]) {
    test(`AUTH-09: ${mode} omits ambiguous directory details in ${JSON.stringify(message)}`, () => {
      // arrange
      const capture = createJsonCapture();
      const origin = {
        kind: "command",
        commandId: "plugin update",
        invocationId: "safe-error",
      } as const;
      const ctx: NotificationContext = {
        mode,
        hasUI: mode === "tui" || mode === "rpc",
        get ui() {
          return capture.ui;
        },
      };

      // act
      notifyCommandError(
        ctx,
        capture.entrySink,
        origin,
        createCommandRunState(),
        new Error(message),
      );

      // assert
      assert.deepStrictEqual(capture.entries, [
        {
          customType: "claude-plugin",
          payload: {
            schemaVersion: 1,
            kind: "internal-error",
            origin,
            severity: "error",
            needsReload: false,
            summary: "Command failed unexpectedly.",
            cause: { causeChain: ["Command failure details omitted."], truncated: false },
          },
        },
      ]);
      assertSafeCommandPayload(capture.entries, ["Command failure details omitted."]);
      capture.assertValid();
    });
  }
}

for (const [name, disclosure] of [
  ["quoted directory suffix", "open '[path]'Confidential Client'[path]'"],
  ["apostrophe directory suffix", "open '[path]'Connor[path]'"],
  ["newline directory suffix", "open '[path]\nConfidential Client[path]'"],
  ["angle-bracket directory suffix", "failed at [path]<Confidential Client>[path]"],
  ["credential", GITHUB_TOKEN],
  ["userinfo", USERINFO_URL],
  ["bearer token", "Bearer secret123"],
  ["POSIX path", "/private/work/config.json"],
  ["Windows path", "C:\\private\\work\\config.json"],
  ["bare UNC root", "\\\\server"],
  ["file URL", "file:///private/work/config.json"],
  ["single-slash file URL", "file:/private/work/config.json"],
  ["spaced POSIX path", "/Private Data/client/secret.json"],
  ["Unicode path", "/用户/秘密/config.json"],
  ["spaced Windows path", "C:\\Private Data\\client\\secret.json"],
  ["colon-prefixed path", "failed at:/private/work/config.json"],
  ["partially masked path", "[path] Data/秘密/config.json"],
] as const) {
  test(`AUTH-09 control: the whole command payload check rejects a planted ${name}`, () => {
    // arrange
    const origin = {
      kind: "command",
      commandId: "plugin update",
      invocationId: "planted-error",
    } as const;
    const payload = toWirePayload(
      resolveCommandError(new Error("operation failed"), false),
      origin,
    );
    const planted = { ...payload, cause: { causeChain: [disclosure], truncated: false } };

    // act & assert
    assert.throws(() => {
      assertSafeCommandPayload(planted, ["operation failed"]);
    }, assert.AssertionError);
  });
}
