// The producer adapter: raw V8 script coverage in, Istanbul coverage out
// (D-03, D-05, D-09).
//
// Conversion is delegated to the pinned AST-aware producer package. This
// module owns everything around that call: a fresh Acorn AST for every raw
// record (the producer mutates the tree it walks, so a reused tree loses
// records), the merge of per-worker records through Istanbul's own merger,
// the identity of the producer bytes actually imported, and explicit failure
// for a record that cannot be converted.
//
// The source map is an input. The conformance corpus supplies exact identity
// maps; the production mapping adapter is a separate module. Nothing here
// repairs, clamps or invents a coordinate. The CLI in `coverage-producer.mjs`
// is the command-line face of this module.
//
// The installed producer is qualified against the maintained delivery: the
// bytes actually imported must be the delivered payload, at the delivered
// version, under this repository's node_modules, with the original license,
// and package-lock.json must resolve the package to the vendored archive
// with its recorded integrity. Loading the installed producer with any of
// those off throws; an explicitly named entry (a control) loads with the
// failures recorded in its identity instead.

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { parse } from "acorn";
import libCoverage from "istanbul-lib-coverage";

import { DELIVERY, VENDOR_DIRECTORY } from "./build-coverage-producer.mjs";

const PRODUCER_PACKAGE = "ast-v8-to-istanbul";
const DELIVERED_PAYLOAD_ENTRY = "package/dist/index.mjs";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

const PARSE_OPTIONS = { ecmaVersion: "latest", sourceType: "module", locations: true };

/**
 * A conversion, request or qualification failure the caller must treat as
 * "no report". `failures` carries the qualification rows when there are any.
 */
export class ProducerError extends Error {
  constructor(message, failures = []) {
    super(message);
    this.name = "ProducerError";
    this.failures = failures;
  }
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function packageVersion(packageName) {
  return readJson(fileURLToPath(import.meta.resolve(`${packageName}/package.json`))).version;
}

// The package directory is the nearest ancestor of the entry file whose
// package.json names the producer; a stray file elsewhere is not a package.
function producerPackage(entryPath) {
  let directory = path.dirname(entryPath);

  while (true) {
    const packageJsonPath = path.join(directory, "package.json");

    if (existsSync(packageJsonPath)) {
      const manifest = readJson(packageJsonPath);

      if (manifest.name === PRODUCER_PACKAGE) {
        return { directory, version: manifest.version };
      }
    }

    const parent = path.dirname(directory);

    if (parent === directory) {
      throw new ProducerError(`No ${PRODUCER_PACKAGE} package.json above ${entryPath}`);
    }

    directory = parent;
  }
}

function expectedLockRecord() {
  return {
    version: DELIVERY.version,
    resolved: `file:${VENDOR_DIRECTORY}/${DELIVERY.archive.file}`,
    integrity: DELIVERY.archive.integrity,
  };
}

function lockFailures(root) {
  const lockPath = path.join(root, "package-lock.json");
  const recorded = existsSync(lockPath)
    ? readJson(lockPath).packages?.[`node_modules/${PRODUCER_PACKAGE}`]
    : undefined;
  const expected = expectedLockRecord();
  const matches =
    recorded !== undefined &&
    Object.entries(expected).every(([field, value]) => recorded[field] === value);

  return matches ? [] : [{ kind: "lock-resolution", expected, actual: recorded ?? null }];
}

// Every way the loaded producer can differ from the maintained delivery.
function deliveryFailures(identity, root) {
  const failures = [];
  const installedPrefix = `${path.join(root, "node_modules", PRODUCER_PACKAGE)}${path.sep}`;
  const checks = [
    ["producer-version", DELIVERY.version, identity.version],
    ["producer-payload", DELIVERY.archive.files[DELIVERED_PAYLOAD_ENTRY], identity.payloadDigest],
    ["producer-license", DELIVERY.license.digest, identity.licenseDigest],
  ];

  if (!identity.entry.startsWith(installedPrefix)) {
    failures.push({ kind: "producer-location", entry: identity.entry });
  }

  for (const [kind, expected, actual] of checks) {
    if (expected !== actual) {
      failures.push({ kind, expected, actual });
    }
  }

  return [...failures, ...lockFailures(root)];
}

/**
 * Qualifies the producer from its bytes on disk, then imports it, and records
 * exactly which bytes were imported: the entry file's digest, the package
 * version and directory, the license digest, and the delivery qualification.
 * Without `entry` the installed package is resolved from this module and must
 * be the maintained delivery under `options.root` (this repository by
 * default), or the load throws before any producer code runs in this
 * process. An explicit `entry` is a control: it loads regardless, with its
 * qualification failures recorded.
 */
export async function loadProducer(entry, options = {}) {
  const root = options.root ?? projectRoot;
  const entryUrl =
    entry === undefined
      ? import.meta.resolve(PRODUCER_PACKAGE)
      : pathToFileURL(path.resolve(entry)).href;
  const entryPath = fileURLToPath(entryUrl);
  const { directory, version } = producerPackage(entryPath);
  const licensePath = path.join(directory, "LICENSE");
  const identity = {
    name: PRODUCER_PACKAGE,
    version,
    entry: entryPath,
    payloadDigest: sha256(readFileSync(entryPath)),
    licenseDigest: existsSync(licensePath) ? sha256(readFileSync(licensePath)) : null,
  };
  const failures = deliveryFailures(identity, root);

  if (entry === undefined && failures.length > 0) {
    const rows = failures.map((failure) => `  ${JSON.stringify(failure)}`).join("\n");
    throw new ProducerError(
      `The installed ${PRODUCER_PACKAGE} is not the maintained delivery:\n${rows}`,
      failures,
    );
  }

  const loaded = await import(entryUrl);

  if (typeof loaded.convert !== "function") {
    throw new ProducerError(`${entryPath} does not export a convert function`);
  }

  return {
    convert: loaded.convert,
    identity,
    delivery: {
      version: DELIVERY.version,
      archive: `${VENDOR_DIRECTORY}/${DELIVERY.archive.file}`,
      integrity: DELIVERY.archive.integrity,
      qualified: failures.length === 0,
      failures,
    },
  };
}

/**
 * The versions and digests a converted artifact is bound to: the producer
 * bytes and their delivery qualification, the parser, merger and codec
 * packages, the runtime, and this adapter.
 */
export function producerIdentity(producer) {
  return {
    producer: producer.identity,
    delivery: producer.delivery,
    parser: { name: "acorn", version: packageVersion("acorn") },
    merger: { name: "istanbul-lib-coverage", version: packageVersion("istanbul-lib-coverage") },
    codec: {
      name: "@jridgewell/sourcemap-codec",
      version: packageVersion("@jridgewell/sourcemap-codec"),
    },
    runtime: { node: process.version, v8: process.versions.v8 },
    adapter: {
      "coverage-producer.convert.mjs": sha256(readFileSync(fileURLToPath(import.meta.url))),
    },
  };
}

// The producer's per-file bookkeeping is not part of the Istanbul shape.
function istanbulRecords(converted) {
  const records = {};

  for (const [filePath, record] of Object.entries(converted)) {
    const { meta: _meta, ...fileCoverage } = record;
    records[filePath] = fileCoverage;
  }

  return records;
}

// One raw V8 script record: the executed `code`, the V8 `coverage` record
// for it (`url` plus `functions`) and the `sourceMap` naming the original
// positions. A fresh AST is parsed for every call.
async function convertScript(producer, script) {
  if (typeof script.code !== "string" || script.coverage?.url === undefined) {
    throw new ProducerError("A script needs executed code and a V8 coverage record with a url");
  }

  const ast = parse(script.code, PARSE_OPTIONS);
  const converted = await producer.convert({
    ast,
    code: script.code,
    coverage: script.coverage,
    sourceMap: script.sourceMap,
    wrapperLength: 0,
  });

  return istanbulRecords(converted);
}

/**
 * A merger over Istanbul's own `CoverageMap`: `merge` folds a plain coverage
 * map in, summing counters of records that share a file and a location, and
 * `toJSON` returns the merged map as plain data with its files in path order,
 * so the bytes do not depend on the order the records arrived in (the
 * merger's own `toJSON` yields `FileCoverage` instances, which keep their
 * maps under `data`, so each is unwrapped to the record a consumer reads
 * directly).
 */
export function createCoverageMerger() {
  const map = libCoverage.createCoverageMap({});

  return {
    merge(coverage) {
      map.merge(coverage);
    },
    toJSON() {
      return Object.fromEntries(
        Object.entries(map.toJSON())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([filePath, file]) => [filePath, file.toJSON()]),
      );
    },
  };
}

/**
 * Converts every script record and merges them through Istanbul's merger,
 * so two workers that ran the same module sum their counters under one
 * identity. Returns the merged coverage map as plain data.
 */
export async function convertScripts(producer, scripts) {
  const merger = createCoverageMerger();

  for (const script of scripts) {
    merger.merge(await convertScript(producer, script));
  }

  return merger.toJSON();
}
