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
//
// Two checks on the producer's output live here as well. Function names come
// from the declaration the executed text carries at exactly the reported
// spans, never from the producer's numbered labels or a nearby line. And
// every location must be a concrete position inside the source text, so an
// invalid sentinel is refused before it can serialize to JSON `null`.

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
import {
  childNodes,
  declaredFunction,
  lineStartsOf,
  locate,
  parseExecuted,
} from "./coverage-syntax.mjs";

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

// A run records a module it loaded under `modules`, with its source in the
// `sources` store, and a production source it never loaded under `unloaded`,
// with its source in the pre-run `inventory` snapshot; both keep the executed
// text in the `executed` store.
function moduleRecord(run, modulePath) {
  const loaded = run.manifest.modules.find((candidate) => candidate.path === modulePath);

  if (loaded !== undefined) {
    return { record: loaded, sourceStore: "sources", loaded: true };
  }

  const unloaded = (run.manifest.unloaded ?? []).find((candidate) => candidate.path === modulePath);
  return unloaded === undefined
    ? undefined
    : { record: unloaded, sourceStore: "inventory", loaded: false };
}

/**
 * The module `modulePath` (repository-relative) as the run recorded it: its
 * absolute path and URL, the original source text and the executed text,
 * each read from the run's content-addressed store and required to hash to
 * the digest the manifest names, and `loaded` telling whether the run
 * evaluated it or recorded its executed text from the inventory snapshot.
 * Throws `SourceMapError` for a module the run did not record or whose
 * stores no longer match.
 */
export function recordedModule(run, modulePath) {
  const found = moduleRecord(run, modulePath);

  if (found === undefined) {
    throw new SourceMapError(`${modulePath} was not recorded by run ${run.manifest.runId}`, [
      { kind: "module-not-captured", path: modulePath },
    ]);
  }

  const { record, sourceStore, loaded } = found;
  const source = storedText(run, sourceStore, record, record.source, "stale-source");
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
    loaded,
  };
}

function collectDeclared(node, consumed, declared) {
  const declaration = declaredFunction(node, consumed);

  if (declaration !== undefined) {
    declared.push(declaration);
  }

  for (const child of childNodes(node)) {
    collectDeclared(child, consumed, declared);
  }
}

function locationKey(location) {
  return `${location.start.line}:${location.start.column}-${location.end.line}:${location.end.column}`;
}

function spanKey(lineStarts, [start, end]) {
  return locationKey({ start: locate(lineStarts, start), end: locate(lineStarts, end) });
}

// Every function the executed text declares, keyed by its exact `decl` and
// `loc` spans in line/column form, from a fresh parse.
function declaredFunctions(executed) {
  const declared = [];
  collectDeclared(parseExecuted(executed), new WeakSet(), declared);
  const lineStarts = lineStartsOf(executed);
  const byKey = new Map();

  for (const declaration of declared) {
    const key = `${spanKey(lineStarts, declaration.decl)}|${spanKey(lineStarts, [declaration.body.start, declaration.body.end])}`;
    byKey.set(key, declaration.name);
  }

  return byKey;
}

/**
 * The file coverage with every function's name taken from the declaration
 * the executed text carries at exactly its `decl` and `loc` spans. A function
 * the source declares without an identifier keeps the producer's label. A
 * function whose spans match no declaration is unproven and throws
 * `SourceMapError`; nothing is matched by name or by nearby position.
 */
export function restoreSourceNames(file, executed) {
  const declared = declaredFunctions(executed);
  const fnMap = {};
  const failures = [];

  for (const [id, fn] of Object.entries(file.fnMap)) {
    const key = `${locationKey(fn.decl)}|${locationKey(fn.loc)}`;

    if (!declared.has(key)) {
      failures.push({ kind: "function-unproven", id, name: fn.name, decl: fn.decl, loc: fn.loc });
      continue;
    }

    const name = declared.get(key);
    fnMap[id] = name === undefined ? fn : { ...fn, name };
  }

  if (failures.length > 0) {
    throw new SourceMapError(
      `${file.path} reports functions the source does not declare`,
      failures,
    );
  }

  return { ...file, fnMap };
}

function isAbsent(location) {
  return [location?.start, location?.end].every(
    (position) =>
      position !== undefined &&
      position !== null &&
      position.line === undefined &&
      position.column === undefined,
  );
}

function isConcretePosition(position, lineLengths) {
  const { line, column } = position ?? {};

  return (
    Number.isInteger(line) &&
    line >= 1 &&
    line <= lineLengths.length &&
    Number.isInteger(column) &&
    column >= 0 &&
    column <= lineLengths[line - 1]
  );
}

function isConcrete(location, lineLengths) {
  return (
    isConcretePosition(location?.start, lineLengths) &&
    isConcretePosition(location?.end, lineLengths) &&
    (location.start.line < location.end.line ||
      (location.start.line === location.end.line && location.start.column <= location.end.column))
  );
}

function* locationParts(file) {
  for (const [id, location] of Object.entries(file.statementMap)) {
    yield { part: `statementMap[${id}]`, location };
  }

  for (const [id, fn] of Object.entries(file.fnMap)) {
    yield { part: `fnMap[${id}].decl`, location: fn.decl };
    yield { part: `fnMap[${id}].loc`, location: fn.loc, line: fn.line };
  }

  for (const [id, branch] of Object.entries(file.branchMap)) {
    yield { part: `branchMap[${id}].loc`, location: branch.loc, line: branch.line };

    for (const [index, location] of branch.locations.entries()) {
      yield { part: `branchMap[${id}].locations[${index}]`, location, absentAllowed: true };
    }
  }
}

/**
 * Every location of `file` that is not a concrete position inside `text`:
 * both endpoints integer lines within the text, columns within the line
 * length (the line length itself included), start not after end, and the
 * `line` field of a function or branch equal to its start line. A branch
 * location with no coordinates at all is the producer's implicit-else
 * representation and is accepted only there. Nothing is clamped.
 */
export function positionFailures(file, text) {
  const lineLengths = text.split("\n").map((line) => line.length);
  const failures = [];

  for (const { part, location, line, absentAllowed } of locationParts(file)) {
    if (absentAllowed && isAbsent(location)) {
      continue;
    }

    if (!isConcrete(location, lineLengths)) {
      failures.push({ kind: "position", part, location });
    } else if (line !== undefined && line !== location.start.line) {
      failures.push({
        kind: "position",
        part: `${part.replace(/\.loc$/u, "")}.line`,
        line,
        location,
      });
    }
  }

  return failures;
}
