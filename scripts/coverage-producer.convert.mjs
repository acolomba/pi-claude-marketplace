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

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { parse } from "acorn";
import libCoverage from "istanbul-lib-coverage";

const PRODUCER_PACKAGE = "ast-v8-to-istanbul";

const PARSE_OPTIONS = { ecmaVersion: "latest", sourceType: "module", locations: true };

/** A conversion or request failure the caller must treat as "no report". */
export class ProducerError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProducerError";
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

/**
 * Imports the producer and records exactly which bytes were imported: the
 * entry file's digest, the package version and directory, and the license
 * digest. `entry` names an explicit entry file; without it the installed
 * package is resolved from this module.
 */
export async function loadProducer(entry) {
  const entryUrl =
    entry === undefined
      ? import.meta.resolve(PRODUCER_PACKAGE)
      : pathToFileURL(path.resolve(entry)).href;
  const entryPath = fileURLToPath(entryUrl);
  const loaded = await import(entryUrl);

  if (typeof loaded.convert !== "function") {
    throw new ProducerError(`${entryPath} does not export a convert function`);
  }

  const { directory, version } = producerPackage(entryPath);
  const licensePath = path.join(directory, "LICENSE");

  return {
    convert: loaded.convert,
    identity: {
      name: PRODUCER_PACKAGE,
      version,
      entry: entryPath,
      payloadDigest: sha256(readFileSync(entryPath)),
      licenseDigest: existsSync(licensePath) ? sha256(readFileSync(licensePath)) : null,
    },
  };
}

/**
 * The versions and digests a converted artifact is bound to: the producer
 * bytes, the parser, merger and codec packages, the runtime, and this adapter.
 */
export function producerIdentity(producer) {
  return {
    producer: producer.identity,
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
 * Converts every script record and merges them through Istanbul's merger,
 * so two workers that ran the same module sum their counters under one
 * identity. Returns the merged coverage map as plain JSON data.
 */
export async function convertScripts(producer, scripts) {
  const map = libCoverage.createCoverageMap({});

  for (const script of scripts) {
    map.merge(await convertScript(producer, script));
  }

  return map.toJSON();
}
