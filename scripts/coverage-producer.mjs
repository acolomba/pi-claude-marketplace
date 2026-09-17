// `npm run coverage:producer`: converts the raw V8 script records a request
// names into one Istanbul coverage map through the producer adapter in
// `coverage-producer.convert.mjs` (D-03, D-05, D-09).
//
//   node scripts/coverage-producer.mjs --request <json> --out <json>
//                                      [--receipt <json>] [--producer <entry>]
//
// The request lists scripts as `{ url, code, sourceMap, coverage }`: the
// script URL V8 recorded, the executed JavaScript file, the source map file
// and the raw V8 file holding that URL's record, with paths relative to the
// request file. The output is written atomically; `--receipt` also writes
// the identity of the producer, parser, merger, codec, runtime and adapter
// the conversion used. A record that cannot be converted fails the whole
// command with exit status 1 and no output file. The module is inert on
// import.

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  convertScripts,
  loadProducer,
  ProducerError,
  producerIdentity,
} from "./coverage-producer.convert.mjs";

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

// Each request script names the executed code, the source map and the raw V8
// file that holds the record for `url`; paths are relative to the request.
function readRequestScript(requestDirectory, entry, index) {
  for (const field of ["url", "code", "sourceMap", "coverage"]) {
    if (typeof entry?.[field] !== "string") {
      throw new ProducerError(`Request script ${index} lacks a string ${field}`);
    }
  }

  const rawPath = path.resolve(requestDirectory, entry.coverage);
  const records = readJson(rawPath).result?.filter((record) => record.url === entry.url) ?? [];

  if (records.length !== 1) {
    throw new ProducerError(
      `Expected exactly one record for ${entry.url} in ${rawPath}, found ${records.length}`,
    );
  }

  return {
    code: readFileSync(path.resolve(requestDirectory, entry.code), "utf8"),
    sourceMap: readJson(path.resolve(requestDirectory, entry.sourceMap)),
    coverage: records[0],
  };
}

function readRequest(requestPath) {
  const request = readJson(requestPath);

  if (!Array.isArray(request.scripts) || request.scripts.length === 0) {
    throw new ProducerError(`${requestPath} must list at least one script`);
  }

  const requestDirectory = path.dirname(requestPath);
  return request.scripts.map((entry, index) => readRequestScript(requestDirectory, entry, index));
}

function writeJsonAtomically(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(value, undefined, 2)}\n`);
  renameSync(temporaryPath, filePath);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const scripts = readRequest(options.request);
  const producer = await loadProducer(options.producer);
  const coverage = await convertScripts(producer, scripts);
  writeJsonAtomically(options.out, coverage);

  if (options.receipt !== undefined) {
    writeJsonAtomically(options.receipt, producerIdentity(producer));
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
