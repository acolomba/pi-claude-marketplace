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
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { Compile } from "typebox/compile";

import { toWirePayload } from "../../../extensions/pi-claude-marketplace/shared/notification-json.ts";
import { presentNotification } from "../../../extensions/pi-claude-marketplace/shared/notification-present.ts";
import { resolveRawSurface } from "../../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";
import { openNotificationRun } from "../../../extensions/pi-claude-marketplace/shared/notification-run.ts";
import { NOTIFICATION_PAYLOAD_SCHEMA } from "../../../extensions/pi-claude-marketplace/shared/notification-wire.ts";

import { loadCatalogExamples, type CatalogExample } from "./catalog-parser.ts";
import { FIXTURE_MAPS, mergeFixtureMaps, tupleKey } from "./fixture-maps.ts";
import { piWithAllLoaded, verifyPi } from "./mock-pi.ts";

import type { CatalogFixture, FixtureMap } from "./fixture-types.ts";
import type { NotificationPresentation } from "../../../extensions/pi-claude-marketplace/shared/notification-present.ts";
import type { ResolvedRawSurface } from "../../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";
import type {
  NotificationMessage,
  RawSurface,
} from "../../../extensions/pi-claude-marketplace/shared/notification-types.ts";

type PayloadSource = NotificationPresentation | ResolvedRawSurface;
type Converter = (source: PayloadSource) => unknown;

/** One presented catalog example or raw sample, ready to convert. */
interface PresentedSource {
  readonly section: string;
  readonly state: string;
  readonly source: PayloadSource;
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

/** One sample per raw kind; a kind missing from the table fails typecheck. */
const RAW_SAMPLES: { readonly [K in RawSurface["kind"]]: Extract<RawSurface, { kind: K }> } = {
  "usage-error": {
    kind: "usage-error",
    message: "unknown flag --bogus",
    usage: "Usage: /claude:plugin install <plugin>@<marketplace>",
  },
  "usage-info": { kind: "usage-info", usage: "Usage: /claude:plugin list [--scope <scope>]" },
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
};

/** The message the byte contract notifies for `fixture`, with the list label it injects. */
function catalogMessage(section: string, fixture: CatalogFixture): NotificationMessage {
  return section === "/claude:plugin list" && "marketplaces" in fixture.message
    ? { ...fixture.message, label: "Plugin list", cardinality: "plural" as const }
    : fixture.message;
}

/** Presents one catalog example through its fixture's own notification run. */
function presentExample(example: CatalogExample, fixtures: FixtureMap): PresentedSource {
  const fixture = fixtures[example.section]?.[example.state];
  if (fixture === undefined) {
    throw new Error(`Catalog example has no fixture: ${tupleKey(example.section, example.state)}`);
  }

  const run = openNotificationRun(fixture.pi);
  const source =
    fixture.present?.(run) ?? presentNotification(run, catalogMessage(example.section, fixture));
  verifyPi(fixture.pi);
  return { section: example.section, state: example.state, source };
}

function presentRawSamples(): PresentedSource[] {
  return Object.values(RAW_SAMPLES).map((surface) => ({
    section: RAW_SECTION,
    state: surface.kind,
    source: resolveRawSurface(surface),
  }));
}

/** Converts every presented source and validates the bytes a consumer receives. */
function convertAndValidate(
  presented: readonly PresentedSource[],
  convert: Converter,
): HarnessReport {
  const failures: ValidationFailure[] = [];
  const converted: ConvertedPayload[] = [];
  for (const { section, state, source } of presented) {
    const payload = convert(source);
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

function realPayloads(): {
  readonly key: string;
  readonly payload: ReturnType<typeof toWirePayload>;
}[] {
  return PRESENTED.map(({ section, state, source }) => ({
    key: tupleKey(section, state),
    payload: toWirePayload(source),
  }));
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

const EXAMPLES = loadCatalogExamples(await readFile(CATALOG_PATH, "utf8"));
const FIXTURES = mergeFixtureMaps(FIXTURE_MAPS);
const CATALOG_PRESENTED = EXAMPLES.map((example) => presentExample(example, FIXTURES));
const RAW_PRESENTED = presentRawSamples();
const PRESENTED: readonly PresentedSource[] = [...CATALOG_PRESENTED, ...RAW_PRESENTED];

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
  const foreignMember: Converter = (source) => ({
    ...toWirePayload(source),
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
