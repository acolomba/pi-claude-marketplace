// `npm run coverage:producer`: converts raw V8 script records into one
// Istanbul coverage map through the producer adapter in
// `coverage-producer.convert.mjs` (D-03, D-04, D-05, D-09).
//
//   node scripts/coverage-producer.mjs --request <json> --out <json>
//                                      [--receipt <json>] [--producer <entry>]
//
// A request takes one of three forms, with every path relative to the request
// file. A snapshot request names a capture run manifest, the repository-
// relative `modules` to convert and the run's `raw` V8 files to read: every
// record of a requested module in every snapshot is converted from a fresh
// AST over the run's recorded executed text and merged through Istanbul's
// merger, so a module two workers loaded sums their counters under one
// identity. A snapshot is one raw file of the run, listed once and unchanged;
// a module the run loaded must appear in at least one snapshot, and a module
// the run never loaded is converted with the producer's zero-execution model
// so it keeps its complete map at count 0. A run request names the manifest
// and lists scripts as `{ path, coverage }`: one module and the raw file
// holding its record. An explicit request lists scripts as
// `{ url, code, sourceMap, coverage }` and converts them as given. Run and
// snapshot requests restore every function name from the declaration at its
// exact spans. Either way every location of the merged map must be a
// concrete position inside its source text, checked in memory and again on
// the serialized JSON, before the output is written atomically; `--receipt`
// also writes the identity of the producer, parser, merger, codec, runtime
// and adapter the conversion used. A record that cannot be converted or
// validated fails the whole command with exit status 1 and no output file.
// The module is inert on import.

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sha256, toProjectPath } from "./coverage-capture.manifest.mjs";
import {
  convertScripts,
  createCoverageMerger,
  loadProducer,
  ProducerError,
  producerIdentity,
} from "./coverage-producer.convert.mjs";
import {
  executedSourceMap,
  openCaptureRun,
  positionFailures,
  recordedModule,
  restoreSourceNames,
} from "./coverage-source-map.mjs";

class UsageError extends Error {}

const OPTIONS = ["--request", "--out", "--receipt", "--producer"];

function parseArguments(args) {
  const options = { request: undefined, out: undefined, receipt: undefined, producer: undefined };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const value = args[index + 1];

    if (OPTIONS.includes(argument) && value !== undefined) {
      options[argument.slice(2)] = path.resolve(value);
      index += 1;
    } else {
      throw new UsageError(
        `Unknown option: ${argument}. Pass --request <json> --out <json> [--receipt <json>] [--producer <entry>].`,
      );
    }
  }

  if (options.request === undefined || options.out === undefined) {
    throw new UsageError("Both --request <json> and --out <json> are required.");
  }

  return options;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function canonicalJson(value) {
  return `${JSON.stringify(value, undefined, 2)}\n`;
}

function withRows(message, failures) {
  const rows = failures.map((failure) => `  ${JSON.stringify(failure)}`).join("\n");
  return new ProducerError(`${message}\n${rows}`, failures);
}

function requireStrings(entry, index, fields) {
  for (const field of fields) {
    if (typeof entry?.[field] !== "string") {
      throw new ProducerError(`Request script ${index} lacks a string ${field}`);
    }
  }
}

function requireStringList(request, field) {
  const list = request[field];

  if (!Array.isArray(list) || list.some((item) => typeof item !== "string")) {
    throw new ProducerError(`A snapshot request needs a string list ${field}`);
  }

  return list;
}

// The one V8 record for `url` in the raw file at `rawPath`.
function rawRecord(rawPath, url) {
  const records = readJson(rawPath).result?.filter((record) => record.url === url) ?? [];

  if (records.length !== 1) {
    throw new ProducerError(
      `Expected exactly one record for ${url} in ${rawPath}, found ${records.length}`,
    );
  }

  return records[0];
}

// The path the producer files a script's coverage under: its source map's
// first source, resolved the way the producer resolves it.
function coveragePath(url, sourceMap) {
  const source = sourceMap.sources?.[0];

  if (typeof source !== "string") {
    throw new ProducerError(`The source map for ${url} names no source`);
  }

  return source.startsWith("file://")
    ? fileURLToPath(source)
    : path.resolve(path.dirname(fileURLToPath(url)), source);
}

// An explicit script names the executed code, the source map and the raw V8
// file that holds the record for `url`; its source text is the map's content.
function readExplicitScript(requestDirectory, sources, entry, index) {
  requireStrings(entry, index, ["url", "code", "sourceMap", "coverage"]);
  const sourceMap = readJson(path.resolve(requestDirectory, entry.sourceMap));
  sources.set(coveragePath(entry.url, sourceMap), { text: sourceMap.sourcesContent?.[0] });

  return {
    code: readFileSync(path.resolve(requestDirectory, entry.code), "utf8"),
    sourceMap,
    coverage: rawRecord(path.resolve(requestDirectory, entry.coverage), entry.url),
  };
}

// The recorded module `modulePath` of `run` as a script to convert: its
// executed text, its identity map and the URL V8 records it under. The
// source and executed texts are filed under `sources` for the checks that
// follow conversion.
function recordedScript(run, sources, modulePath) {
  const module = recordedModule(run, modulePath);
  sources.set(module.path, { text: module.original, executed: module.executed });

  return {
    url: module.url,
    code: module.executed,
    sourceMap: executedSourceMap(module),
    loaded: module.loaded,
  };
}

// A run script names a module the run recorded and the raw V8 file holding
// its record; the executed text and its identity map come from the run. A
// module named by several scripts is read and mapped once.
function readRunScript(run, sources, mapped, requestDirectory, entry, index) {
  requireStrings(entry, index, ["path", "coverage"]);
  let script = mapped.get(entry.path);

  if (script === undefined) {
    script = recordedScript(run, sources, entry.path);
    mapped.set(entry.path, script);
  }

  return {
    code: script.code,
    sourceMap: script.sourceMap,
    coverage: rawRecord(path.resolve(requestDirectory, entry.coverage), script.url),
  };
}

function readRunScripts(run, request, requestDirectory, sources) {
  if (!Array.isArray(request.scripts) || request.scripts.length === 0) {
    throw new ProducerError(`A run request must list at least one script`);
  }

  const mapped = new Map();
  return request.scripts.map((entry, index) =>
    readRunScript(run, sources, mapped, requestDirectory, entry, index),
  );
}

// The modules of a snapshot request, keyed by the URL V8 records them under,
// each counting the snapshots that carried a record for it.
function snapshotModules(run, sources, paths) {
  const modules = new Map();

  for (const modulePath of paths) {
    const script = recordedScript(run, sources, modulePath);
    modules.set(script.url, { path: modulePath, script, observed: 0 });
  }

  return modules;
}

// One raw file of the run: a snapshot the manifest lists, named once in the
// request, with the bytes the manifest digested.
function snapshotRecord(run, requestDirectory, rawPath, seen) {
  const absolutePath = path.resolve(requestDirectory, rawPath);
  const snapshotPath = toProjectPath(run.root, absolutePath);
  const listed = run.manifest.raw.find((record) => record.path === snapshotPath);

  if (listed === undefined) {
    throw withRows(`${rawPath} is not a raw record of run ${run.manifest.runId}`, [
      { kind: "unknown-snapshot", path: rawPath },
    ]);
  }

  if (seen.has(snapshotPath)) {
    throw withRows(`${rawPath} is listed twice; one snapshot is one execution`, [
      { kind: "duplicate-snapshot", path: snapshotPath },
    ]);
  }

  seen.add(snapshotPath);
  const bytes = readFileSync(absolutePath);

  if (sha256(bytes) !== listed.digest) {
    throw withRows(`${rawPath} no longer matches run ${run.manifest.runId}`, [
      { kind: "stale-snapshot", path: snapshotPath },
    ]);
  }

  return { path: snapshotPath, result: JSON.parse(bytes.toString("utf8")).result ?? [] };
}

// The scripts one snapshot contributes: every record of a requested module,
// each URL at most once per snapshot.
function snapshotScripts(snapshot, modules) {
  const scripts = [];
  const counted = new Set();

  for (const record of snapshot.result) {
    const module = modules.get(record.url);

    if (module === undefined) {
      continue;
    }

    if (counted.has(record.url)) {
      throw withRows(`${snapshot.path} records ${module.path} twice`, [
        { kind: "duplicate-script", snapshot: snapshot.path, path: module.path },
      ]);
    }

    counted.add(record.url);
    module.observed += 1;
    scripts.push({ ...module.script, coverage: record });
  }

  return scripts;
}

// A module the run never loaded has no V8 record. The producer's own model of
// a script V8 never saw is every construct at count 0 (`functions: []`), so
// the file keeps its complete map with zero execution instead of vanishing
// from the denominator (D-07). A loaded module no snapshot carries, or an
// unloaded one some snapshot does carry, contradicts the run and is refused.
function unobservedScripts(modules) {
  const scripts = [];
  const failures = [];

  for (const module of modules.values()) {
    if (module.observed > 0 && !module.script.loaded) {
      failures.push({ kind: "unexpected-record", path: module.path });
    } else if (module.observed === 0 && module.script.loaded) {
      failures.push({ kind: "unobserved-module", path: module.path });
    } else if (module.observed === 0) {
      scripts.push({ ...module.script, coverage: { url: module.script.url, functions: [] } });
    }
  }

  if (failures.length > 0) {
    throw withRows("The snapshots contradict the run's module records", failures);
  }

  return scripts;
}

// Converts snapshot by snapshot, merging as it goes, so a run's raw files are
// read once each and never held together.
async function convertSnapshots(producer, snapshots) {
  const { run, requestDirectory, modules, raw } = snapshots;
  const merger = createCoverageMerger();
  const seen = new Set();

  for (const rawPath of raw) {
    const snapshot = snapshotRecord(run, requestDirectory, rawPath, seen);
    merger.merge(await convertScripts(producer, snapshotScripts(snapshot, modules)));
  }

  merger.merge(await convertScripts(producer, unobservedScripts(modules)));
  return merger.toJSON();
}

// The scripts to convert (or the snapshots to convert them from), plus the
// source text of every path the coverage will be filed under (and the
// executed text where names are restored).
function readRequest(requestPath) {
  const request = readJson(requestPath);
  const requestDirectory = path.dirname(requestPath);
  const sources = new Map();

  if (request.run === undefined) {
    if (!Array.isArray(request.scripts) || request.scripts.length === 0) {
      throw new ProducerError(`${requestPath} must list at least one script`);
    }

    const scripts = request.scripts.map((entry, index) =>
      readExplicitScript(requestDirectory, sources, entry, index),
    );
    return { scripts, sources };
  }

  const run = openCaptureRun(path.resolve(requestDirectory, request.run));

  if (request.raw === undefined) {
    return { scripts: readRunScripts(run, request, requestDirectory, sources), sources };
  }

  const paths = requireStringList(request, "modules");
  const raw = requireStringList(request, "raw");

  if (paths.length === 0) {
    throw new ProducerError(`${requestPath} must name at least one module`);
  }

  return {
    snapshots: { run, requestDirectory, modules: snapshotModules(run, sources, paths), raw },
    sources,
  };
}

function convertRequest(producer, request) {
  return request.snapshots === undefined
    ? convertScripts(producer, request.scripts)
    : convertSnapshots(producer, request.snapshots);
}

function sourceOf(sources, filePath) {
  const source = sources.get(filePath);

  if (source === undefined || typeof source.text !== "string") {
    throw new ProducerError(`No source text is known for ${filePath}`);
  }

  return source;
}

// Restores declaration names wherever the executed text is known.
function restoreNames(coverage, sources) {
  const restored = {};

  for (const [filePath, file] of Object.entries(coverage)) {
    const { executed } = sourceOf(sources, filePath);
    restored[filePath] = executed === undefined ? file : restoreSourceNames(file, executed);
  }

  return restored;
}

function assertConcretePositions(coverage, sources, stage) {
  const failures = Object.entries(coverage).flatMap(([filePath, file]) =>
    positionFailures(file, sourceOf(sources, filePath).text).map((failure) => ({
      ...failure,
      path: filePath,
    })),
  );

  if (failures.length > 0) {
    throw withRows(`Coverage locations are not concrete positions (${stage})`, failures);
  }
}

function writeTextAtomically(filePath, text) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, text);
  renameSync(temporaryPath, filePath);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const request = readRequest(options.request);
  const producer = await loadProducer(options.producer);
  const coverage = restoreNames(await convertRequest(producer, request), request.sources);
  assertConcretePositions(coverage, request.sources, "in memory");
  const json = canonicalJson(coverage);
  assertConcretePositions(JSON.parse(json), request.sources, "on readback");
  writeTextAtomically(options.out, json);

  if (options.receipt !== undefined) {
    writeTextAtomically(options.receipt, canonicalJson(producerIdentity(producer)));
  }

  process.stdout.write(
    `Converted ${Object.keys(coverage).length} file record(s) with ${producer.identity.name}@${producer.identity.version} (${producer.identity.payloadDigest.slice(0, 16)}) -> ${options.out}\n`,
  );
  return 0;
}

const invokedPath = process.argv[1] === undefined ? undefined : path.resolve(process.argv[1]);

if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = error instanceof UsageError ? 2 : 1;
  }
}
