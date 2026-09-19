// The identity contract of one unit coverage capture run (D-02, D-10): what the
// run selected, what it read, what it executed, which processes produced the
// raw V8 records, and the digests that tie the published LCOV to all of it.
//
// Everything here is a pure function over paths and bytes. The CLI in
// `coverage-capture.mjs` owns the run; the runtime hook in
// `coverage-capture.runtime.mjs` owns the per-process records; this module owns
// the inventory rules, the manifest schema, the atomic write and the readback
// verification a consumer performs before trusting a published bundle.
//
// Freshness is content, never a filename or a modification time: a consumer
// recomputes the inventory and every digest and refuses on any difference.

import { createHash } from "node:crypto";
import {
  existsSync,
  globSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const MANIFEST_SCHEMA_VERSION = 1;
export const MANIFEST_KIND = "pi-claude-marketplace-unit-coverage-capture";

// The one authoritative unit selection: the same two patterns `npm test` and
// `npm run test:coverage:unit` pass to `node --test`, so ordinary and captured
// execution run the identical population.
export const UNIT_TEST_PATTERNS = [
  "tests/{architecture,bridges,domain,edge,orchestrators,persistence,platform,scripts,shared,transaction}/**/*.test.ts",
  "tests/index.test.ts",
];

// The native runner flags the existing unit coverage script passes, in its
// order. `--test-coverage-include` scopes the LCOV, never the raw capture.
export const NATIVE_COVERAGE_FLAGS = [
  "--experimental-test-coverage",
  "--test-coverage-include=extensions/**",
  "--test-reporter=spec",
  "--test-reporter-destination=stdout",
  "--test-reporter=lcov",
];

export const PUBLIC_LCOV_PATH = "coverage/unit.lcov";
export const PUBLIC_MANIFEST_PATH = "coverage/unit.manifest.json";
export const PUBLIC_ISTANBUL_PATH = "coverage/unit.istanbul.json";
export const PUBLIC_VALIDATION_PATH = "coverage/unit.validation.json";
export const RUNS_DIRECTORY = "coverage/runs";

// A bundle is `captured` when the capture CLI published it and `accepted`
// once the conversion acceptance promoted it; `status` stays the capture's
// own outcome in both.
const BUNDLE_STATES = new Set(["captured", "accepted"]);

const PRODUCTION_ROOT = "extensions";
const TESTS_ROOT = "tests";
const TOOLING_ROOT = "scripts";
const NON_UNIT_TEST_ROOTS = new Set(["e2e", "integration", "live-uat"]);
const RESOURCE_INPUTS = [
  ".fallowrc.json",
  ".pre-commit-config.yaml",
  ".prettierignore",
  ".prettierrc.json",
  "eslint.config.js",
  "package-lock.json",
  "package.json",
  "sonar-project.properties",
  "tsconfig.json",
];

const TOOLING_FILES = [
  "coverage-capture.mjs",
  "coverage-capture.manifest.mjs",
  "coverage-capture.runtime.mjs",
];

// The scripts whose bytes decide an accepted conversion: the orchestration,
// the producer adapter and CLI, the mapping and syntax primitives and the
// validators. An accepted bundle records their digests and a consumer
// requires the same bytes in use.
const ACCEPTANCE_FILES = [
  "coverage-unit.mjs",
  "coverage-acceptance.mjs",
  "coverage-producer.mjs",
  "coverage-producer.convert.mjs",
  "coverage-source-map.mjs",
  "coverage-syntax.mjs",
  "coverage-correspondence.mjs",
  "coverage-schema.mjs",
  "coverage-validate.mjs",
];

// Loader and transform flags whose presence would put another party's output
// between the source on disk and the text V8 evaluates. `--import` of this
// run's own runtime is the one admitted value; a nested capture inherits it.
const FOREIGN_LOADER_FLAGS = [
  "--experimental-loader",
  "--experimental-transform-types",
  "--import",
  "--loader",
  "--no-experimental-strip-types",
  "--no-strip-types",
  "--require",
  "-r",
];

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function canonicalJson(value) {
  return `${JSON.stringify(value, undefined, 2)}\n`;
}

/**
 * Writes `value` as JSON through a sibling temporary file and a rename, so a
 * reader never observes a partial document.
 */
export function writeJsonAtomically(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, canonicalJson(value));
  renameSync(temporaryPath, filePath);
}

/**
 * The repository-relative posix form of a path, or `undefined` when the path
 * escapes the root. Every path a manifest records passes through here.
 */
export function toProjectPath(root, inputPath) {
  const relativePath = path.relative(root, path.resolve(root, inputPath));

  if (relativePath === "" || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return undefined;
  }

  return relativePath.split(path.sep).join("/");
}

function filesUnder(root, directory) {
  const absoluteDirectory = path.join(root, directory);

  if (!existsSync(absoluteDirectory)) {
    return [];
  }

  return readdirSync(absoluteDirectory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => toProjectPath(root, path.join(entry.parentPath, entry.name)));
}

function inventoryGroup(projectPath) {
  const [first, second] = projectPath.split("/");

  if (first === PRODUCTION_ROOT) {
    return projectPath.endsWith(".ts") ? "production" : "resources";
  }

  if (first === TESTS_ROOT) {
    return second !== undefined && NON_UNIT_TEST_ROOTS.has(second) ? undefined : "tests";
  }

  return first === TOOLING_ROOT ? "tooling" : "resources";
}

/**
 * Every input the run binds, with its SHA-256 and size, sorted by path:
 * production sources, the unit test tree and its support files, the gate
 * scripts, and the configuration files that decide selection and tooling.
 * A file loaded through the module loader that is absent from this set is a
 * capture failure, not an omission.
 */
export function enumerateInventory(root) {
  const candidates = new Set([
    ...filesUnder(root, PRODUCTION_ROOT),
    ...filesUnder(root, TESTS_ROOT),
    ...filesUnder(root, TOOLING_ROOT),
    ...RESOURCE_INPUTS.filter((resource) => existsSync(path.join(root, resource))),
  ]);
  const entries = [];

  for (const projectPath of [...candidates].sort()) {
    const group = inventoryGroup(projectPath);

    if (group === undefined) {
      continue;
    }

    const bytes = readFileSync(path.join(root, projectPath));
    entries.push({ path: projectPath, group, digest: sha256(bytes), size: bytes.byteLength });
  }

  return entries;
}

/**
 * The paths whose presence or bytes differ between two inventories. Empty
 * lists on every side is the only acceptable answer at each checkpoint.
 */
export function inventoryDifference(before, after) {
  const beforeByPath = new Map(before.map((entry) => [entry.path, entry.digest]));
  const afterByPath = new Map(after.map((entry) => [entry.path, entry.digest]));

  return {
    added: after.filter((entry) => !beforeByPath.has(entry.path)).map((entry) => entry.path),
    removed: before.filter((entry) => !afterByPath.has(entry.path)).map((entry) => entry.path),
    changed: after
      .filter((entry) => {
        const previous = beforeByPath.get(entry.path);
        return previous !== undefined && previous !== entry.digest;
      })
      .map((entry) => entry.path),
  };
}

/** The selected unit test files under `root`, repository-relative and sorted. */
export function selectedTests(root) {
  return globSync(UNIT_TEST_PATTERNS, { cwd: root })
    .map((match) => match.split(path.sep).join("/"))
    .sort();
}

function scriptDigests(fileNames) {
  const identity = {};

  for (const fileName of fileNames) {
    identity[fileName] = sha256(readFileSync(fileURLToPath(new URL(fileName, import.meta.url))));
  }

  return identity;
}

/**
 * Digests of the three capture scripts themselves, keyed by file name. They
 * are read next to this module, so a copied tool set describes itself.
 */
export function toolingIdentity() {
  return scriptDigests(TOOLING_FILES);
}

/** Digests of the conversion and validation scripts an acceptance binds. */
export function acceptanceToolingIdentity() {
  return scriptDigests(ACCEPTANCE_FILES);
}

export function runtimeIdentity() {
  return {
    node: process.version,
    v8: process.versions.v8,
    platform: process.platform,
    arch: process.arch,
  };
}

/**
 * Every token in `nodeOptions` and `execArgv` that names a loader or transform
 * other than this run's own runtime import. A non-empty answer refuses the run
 * before anything is written (D-04).
 */
export function foreignLoaderTokens(nodeOptions, execArgv, ownRuntimeImport) {
  const tokens = [...nodeOptions.split(/\s+/u).filter(Boolean), ...execArgv];

  return tokens.filter((token) => {
    if (token === ownRuntimeImport) {
      return false;
    }

    const [flag] = token.split("=", 1);
    return FOREIGN_LOADER_FLAGS.includes(flag);
  });
}

export function invocationDigest(invocation) {
  return sha256(canonicalJson(invocation));
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function fileDigest(filePath) {
  return existsSync(filePath) ? sha256(readFileSync(filePath)) : undefined;
}

// A recorded path is trusted only inside this run's own directory.
function runContained(runPrefix, recordedPath) {
  return (
    typeof recordedPath === "string" &&
    recordedPath.startsWith(`${runPrefix}/`) &&
    !recordedPath.split("/").includes("..")
  );
}

function digestFailures(root, expected, kind) {
  const failures = [];

  for (const [recordedPath, digest] of expected) {
    const actual = fileDigest(path.join(root, recordedPath));

    if (actual === undefined) {
      failures.push({ kind: "missing-artifact", path: recordedPath });
    } else if (actual !== digest) {
      failures.push({ kind, path: recordedPath });
    }
  }

  return failures;
}

// The record the public pointer must be a byte copy of: the run manifest for
// a captured bundle, the acceptance record for an accepted one.
function bundleRecordPath(manifest, runPrefix) {
  return manifest.state === "accepted"
    ? `${runPrefix}/accepted.json`
    : `${runPrefix}/manifest.json`;
}

function acceptanceRecords(manifest) {
  const acceptance = manifest.acceptance ?? {};

  return {
    istanbul: acceptance.artifacts?.istanbul,
    validation: acceptance.validation,
    producer: acceptance.producer,
    captured: acceptance.captured,
  };
}

function readPublicManifest(root) {
  const manifestPath = path.join(root, PUBLIC_MANIFEST_PATH);

  if (!existsSync(manifestPath)) {
    return { failures: [{ kind: "missing-manifest", path: PUBLIC_MANIFEST_PATH }] };
  }

  let manifest;

  try {
    manifest = readJson(manifestPath);
  } catch {
    return { failures: [{ kind: "malformed-manifest", path: PUBLIC_MANIFEST_PATH }] };
  }

  if (manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION || manifest.kind !== MANIFEST_KIND) {
    return { failures: [{ kind: "unsupported-version", path: PUBLIC_MANIFEST_PATH }] };
  }

  if (manifest.status !== "captured" || !BUNDLE_STATES.has(manifest.state)) {
    return { failures: [{ kind: "not-captured", status: manifest.status, state: manifest.state }] };
  }

  const runPrefix = `${RUNS_DIRECTORY}/${manifest.runId}`;
  const acceptance = manifest.state === "accepted" ? acceptanceRecords(manifest) : {};
  const recordedPaths = [
    manifest.inventory?.path,
    manifest.artifacts?.lcov?.path,
    ...(manifest.raw ?? []).map((record) => record.path),
    ...Object.values(acceptance).map((record) => record?.path),
  ];
  const foreign = recordedPaths.filter((recorded) => !runContained(runPrefix, recorded));

  if (foreign.length > 0 || !/^[0-9TZ]+-[0-9a-f]{8}$/u.test(String(manifest.runId))) {
    return { failures: [{ kind: "foreign-path", paths: foreign }] };
  }

  return { manifest, runPrefix };
}

function identityFailures(root, manifest, runPrefix, expected) {
  const failures = [];
  const publicBytes = readFileSync(path.join(root, PUBLIC_MANIFEST_PATH));
  const recordPath = bundleRecordPath(manifest, runPrefix);
  const absoluteRecordPath = path.join(root, recordPath);

  if (!existsSync(absoluteRecordPath) || !readFileSync(absoluteRecordPath).equals(publicBytes)) {
    failures.push({ kind: "manifest-mismatch", path: recordPath });
  }

  if (manifest.runtime?.node !== expected.runtime.node) {
    failures.push({ kind: "runtime-changed", recorded: manifest.runtime?.node });
  }

  if (canonicalJson(manifest.tooling) !== canonicalJson(expected.tooling)) {
    failures.push({ kind: "tool-changed" });
  }

  if (
    manifest.state === "accepted" &&
    canonicalJson(manifest.acceptance.tooling) !== canonicalJson(acceptanceToolingIdentity())
  ) {
    failures.push({ kind: "tool-changed", stage: "acceptance" });
  }

  return failures;
}

function inventoryFailures(root, manifest) {
  const inventoryPath = path.join(root, manifest.inventory.path);
  const failures = digestFailures(
    root,
    [[manifest.inventory.path, manifest.inventory.digest]],
    "artifact-digest",
  );

  if (failures.length > 0) {
    return { failures };
  }

  const inventory = readJson(inventoryPath);
  const difference = inventoryDifference(inventory, enumerateInventory(root));

  if ([difference.added, difference.removed, difference.changed].some((list) => list.length > 0)) {
    failures.push({ kind: "stale-input", ...difference });
  }

  return { failures, inventory };
}

// Every production source the run inventoried is either a loaded module or an
// unloaded record, and no path is recorded twice; a source the bundle does not
// represent has no place in any converted map (D-04, D-07).
function populationFailures(manifest, inventory) {
  const failures = [];
  const seen = new Set();

  for (const record of [...manifest.modules, ...(manifest.unloaded ?? [])]) {
    if (seen.has(record.path)) {
      failures.push({ kind: "duplicate-record", path: record.path });
    }

    seen.add(record.path);
  }

  for (const entry of inventory) {
    if (entry.group === "production" && !seen.has(entry.path)) {
      failures.push({ kind: "unrepresented-source", path: entry.path });
    }
  }

  return failures;
}

// The artifacts an accepted bundle adds to a captured one: the captured
// manifest it promoted, the map in the run and in public, the validation
// receipt in the run and in public, and the producer identity receipt.
function acceptanceArtifacts(manifest, runPrefix) {
  const { istanbul, validation, producer, captured } = acceptanceRecords(manifest);

  return [
    [`${runPrefix}/manifest.json`, captured.digest],
    [istanbul.path, istanbul.digest],
    [PUBLIC_ISTANBUL_PATH, istanbul.digest],
    [validation.path, validation.digest],
    [PUBLIC_VALIDATION_PATH, validation.digest],
    [producer.path, producer.digest],
  ];
}

function artifactFailures(root, manifest, runPrefix) {
  const expected = [
    [manifest.artifacts.lcov.path, manifest.artifacts.lcov.digest],
    [PUBLIC_LCOV_PATH, manifest.artifacts.lcov.digest],
    ...manifest.raw.map((record) => [record.path, record.digest]),
    ...manifest.modules.flatMap((record) => [
      [`${runPrefix}/sources/${record.source}`, record.source],
      [`${runPrefix}/executed/${record.executed}`, record.executed],
    ]),
    ...(manifest.unloaded ?? []).flatMap((record) => [
      [`${runPrefix}/inventory/${record.source}`, record.source],
      [`${runPrefix}/executed/${record.executed}`, record.executed],
    ]),
    ...(manifest.state === "accepted" ? acceptanceArtifacts(manifest, runPrefix) : []),
  ];
  const failures = digestFailures(root, expected, "artifact-digest");

  if (manifest.raw.length === 0 || manifest.workers.length === 0) {
    failures.push({ kind: "not-captured", status: "no worker evidence" });
  }

  return failures;
}

/**
 * Reads the published bundle back the way a consumer must before using it:
 * the pointer, the run manifest it names, every artifact digest, the module
 * store, and the inventory recomputed from the current tree. `expected` carries
 * the consumer's own `tooling` and `runtime` identities. The answer is
 * `{ ok: true, manifest }` or `{ ok: false, failures }`; a consumer that sees
 * `ok: false` has no report, not an approximate one.
 */
export function verifyCaptureBundle(root, expected) {
  const read = readPublicManifest(root);

  if (read.failures !== undefined) {
    return { ok: false, failures: read.failures };
  }

  const { manifest, runPrefix } = read;
  const inventory = inventoryFailures(root, manifest);
  const failures = [
    ...identityFailures(root, manifest, runPrefix, expected),
    ...inventory.failures,
    ...(inventory.inventory === undefined ? [] : populationFailures(manifest, inventory.inventory)),
    ...artifactFailures(root, manifest, runPrefix),
  ];

  return failures.length === 0 ? { ok: true, manifest } : { ok: false, failures };
}
