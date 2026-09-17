// `npm run coverage:producer`: converts the raw V8 script records a request
// names into one Istanbul coverage map through the producer adapter in
// `coverage-producer.convert.mjs` (D-03, D-05, D-09).
//
//   node scripts/coverage-producer.mjs --request <json> --out <json>
//                                      [--receipt <json>] [--producer <entry>]
//
// A request takes one of two forms, with every path relative to the request
// file. A run request names a capture run manifest and lists scripts as
// `{ path, coverage }`: the repository-relative module path and the raw V8
// file holding its record. The module's immutable source and executed text
// come from the run's own stores and are mapped through the identity source
// map of `coverage-source-map.mjs`, and every function name is restored from
// the declaration at its exact spans. An explicit request lists scripts as
// `{ url, code, sourceMap, coverage }`: the script URL V8 recorded, the
// executed JavaScript file, the source map file and the raw V8 file, and
// converts them as given. Either way every location of the merged map must
// be a concrete position inside its source text, checked in memory and again
// on the serialized JSON, before the output is written atomically;
// `--receipt` also writes the identity of the producer, parser, merger,
// codec, runtime and adapter the conversion used. A record that cannot be
// converted or validated fails the whole command with exit status 1 and no
// output file. The module is inert on import.

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  convertScripts,
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

// A run script names a module the run recorded and the raw V8 file holding
// its record; the executed text and its identity map come from the run. A
// module named by several scripts is read and mapped once.
function readRunScript(run, sources, mapped, requestDirectory, entry, index) {
  requireStrings(entry, index, ["path", "coverage"]);
  let script = mapped.get(entry.path);

  if (script === undefined) {
    const module = recordedModule(run, entry.path);
    script = { url: module.url, code: module.executed, sourceMap: executedSourceMap(module) };
    sources.set(module.path, { text: module.original, executed: module.executed });
    mapped.set(entry.path, script);
  }

  return {
    code: script.code,
    sourceMap: script.sourceMap,
    coverage: rawRecord(path.resolve(requestDirectory, entry.coverage), script.url),
  };
}

// The scripts to convert, plus the source text of every path the coverage
// will be filed under (and the executed text where names are restored).
function readRequest(requestPath) {
  const request = readJson(requestPath);

  if (!Array.isArray(request.scripts) || request.scripts.length === 0) {
    throw new ProducerError(`${requestPath} must list at least one script`);
  }

  const requestDirectory = path.dirname(requestPath);
  const sources = new Map();

  if (request.run === undefined) {
    const scripts = request.scripts.map((entry, index) =>
      readExplicitScript(requestDirectory, sources, entry, index),
    );
    return { scripts, sources };
  }

  const run = openCaptureRun(path.resolve(requestDirectory, request.run));
  const mapped = new Map();
  const scripts = request.scripts.map((entry, index) =>
    readRunScript(run, sources, mapped, requestDirectory, entry, index),
  );
  return { scripts, sources };
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
  const { scripts, sources } = readRequest(options.request);
  const producer = await loadProducer(options.producer);
  const coverage = restoreNames(await convertScripts(producer, scripts), sources);
  assertConcretePositions(coverage, sources, "in memory");
  const json = canonicalJson(coverage);
  assertConcretePositions(JSON.parse(json), sources, "on readback");
  writeTextAtomically(options.out, json);

  if (options.receipt !== undefined) {
    writeTextAtomically(options.receipt, canonicalJson(producerIdentity(producer)));
  }

  process.stdout.write(
    `Converted ${scripts.length} script record(s) with ${producer.identity.name}@${producer.identity.version} (${producer.identity.payloadDigest.slice(0, 16)}) -> ${options.out}\n`,
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
