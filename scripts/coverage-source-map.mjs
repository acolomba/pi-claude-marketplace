// The executed-source mapping for one captured module (D-03, D-04, D-09):
// proves that the JavaScript a capture run evaluated is the immutable
// original source at every UTF-16 position, then hands the producer an
// explicit identity source map over it.
//
// A capture run stores the original bytes and the executed text of every
// in-project module under content digests. For a TypeScript module the
// executed text is Node's strip-mode output plus the `//# sourceURL` trailer
// the translator appends: types become blanks of the same UTF-16 length, so
// every remaining character, every line boundary and every column keeps its
// position. This module requires exactly that relationship and refuses
// anything else; it never shifts, clamps or repairs a coordinate.
//
// The identity map carries one segment per UTF-16 column of every original
// line plus the column equal to the line length, so a node that ends at the
// end of a line resolves to a finite endpoint instead of the producer's
// `Infinity` sentinel. Lines the trailer adds have no mapping.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { encode } from "@jridgewell/sourcemap-codec";

import {
  canonicalJson,
  MANIFEST_KIND,
  MANIFEST_SCHEMA_VERSION,
  RUNS_DIRECTORY,
  sha256,
  toolingIdentity,
  toProjectPath,
} from "./coverage-capture.manifest.mjs";

// Strip mode blanks a removed character with a space, and pads the second
// unit of a removed surrogate pair with U+FEFF so the UTF-16 length holds.
const BLANKS = new Set([" ", "﻿"]);
const LINE_TERMINATORS = new Set(["\n", "\r"]);

// A mapping, identity or run failure the caller must treat as "no report".
// `failures` carries the `{ kind, ... }` rows, and the message repeats them
// one per line so a command that prints it shows every row.
class SourceMapError extends Error {
  constructor(message, failures) {
    const rows = failures.map((failure) => `  ${JSON.stringify(failure)}`).join("\n");
    super(`${message}\n${rows}`);
    this.name = "SourceMapError";
    this.failures = failures;
  }
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function positionAt(text, offset) {
  const lineStart = text.lastIndexOf("\n", offset - 1) + 1;
  const line = text.slice(0, lineStart).split("\n").length;
  return { line, column: offset - lineStart };
}

// The first position where the executed body is not the original with
// types blanked out: a moved line terminator or any other changed character.
function transformFailure(original, body) {
  for (let offset = 0; offset < original.length; offset += 1) {
    const originalChar = original[offset];
    const executedChar = body[offset];

    if (originalChar === executedChar) {
      continue;
    }

    if (LINE_TERMINATORS.has(originalChar)) {
      return { kind: "line-boundary", ...positionAt(original, offset) };
    }

    if (!BLANKS.has(executedChar)) {
      return {
        kind: "transform",
        ...positionAt(original, offset),
        original: originalChar,
        executed: executedChar,
      };
    }
  }

  return undefined;
}

// The executed text is either the original itself (a JavaScript module) or a
// position-preserving strip of it followed by the sourceURL trailer.
function executedBodyFailure(module) {
  const { original, executed, url } = module;

  if (executed === original) {
    return undefined;
  }

  const trailer = `\n\n//# sourceURL=${url}`;

  if (!executed.endsWith(trailer)) {
    return { kind: "executed-trailer", url };
  }

  const body = executed.slice(0, executed.length - trailer.length);

  if (body.length !== original.length) {
    return { kind: "executed-length", expected: original.length, actual: body.length };
  }

  return transformFailure(original, body);
}

/**
 * The identity source map from the executed text of `module` back to its
 * original source: `{ path, url, original, executed }`, where `original` is
 * the immutable source text and `executed` the text V8 evaluated. Throws
 * `SourceMapError` unless the two agree at every position.
 */
export function executedSourceMap(module) {
  const failure = executedBodyFailure(module);

  if (failure !== undefined) {
    throw new SourceMapError(`${module.path} is not a position-preserving strip of its source`, [
      failure,
    ]);
  }

  const segments = module.original
    .split("\n")
    .map((line, lineIndex) =>
      Array.from({ length: line.length + 1 }, (_, column) => [column, 0, lineIndex, column]),
    );

  return {
    version: 3,
    file: module.path,
    sources: [module.path],
    sourcesContent: [module.original],
    names: [],
    mappings: encode(segments),
  };
}

function runFailures(manifestPath, manifest, directory, root) {
  if (manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION || manifest.kind !== MANIFEST_KIND) {
    return [{ kind: "unsupported-version", path: manifestPath }];
  }

  if (manifest.status !== "captured") {
    return [{ kind: "not-captured", status: manifest.status }];
  }

  const failures = [];

  if (toProjectPath(root, directory) !== `${RUNS_DIRECTORY}/${manifest.runId}`) {
    failures.push({ kind: "foreign-run", path: manifestPath, runId: manifest.runId });
  }

  if (canonicalJson(manifest.tooling) !== canonicalJson(toolingIdentity())) {
    failures.push({ kind: "tool-changed" });
  }

  if (manifest.runtime?.node !== process.version) {
    failures.push({ kind: "runtime-changed", recorded: manifest.runtime?.node ?? null });
  }

  return failures;
}

/**
 * Opens the capture run whose manifest is at `manifestPath`
 * (`<root>/coverage/runs/<runId>/manifest.json`) and binds it to this
 * tooling: the manifest must be a captured run of this schema, sit in its own
 * run directory, and record the capture scripts and Node version in use now.
 * Any difference makes the run obsolete and throws `SourceMapError`.
 */
export function openCaptureRun(manifestPath) {
  const resolvedPath = path.resolve(manifestPath);
  const directory = path.dirname(resolvedPath);
  const root = path.resolve(directory, "..", "..", "..");
  const manifest = readJson(resolvedPath);
  const failures = runFailures(resolvedPath, manifest, directory, root);

  if (failures.length > 0) {
    throw new SourceMapError(`${resolvedPath} is not a usable capture run`, failures);
  }

  return { root, directory, manifest };
}

// One entry of a content-addressed store, required to hash to its name.
function storedText(run, store, record, digest, staleKind) {
  const storePath = path.join(run.directory, store, digest);

  if (!existsSync(storePath)) {
    return { failure: { kind: "missing-artifact", path: record.path, store, digest } };
  }

  const bytes = readFileSync(storePath);
  const actual = sha256(bytes);

  if (actual !== digest) {
    return { failure: { kind: staleKind, path: record.path, expected: digest, actual } };
  }

  return { text: bytes.toString("utf8") };
}

/**
 * The module `modulePath` (repository-relative) as the run recorded it: its
 * absolute path and URL, the original source text and the executed text,
 * each read from the run's content-addressed store and required to hash to
 * the digest the manifest names. Throws `SourceMapError` otherwise.
 */
export function recordedModule(run, modulePath) {
  const record = run.manifest.modules.find((candidate) => candidate.path === modulePath);

  if (record === undefined) {
    throw new SourceMapError(`${modulePath} was not loaded by run ${run.manifest.runId}`, [
      { kind: "module-not-captured", path: modulePath },
    ]);
  }

  const source = storedText(run, "sources", record, record.source, "stale-source");
  const executed = storedText(run, "executed", record, record.executed, "stale-executed");
  const failures = [source.failure, executed.failure].filter((failure) => failure !== undefined);

  if (failures.length > 0) {
    throw new SourceMapError(`${modulePath} no longer matches run ${run.manifest.runId}`, failures);
  }

  const absolutePath = path.join(run.root, modulePath);

  return {
    path: absolutePath,
    url: pathToFileURL(absolutePath).href,
    original: source.text,
    executed: executed.text,
  };
}
