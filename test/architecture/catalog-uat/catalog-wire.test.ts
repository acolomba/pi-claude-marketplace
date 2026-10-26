/**
 * JOUT-02 / WIRE-01 / WIRE-05: every catalog example and every raw kind
 * converts to a payload the one wire union accepts.
 *
 * Each fixture presents once, through its own notification run, before any
 * conversion: the strict fixture Pi allows exactly one run's probe reads, so a
 * second presentation would fail, and no converter case re-probes. A fixture
 * whose bytes come from an `emit` closure supplies its own `present` hook.
 *
 * Validation reads `JSON.parse(JSON.stringify(payload))`, the bytes a consumer
 * receives, because the compiled validator accepts an `undefined` optional
 * member. The converter is a parameter so the controls can prove the check
 * fires. D-12: validation lives in tests only; production never compiles the
 * schema.
 *
 * WIRE-08 / D-10 / NFR-9: a whole-payload walk over the same payloads finds no
 * absolute path the text form does not show, no live `Error` or other class
 * instance, no `undefined` or `null` member, no function or symbol, and no
 * non-finite number. The text form is the catalog block for a catalog example
 * and the `formatRawSurface` text for a raw sample. The walk reads the
 * unserialized payload, because a round trip would drop the offenders.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { Compile } from "typebox/compile";

import { resolveCommandError } from "../../../extensions/pi-claude-marketplace/shared/notification-command-error.ts";
import {
  notify,
  notifyAsyncRewakeSummary,
  notifyAutoapplyStatus,
  notifyCommandError,
  notifyDeviceFlowPrompt,
  notifyDiagnostic,
  notifyMcpConfigNotices,
  notifyMcpMigration,
  notifyPluginPathSkipped,
  notifyReconcileAborted,
  notifyStopHookOverrideCap,
  notifyUsageError,
  notifyUsageInfo,
} from "../../../extensions/pi-claude-marketplace/shared/notification-dispatch.ts";
import { formatRawSurface } from "../../../extensions/pi-claude-marketplace/shared/notification-grammar.ts";
import { toWirePayload } from "../../../extensions/pi-claude-marketplace/shared/notification-json.ts";
import { presentNotification } from "../../../extensions/pi-claude-marketplace/shared/notification-present.ts";
import { resolveRawSurface } from "../../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";
import {
  createCommandRunState,
  openNotificationRun,
} from "../../../extensions/pi-claude-marketplace/shared/notification-run.ts";
import { NOTIFICATION_PAYLOAD_SCHEMA } from "../../../extensions/pi-claude-marketplace/shared/notification-wire.ts";
import { createJsonCapture } from "../../edge/json-capture.ts";

import { loadCatalogExamples, type CatalogExample } from "./catalog-parser.ts";
import { FIXTURE_MAPS, mergeFixtureMaps, tupleKey } from "./fixture-maps.ts";
import { piWithAllLoaded, verifyPi } from "./mock-pi.ts";

import type { CatalogFixture, FixtureMap } from "./fixture-types.ts";
import type { NotificationContext } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { NotificationPresentation } from "../../../extensions/pi-claude-marketplace/shared/notification-present.ts";
import type { ResolvedRawSurface } from "../../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";
import type {
  NotificationOrigin,
  NotificationRun,
} from "../../../extensions/pi-claude-marketplace/shared/notification-run.ts";
import type {
  NotificationMessage,
  RawSurface,
} from "../../../extensions/pi-claude-marketplace/shared/notification-types.ts";

type PayloadSource = NotificationPresentation | ResolvedRawSurface;
type Converter = (source: PayloadSource, origin: NotificationOrigin) => unknown;

/** One presented catalog example or raw sample, ready to convert. */
interface PresentedSource {
  readonly section: string;
  readonly state: string;
  readonly text: string;
  readonly source: PayloadSource;
  readonly origin: NotificationOrigin;
}

interface PresentedCatalog extends PresentedSource {
  readonly fixture: CatalogFixture;
  readonly run: NotificationRun;
}

/** One payload the compiled union rejected, named by its catalog tuple. */
interface ValidationFailure {
  readonly section: string;
  readonly state: string;
  readonly errors: readonly string[];
}

interface ConvertedPayload {
  readonly section: string;
  readonly state: string;
  readonly payload: unknown;
}

interface HarnessReport {
  readonly failures: readonly ValidationFailure[];
  readonly converted: readonly ConvertedPayload[];
}

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const CATALOG_PATH = path.join(REPO_ROOT, "docs/output-catalog.md");
const RAW_SECTION = "raw surface";
const PAYLOAD_VALIDATOR = Compile(NOTIFICATION_PAYLOAD_SCHEMA);
const PRUNE_WARNING_KEY = "/claude:plugin prune::committed-warning";
const PATH_SOURCE_INFO_KEY = "/claude:plugin marketplace info <name>::path-single-scope";

const CATALOG_COMMANDS = new Map([
  ["/claude:plugin list", "plugin list"],
  ["/claude:plugin install <plugin>@<marketplace>", "plugin install"],
  ["/claude:plugin uninstall <plugin>@<marketplace>", "plugin uninstall"],
  ["/claude:plugin prune", "plugin prune"],
  ["/claude:plugin reinstall", "plugin reinstall"],
  ["/claude:plugin update", "plugin update"],
  ["/claude:plugin fetch", "plugin fetch"],
  ["/claude:plugin import", "plugin import"],
  ["/claude:plugin bootstrap", "plugin bootstrap"],
  ["/claude:plugin marketplace list", "marketplace list"],
  ["/claude:plugin marketplace add <source>", "marketplace add"],
  ["/claude:plugin marketplace info <name>", "marketplace info"],
  ["/claude:plugin info <plugin>@<marketplace>", "plugin info"],
  ["/claude:plugin pending", "plugin pending"],
  ["/claude:plugin apply", "plugin apply"],
  ["/claude:plugin marketplace remove <name>", "marketplace remove"],
  ["/claude:plugin marketplace update [<name>]", "marketplace update"],
  ["/claude:plugin enable <plugin>@<marketplace>", "plugin enable"],
  ["/claude:plugin disable <plugin>@<marketplace>", "plugin disable"],
  ["manual-recovery-anchors", "plugin disable"],
  ["planted section", "plugin"],
]);

function catalogOrigin(example: CatalogExample): NotificationOrigin {
  if (example.section === "reconcile-applied-cascade") {
    return { kind: "load" };
  }

  const commandId =
    example.section === "/claude:plugin marketplace autoupdate|noautoupdate [<name>]"
      ? example.state.startsWith("disable-")
        ? "marketplace noautoupdate"
        : "marketplace autoupdate"
      : CATALOG_COMMANDS.get(example.section);
  assert.ok(commandId, `Unassigned catalog origin: ${example.section}`);

  return { kind: "command", commandId, invocationId: tupleKey(example.section, example.state) };
}

const RAW_ORIGINS: Readonly<Record<RawSurface["kind"], NotificationOrigin>> = {
  "usage-error": { kind: "command", commandId: "plugin install", invocationId: "raw-usage-error" },
  "usage-info": { kind: "command", commandId: "plugin list", invocationId: "raw-usage-info" },
  "autoapply-status": {
    kind: "command",
    commandId: "plugin autoapply",
    invocationId: "raw-autoapply-status",
  },
  diagnostic: { kind: "command", commandId: "plugin import", invocationId: "raw-diagnostic" },
  "device-flow-prompt": {
    kind: "command",
    commandId: "marketplace add",
    invocationId: "raw-device-flow",
  },
  "async-rewake-summary": { kind: "hook" },
  "stop-override-cap": { kind: "hook" },
  "reconcile-aborted": { kind: "load" },
  "plugin-path-skipped": { kind: "load" },
  "mcp-config-notices": {
    kind: "command",
    commandId: "plugin install",
    invocationId: "raw-mcp-config-notices",
  },
  "mcp-migration": { kind: "load" },
};

/**
 * WIRE-08 / NFR-9: an absolute path in the shape `redactAbsolutePaths` matches,
 * plus a UNC root: a POSIX root, a Windows drive root, or a UNC or long-path
 * root. The anchor keeps a URL's scheme and slashes from starting a match. A
 * path embedded mid-string, as in a cause-chain link, still matches.
 */
const ABSOLUTE_PATH =
  /(?<![\w:/\\])(?:[A-Za-z]:[\\/]|\\\\\?\\|\\\\|\/)[\w./\\~-]+[\\/][\w./\\~-]+/g;

/** One sample per raw kind; a kind missing from the table fails typecheck. */
const RAW_SAMPLES: { readonly [K in RawSurface["kind"]]: Extract<RawSurface, { kind: K }> } = {
  "usage-error": {
    kind: "usage-error",
    message: "unknown flag --bogus",
    usage: "Usage: /claude:plugin install <plugin>@<marketplace>",
  },
  "usage-info": { kind: "usage-info", usage: "Usage: /claude:plugin list [--scope <scope>]" },
  "autoapply-status": {
    kind: "autoapply-status",
    enabled: true,
    source: { scope: "project", file: "claude-plugins.json" },
    files: [
      { scope: "user", file: "claude-plugins.json" },
      { scope: "project", file: "claude-plugins.json", value: true },
    ],
  },
  diagnostic: {
    kind: "diagnostic",
    header: "import: 1 warning",
    lines: ["skipped settings entry: not an object"],
  },
  "device-flow-prompt": {
    kind: "device-flow-prompt",
    verificationUri: "https://github.com/login/device",
    userCode: "ABCD-1234",
  },
  "async-rewake-summary": { kind: "async-rewake-summary", summary: "Background checks finished." },
  "stop-override-cap": { kind: "stop-override-cap", pluginId: "guard@official", cap: 8 },
  "reconcile-aborted": { kind: "reconcile-aborted", cause: new Error("state unreadable") },
  "plugin-path-skipped": {
    kind: "plugin-path-skipped",
    scope: "user",
    reason: "EACCES: permission denied, open '/home/user/.pi/agent/bin'",
  },
  "mcp-config-notices": {
    kind: "mcp-config-notices",
    section: "variables-missing",
    notices: [
      {
        kind: "variables-missing",
        scope: "project",
        file: "mcp-adapter.json",
        plugin: "hello",
        server: "plugin_hello_srv_",
        names: ["DD_SITE"],
      },
    ],
  },
  "mcp-migration": {
    kind: "mcp-migration",
    rows: [
      {
        kind: "moved",
        scope: "user",
        plugin: "acme",
        marketplace: "official",
        from: "slack",
        to: "plugin_acme_slack_",
      },
    ],
    notices: [],
  },
};

/** The message the byte contract notifies for `fixture`, with the list label it injects. */
function catalogMessage(section: string, fixture: CatalogFixture): NotificationMessage {
  return section === "/claude:plugin list" && "marketplaces" in fixture.message
    ? { ...fixture.message, label: "Plugin list", cardinality: "plural" as const }
    : fixture.message;
}

/** Presents one catalog example through its fixture's own notification run. */
function presentExample(example: CatalogExample, fixtures: FixtureMap): PresentedCatalog {
  const fixture = fixtures[example.section]?.[example.state];
  if (fixture === undefined) {
    throw new Error(`Catalog example has no fixture: ${tupleKey(example.section, example.state)}`);
  }

  const origin = catalogOrigin(example);
  const run = openNotificationRun(fixture.pi, origin);
  const source =
    fixture.present?.(run) ?? presentNotification(run, catalogMessage(example.section, fixture));
  verifyPi(fixture.pi);
  return {
    section: example.section,
    state: example.state,
    text: example.expected,
    source,
    origin,
    fixture,
    run,
  };
}

function presentRawSamples(): PresentedSource[] {
  return Object.values(RAW_SAMPLES).map((surface) => {
    const source = resolveRawSurface(surface);
    return {
      section: RAW_SECTION,
      state: surface.kind,
      text: formatRawSurface(source)?.[0] ?? "",
      source,
      origin: RAW_ORIGINS[surface.kind],
    };
  });
}

/** Dispatches each raw sample through the public helper that owns its kind. */
function emitRawSample(ctx: NotificationContext, run: NotificationRun, surface: RawSurface): void {
  switch (surface.kind) {
    case "usage-error":
      notifyUsageError(ctx, run, surface);
      return;
    case "usage-info":
      notifyUsageInfo(ctx, run, surface.usage);
      return;
    case "autoapply-status":
      notifyAutoapplyStatus(ctx, run, surface);
      return;
    case "diagnostic":
      notifyDiagnostic(ctx, run, surface.header, surface.lines);
      return;
    case "device-flow-prompt":
      notifyDeviceFlowPrompt(ctx, run, surface);
      return;
    case "async-rewake-summary":
      notifyAsyncRewakeSummary(ctx, run, surface.summary);
      return;
    case "stop-override-cap":
      notifyStopHookOverrideCap(ctx, run, surface.pluginId, surface.cap);
      return;
    case "reconcile-aborted":
      notifyReconcileAborted(ctx, run, surface.cause);
      return;
    case "plugin-path-skipped":
      notifyPluginPathSkipped(ctx, run, surface.scope, surface.reason);
      return;
    case "mcp-config-notices":
      notifyMcpConfigNotices(ctx, run, surface.notices);
      return;
    case "mcp-migration":
      notifyMcpMigration(ctx, run, { rows: surface.rows, notices: surface.notices });
      return;
  }
}

/** Converts every presented source and validates the bytes a consumer receives. */
function convertAndValidate(
  presented: readonly PresentedSource[],
  convert: Converter,
): HarnessReport {
  const failures: ValidationFailure[] = [];
  const converted: ConvertedPayload[] = [];
  for (const { section, state, source, origin } of presented) {
    const payload = convert(source, origin);
    const received: unknown = JSON.parse(JSON.stringify(payload));
    if (!PAYLOAD_VALIDATOR.Check(received)) {
      const errors = [...PAYLOAD_VALIDATOR.Errors(received)].map(
        (error) => `${error.instancePath} ${error.message}`,
      );
      failures.push({ section, state, errors });
    }

    converted.push({ section, state, payload });
  }

  return { failures, converted };
}

function tupleKeys(entries: readonly { section: string; state: string }[]): string[] {
  return entries.map(({ section, state }) => tupleKey(section, state));
}

function cascadeRows(
  payload: ReturnType<typeof toWirePayload>,
): { readonly status: string; readonly reasons: readonly string[] }[] {
  if (payload.kind !== "cascade") {
    throw new Error(`Expected a cascade payload, got ${payload.kind}`);
  }

  return payload.marketplaces.flatMap(({ plugins }) =>
    plugins.map(({ status, reasons }) => ({ status, reasons })),
  );
}

/** The walk's findings over one payload, and the number of payloads walked. */
interface WalkReport {
  readonly visited: number;
  readonly findings: readonly string[];
}

/**
 * D-10: walks one unserialized payload and returns what it must not carry: a
 * path its text form hides, an object that is not a plain object or array
 * (a live `Error` is one), an `undefined` or `null` member, a function or
 * symbol, or a non-finite number.
 */
function walkPayload(payload: unknown, text: string): string[] {
  const findings: string[] = [];
  walkValue(payload, "$", text, findings);
  return findings;
}

function walkValue(value: unknown, at: string, text: string, findings: string[]): void {
  if (value === undefined || value === null) {
    findings.push(`${at}: ${String(value)} member`);
    return;
  }

  switch (typeof value) {
    case "string":
      findings.push(...hiddenPaths(value, at, text));
      return;
    case "number":
      if (!Number.isFinite(value)) {
        findings.push(`${at}: non-finite number`);
      }

      return;
    case "boolean":
      return;
    case "object":
      walkObject(value, at, text, findings);
      return;
    case "bigint":
    case "function":
    case "symbol":
    case "undefined":
      findings.push(`${at}: ${typeof value} value`);
  }
}

function walkObject(value: object, at: string, text: string, findings: string[]): void {
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== Array.prototype) {
    findings.push(`${at}: ${Object.prototype.toString.call(value)} is not a plain object`);
    return;
  }

  for (const [key, member] of Object.entries(value)) {
    walkValue(member, `${at}.${key}`, text, findings);
  }
}

function hiddenPaths(value: string, at: string, text: string): string[] {
  return [...value.matchAll(ABSOLUTE_PATH)]
    .map(([match]) => match)
    .filter((match) => !text.includes(match))
    .map((match) => `${at}: absolute path ${match} absent from the text`);
}

function walkAll(presented: readonly PresentedSource[]): WalkReport {
  const findings: string[] = [];
  let visited = 0;
  for (const { section, state, text, source, origin } of presented) {
    const key = tupleKey(section, state);
    findings.push(
      ...walkPayload(toWirePayload(source, origin), text).map((finding) => `${key} ${finding}`),
    );
    visited += 1;
  }

  return { visited, findings };
}

type WirePayload = ReturnType<typeof toWirePayload>;
type PruneCommittedWarning = Extract<WirePayload, { kind: "prune-committed-warning" }>;
type PruneCommittedWarningPayload = PruneCommittedWarning & {
  readonly cause: NonNullable<PruneCommittedWarning["cause"]>;
};

const EXAMPLES = loadCatalogExamples(await readFile(CATALOG_PATH, "utf8"));
const FIXTURES = mergeFixtureMaps(FIXTURE_MAPS);
const CATALOG_PRESENTED = EXAMPLES.map((example) => presentExample(example, FIXTURES));
const RAW_PRESENTED = presentRawSamples();
const PRESENTED: readonly PresentedSource[] = [...CATALOG_PRESENTED, ...RAW_PRESENTED];

function realPayloads(): {
  readonly key: string;
  readonly payload: ReturnType<typeof toWirePayload>;
}[] {
  return PRESENTED.map(({ section, state, source, origin }) => ({
    key: tupleKey(section, state),
    payload: toWirePayload(source, origin),
  }));
}

test("WIRE-02: the retained inventory and separate command error cover all 22 kinds", () => {
  // arrange
  const error = resolveCommandError(new Error("operation failed"), false);
  const origin = {
    kind: "command",
    commandId: "plugin update",
    invocationId: "error-run",
  } as const;

  // act
  const payloads = [...realPayloads().map(({ payload }) => payload), toWirePayload(error, origin)];

  // assert
  assert.deepStrictEqual([...new Set(payloads.map(({ kind }) => kind))].sort(), [
    "async-rewake-summary",
    "autoapply-status",
    "cascade",
    "device-flow-prompt",
    "diagnostic",
    "internal-error",
    "marketplace-info",
    "marketplace-info-cascade",
    "marketplace-not-added",
    "mcp-config-notices",
    "mcp-migration",
    "plugin-info",
    "plugin-info-cascade",
    "plugin-path-skipped",
    "prune-committed-warning",
    "prune-empty",
    "reconcile-aborted",
    "reconcile-applied-cascade",
    "reconcile-pending-empty",
    "stop-override-cap",
    "usage-error",
    "usage-info",
  ]);
  assert.strictEqual(PRESENTED.length, 332);

  for (const payload of payloads) {
    assert.ok(PAYLOAD_VALIDATOR.Check(payload));
  }
});

for (const field of ["origin", "severity", "needsReload"] as const) {
  test(`WIRE-02 control: removing ${field} fails every retained fixture`, () => {
    // arrange
    const withoutMetadata: Converter = (source, origin) =>
      Object.fromEntries(
        Object.entries(toWirePayload(source, origin)).filter(([key]) => key !== field),
      );

    // act
    const report = convertAndValidate(PRESENTED, withoutMetadata);

    // assert
    assert.deepStrictEqual(tupleKeys(report.failures), tupleKeys(PRESENTED));
  });
}

for (const field of ["commandId", "invocationId"] as const) {
  test(`WIRE-07 control: removing ${field} fails every command fixture`, () => {
    // arrange
    const commands = PRESENTED.filter(({ origin }) => origin.kind === "command");
    const withoutIdentity: Converter = (source, origin) => ({
      ...toWirePayload(source, origin),
      origin: Object.fromEntries(Object.entries(origin).filter(([key]) => key !== field)),
    });

    // act
    const report = convertAndValidate(commands, withoutIdentity);

    // assert
    assert.ok(commands.length > 0);
    assert.deepStrictEqual(tupleKeys(report.failures), tupleKeys(commands));
  });
}

for (const origin of [{ kind: "load" }, { kind: "hook" }] as const) {
  test(`JOUT-04 control: internal errors reject ${origin.kind} origin`, () => {
    // arrange
    const error = resolveCommandError(new Error("operation failed"), false);

    // act & assert
    assert.throws(() => {
      // @ts-expect-error -- deliberately cross the command-only conversion boundary.
      toWirePayload(error, origin);
    }, TypeError);
  });
}

for (const mode of ["json", "rpc"] as const) {
  test(`JOUT-04: the separate internal error reaches ${mode} without a text fixture`, () => {
    // arrange
    const capture = createJsonCapture();
    const origin = {
      kind: "command",
      commandId: "plugin update",
      invocationId: "error-run",
    } as const;
    const cause = new Error("operation failed");
    const expected = {
      schemaVersion: 1,
      kind: "internal-error",
      origin,
      severity: "error",
      needsReload: false,
      summary: "Command failed unexpectedly.",
      cause: { causeChain: ["operation failed"], truncated: false },
    };
    const ctx: NotificationContext = {
      mode,
      get ui() {
        return capture.ui;
      },
    };

    // act
    const converted = toWirePayload(resolveCommandError(cause, false), origin);
    notifyCommandError(ctx, capture.entrySink, origin, createCommandRunState(), cause);

    // assert
    assert.deepStrictEqual(converted, expected);
    assert.deepStrictEqual(capture.entries, [{ customType: "claude-plugin", payload: expected }]);
    capture.assertValid();
  });

  for (const origin of [
    { kind: "command", commandId: "plugin import", invocationId: "diagnostic-run" },
    { kind: "load" },
  ] as const) {
    test(`WIRE-02: shared diagnostic keeps its ${origin.kind} root in ${mode}`, () => {
      // arrange
      const capture = createJsonCapture();
      const pi = piWithAllLoaded();
      const run = { ...openNotificationRun(pi, origin), entrySink: capture.entrySink };
      const ctx: NotificationContext = {
        mode,
        get ui() {
          return capture.ui;
        },
      };

      // act
      notifyDiagnostic(ctx, run, "One warning", ["settings skipped"]);

      // assert
      assert.deepStrictEqual(capture.entries, [
        {
          customType: "claude-plugin",
          payload: {
            schemaVersion: 1,
            kind: "diagnostic",
            origin,
            severity: "warning",
            needsReload: false,
            header: "One warning",
            lines: ["settings skipped"],
          },
        },
      ]);
      capture.assertValid();
      verifyPi(pi);
    });
  }

  test(`JOUT-04 control: recovered malformed ${mode} attempts remain in the capture ledger`, () => {
    // arrange
    const capture = createJsonCapture();
    const pi = piWithAllLoaded();
    const origin = {
      kind: "command",
      commandId: "plugin import",
      invocationId: "malformed-run",
    } as const;
    const run = {
      ...openNotificationRun(pi, origin),
      entrySink: {
        appendEntry(customType: string, payload: unknown): void {
          capture.entrySink.appendEntry(customType, capture.entries.length === 0 ? {} : payload);
        },
      },
    };
    const ctx: NotificationContext = {
      mode,
      get ui() {
        return capture.ui;
      },
    };

    // act
    notifyDiagnostic(ctx, run, "One warning", ["settings skipped"]);

    // assert
    assert.strictEqual(capture.entries.length, 2);
    assert.deepStrictEqual(capture.entries[0], { customType: "claude-plugin", payload: {} });
    const recovery = capture.entries[1]?.payload;
    assert.ok(PAYLOAD_VALIDATOR.Check(recovery));
    assert.strictEqual(recovery.kind, "internal-error");
    assert.deepStrictEqual(recovery.origin, origin);
    assert.throws(() => {
      capture.assertValid();
    }, assert.AssertionError);
    verifyPi(pi);
  });

  test(`JOUT-01: every catalog tuple reaches ${mode} transport exactly once`, () => {
    // arrange
    const capture = createJsonCapture();
    const emitted: { key: string; payloads: unknown[] }[] = [];
    const ctx: NotificationContext = {
      mode,
      get ui() {
        return capture.ui;
      },
    };

    // act
    for (const presented of CATALOG_PRESENTED) {
      const start = capture.entries.length;
      const run: NotificationRun = { ...presented.run, entrySink: capture.entrySink };
      if (presented.fixture.emit !== undefined) {
        presented.fixture.emit(ctx, run);
      } else {
        notify(ctx, run, catalogMessage(presented.section, presented.fixture));
      }

      emitted.push({
        key: tupleKey(presented.section, presented.state),
        payloads: capture.entries.slice(start).map(({ payload }) => payload),
      });
    }

    // assert
    capture.assertValid();
    for (const [index, { payloads }] of emitted.entries()) {
      assert.deepStrictEqual(
        payloads.map((payload) => {
          assert.ok(PAYLOAD_VALIDATOR.Check(payload));
          return payload.origin;
        }),
        [CATALOG_PRESENTED[index]?.origin],
      );
    }

    const emittedKeys = emitted.flatMap(({ key, payloads }) => payloads.map(() => key));
    assert.deepStrictEqual(emittedKeys, tupleKeys(EXAMPLES));
    assert.strictEqual(new Set(emittedKeys).size, 321);
    assert.deepStrictEqual(
      capture.entries.map(({ customType }) => customType),
      EXAMPLES.map(() => "claude-plugin"),
    );
  });

  for (const surface of Object.values(RAW_SAMPLES)) {
    test(`JOUT-01: ${surface.kind} reaches ${mode} transport exactly once`, () => {
      // arrange
      const capture = createJsonCapture();
      const pi = piWithAllLoaded();
      const run: NotificationRun = {
        ...openNotificationRun(pi, RAW_ORIGINS[surface.kind]),
        entrySink: capture.entrySink,
      };
      const ctx: NotificationContext = {
        mode,
        get ui() {
          return capture.ui;
        },
      };

      // act
      emitRawSample(ctx, run, surface);

      // assert
      capture.assertValid();
      assert.deepStrictEqual(
        capture.entries.map(({ customType, payload }) => {
          assert.ok(PAYLOAD_VALIDATOR.Check(payload));
          return { customType, kind: payload.kind, origin: payload.origin };
        }),
        [{ customType: "claude-plugin", kind: surface.kind, origin: RAW_ORIGINS[surface.kind] }],
      );
      verifyPi(pi);
    });
  }
}

test("JOUT-02: every catalog example and raw kind converts to a schema-valid payload", () => {
  // arrange
  const expectedCatalogKeys = tupleKeys(EXAMPLES);
  const expectedCount = EXAMPLES.length + Object.keys(RAW_SAMPLES).length;

  // act
  const report = convertAndValidate(PRESENTED, toWirePayload);

  // assert
  assert.deepStrictEqual(report.failures, []);
  assert.ok(EXAMPLES.length > 0, "the catalog parsed no example");
  assert.strictEqual(report.converted.length, expectedCount);
  assert.deepStrictEqual(
    tupleKeys(report.converted.slice(0, EXAMPLES.length)),
    expectedCatalogKeys,
  );
  assert.deepStrictEqual(
    new Set(tupleKeys(report.converted)),
    new Set([...expectedCatalogKeys, ...tupleKeys(RAW_PRESENTED)]),
  );
});

test("JOUT-02 control: a converter that returns {} fails every example and raw sample", () => {
  // arrange
  const emptyConverter: Converter = () => ({});

  // act
  const report = convertAndValidate(PRESENTED, emptyConverter);

  // assert
  assert.deepStrictEqual(tupleKeys(report.failures), tupleKeys(PRESENTED));
});

test("JOUT-02 control: a planted fixture with an off-vocabulary reason fails by its tuple", () => {
  // arrange
  const fixtures: FixtureMap = {
    "planted section": {
      "off-vocabulary reason": {
        pi: piWithAllLoaded(),
        message: {
          marketplaces: [
            {
              name: "mp",
              scope: "user",
              plugins: [
                {
                  status: "installed",
                  name: "alpha",
                  version: "1.0.0",
                  severity: "info",
                  needsReload: true,
                  dependencies: [],
                  reasons: ["not a closed-set reason" as never],
                },
              ],
            },
          ],
        },
      },
    },
  };
  const planted = presentExample(
    { section: "planted section", state: "off-vocabulary reason", expected: "" },
    fixtures,
  );

  // act
  const report = convertAndValidate([planted], toWirePayload);

  // assert
  assert.deepStrictEqual(tupleKeys(report.failures), ["planted section::off-vocabulary reason"]);
  assert.ok(
    report.failures[0]?.errors.includes(
      "/marketplaces/0/plugins/0/reasons/0 must be equal to one of the allowed values",
    ),
    "the planted reason is not what the union rejected",
  );
});

test("JOUT-02 control: a cascade payload carrying a raw-only member fails", () => {
  // arrange
  const cascade = CATALOG_PRESENTED.find(({ source }) => source.kind === "cascade");
  assert.ok(cascade, "the catalog presents no cascade");
  const foreignMember: Converter = (source, origin) => ({
    ...toWirePayload(source, origin),
    causeMessage: "state unreadable",
  });

  // act
  const report = convertAndValidate([cascade], foreignMember);

  // assert
  assert.deepStrictEqual(tupleKeys(report.failures), [tupleKey(cascade.section, cascade.state)]);
  assert.ok(
    report.failures[0]?.errors.includes("/causeMessage schema is false"),
    "the foreign member is not what the union rejected",
  );
});

test("WIRE-05: a structured payload carries summary exactly when it is warning or error", () => {
  // arrange
  const structured = realPayloads().filter(({ key }) => !key.startsWith(`${RAW_SECTION}::`));

  // act
  const mismatched = structured
    .filter(({ payload }) => "summary" in payload !== (payload.severity !== "info"))
    .map(({ key }) => key);
  const summarized = structured.filter(({ payload }) => "summary" in payload);

  // assert
  assert.deepStrictEqual(mismatched, []);
  assert.ok(summarized.length > 0, "no structured payload is warning or error");
});

test("WIRE-05: noOp appears on exactly the two update no-op payloads", () => {
  // arrange
  const expectedNoOps = [
    { key: "/claude:plugin update::all-up-to-date-noop", noOp: true },
    { key: "/claude:plugin update::skip-partially-upgradable-bulk", noOp: true },
  ];

  // act
  const noOps = realPayloads().flatMap(({ key, payload }) =>
    "noOp" in payload ? [{ key, noOp: payload.noOp }] : [],
  );

  // assert
  assert.deepStrictEqual(noOps, expectedNoOps);
});

test("JOUT-02 control: an emit fixture without its present hook does not type-check", () => {
  // arrange
  const seamFixture = FIXTURES["/claude:plugin update"]?.["all-up-to-date-noop"];
  assert.ok(seamFixture?.emit !== undefined);

  // act
  // @ts-expect-error -- an `emit` closure must state the presentation its bytes come from.
  const planted: CatalogFixture = {
    message: seamFixture.message,
    pi: seamFixture.pi,
    emit: seamFixture.emit,
  };

  // assert
  assert.strictEqual(planted.present, undefined);
});

test("WIRE-05: the plugin-list emit payloads carry the content reasons of their rows", () => {
  // arrange
  const payloads = new Map(realPayloads().map(({ key, payload }) => [key, payload]));
  const available = payloads.get("/claude:plugin list::available-installs-disabled");
  const remote = payloads.get("/claude:plugin list::remote-installs-disabled");
  assert.ok(available && remote, "a plugin-list emit fixture is missing");

  // act
  const rows = [...cascadeRows(available), ...cascadeRows(remote)];

  // assert
  assert.deepStrictEqual(rows, [
    { status: "available", reasons: ["installs disabled"] },
    { status: "remote", reasons: ["installs disabled"] },
  ]);
});

/** The committed prune warning, a real payload whose cause chain the planted offenders extend. */
function committedWarning(): {
  readonly payload: PruneCommittedWarningPayload;
  readonly text: string;
} {
  const presented = presentedAt(PRUNE_WARNING_KEY);
  const payload = toWirePayload(presented.source, presented.origin);
  if (payload.kind !== "prune-committed-warning" || payload.cause === undefined) {
    throw new Error(`Expected a committed prune warning with a cause, got ${payload.kind}`);
  }

  return { payload: { ...payload, cause: payload.cause }, text: presented.text };
}

function presentedAt(key: string): PresentedSource {
  const presented = PRESENTED.find(({ section, state }) => tupleKey(section, state) === key);
  if (presented === undefined) {
    throw new Error(`No presented source for ${key}`);
  }

  return presented;
}

/** Inserts `inserted` into the middle of the first cause link. */
function withFirstLinkPath(
  payload: PruneCommittedWarningPayload,
  inserted: string,
): PruneCommittedWarningPayload {
  const [first = "", ...rest] = payload.cause.causeChain;
  const middle = Math.floor(first.length / 2);
  const planted = `${first.slice(0, middle)} ${inserted} ${first.slice(middle)}`;
  return { ...payload, cause: { ...payload.cause, causeChain: [planted, ...rest] } };
}

test("WIRE-08: no real payload carries a hidden path, a live Error, or an absent member", () => {
  // arrange
  const expectedVisited = PRESENTED.length;

  // act
  const report = walkAll(PRESENTED);

  // assert
  assert.deepStrictEqual(report.findings, []);
  assert.strictEqual(report.visited, expectedVisited);
  assert.ok(expectedVisited > 0, "the walk visited no payload");
});

test("WIRE-08 control: the path-source marketplace info absPath is detected and accepted", () => {
  // arrange
  const presented = presentedAt(PATH_SOURCE_INFO_KEY);
  const payload = toWirePayload(presented.source, presented.origin);

  // act
  const hidden = walkPayload(payload, "");
  const shown = walkPayload(payload, presented.text);

  // assert
  assert.deepStrictEqual(hidden, [
    "$.source.absPath: absolute path /home/user/marketplaces/local-mp absent from the text",
  ]);
  assert.deepStrictEqual(shown, []);
});

for (const { name, plant, expectedFindings } of [
  {
    name: "a POSIX path absent from the text, mid-string in a cause link",
    plant: (payload: PruneCommittedWarningPayload): unknown =>
      withFirstLinkPath(payload, "/srv/pi/secret/state.json"),
    expectedFindings: [
      "$.cause.causeChain.0: absolute path /srv/pi/secret/state.json absent from the text",
    ],
  },
  {
    name: "a Windows path absent from the text, mid-string in a cause link",
    plant: (payload: PruneCommittedWarningPayload): unknown =>
      withFirstLinkPath(payload, "C:\\Users\\pi\\state.json"),
    expectedFindings: [
      "$.cause.causeChain.0: absolute path C:\\Users\\pi\\state.json absent from the text",
    ],
  },
  {
    name: "an Error instance member",
    plant: (payload: PruneCommittedWarningPayload): unknown => ({
      ...payload,
      error: new Error("state unreadable"),
    }),
    expectedFindings: ["$.error: [object Error] is not a plain object"],
  },
  {
    name: "an undefined member",
    plant: (payload: PruneCommittedWarningPayload): unknown => ({ ...payload, summary: undefined }),
    expectedFindings: ["$.summary: undefined member"],
  },
]) {
  test(`WIRE-08 control: the walk reports ${name}`, () => {
    // arrange
    const { payload, text } = committedWarning();
    const planted = plant(payload);

    // act
    const findings = walkPayload(planted, text);

    // assert
    assert.deepStrictEqual(findings, expectedFindings);
  });
}
