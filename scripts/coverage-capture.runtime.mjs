// Preloaded into every process of one coverage capture run through
// `NODE_OPTIONS=--import`, so the capture CLI's `node --test` runner, each test
// worker and every nested Node subprocess a test spawns all pass through here.
//
// The module does three things and nothing else (D-02, D-04):
//
// 1. Registers the process under the run: a start record at import, an exit
//    record when the process exits normally. A process that dies by signal
//    leaves no exit record, which is how the CLI tells an interrupted worker
//    from a finished one.
// 2. Records every in-project module the loader evaluates: the immutable source
//    bytes and the exact JavaScript handed to V8, both content-addressed under
//    the run directory. For TypeScript that JavaScript is Node's own strip-mode
//    output, and it is what this hook returns to the loader, so the recorded
//    text is the evaluated text and not a later reconstruction of it.
// 3. Refuses anything it cannot record faithfully: a module format other than
//    native ESM, a `.ts` file some other loader already transformed, or a
//    load with no source bytes. The refusal is recorded and then thrown, so the
//    worker fails instead of the run silently mixing an unknown transform into
//    the identity contract.
//
// Native type stripping is the only transformation. Positions are preserved,
// so the raw V8 offsets the runner records index the recorded executed text.

import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const runDirectory = process.env.PI_CM_COVERAGE_RUN_DIR;
const runId = process.env.PI_CM_COVERAGE_RUN_ID;
const root = process.env.PI_CM_COVERAGE_ROOT;

if (runDirectory === undefined || runId === undefined || root === undefined) {
  throw new Error(
    "coverage capture runtime loaded without PI_CM_COVERAGE_RUN_DIR, PI_CM_COVERAGE_RUN_ID and PI_CM_COVERAGE_ROOT",
  );
}

const workersDirectory = path.join(runDirectory, "workers");
const sourcesDirectory = path.join(runDirectory, "sources");
const executedDirectory = path.join(runDirectory, "executed");
const processKey = String(process.pid);
const loadsPath = path.join(workersDirectory, `${processKey}.loads.jsonl`);
const refusalsPath = path.join(workersDirectory, `${processKey}.refusals.jsonl`);
const decoder = new TextDecoder();

for (const directory of [workersDirectory, sourcesDirectory, executedDirectory]) {
  mkdirSync(directory, { recursive: true });
}

// `wx` so a reused pid cannot overwrite another process's registration: the
// second process fails loudly instead of two processes sharing one record.
writeFileSync(
  path.join(workersDirectory, `${processKey}.start.json`),
  `${JSON.stringify({
    pid: process.pid,
    ppid: process.ppid,
    runId,
    execPath: process.execPath,
    execArgv: process.execArgv,
    argv: process.argv,
    cwd: process.cwd(),
    coverageDirectory: process.env.NODE_V8_COVERAGE ?? null,
  })}\n`,
  { flag: "wx" },
);

process.on("exit", (code) => {
  writeFileSync(
    path.join(workersDirectory, `${processKey}.exit.json`),
    `${JSON.stringify({ pid: process.pid, code })}\n`,
  );
});

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

// Content-addressed, so every worker that loads the same bytes lands on the
// same file and a second writer only repeats an identical rename.
function storeContent(directory, digest, bytes) {
  const finalPath = path.join(directory, digest);

  if (existsSync(finalPath)) {
    return;
  }

  const temporaryPath = `${finalPath}.${processKey}.tmp`;
  writeFileSync(temporaryPath, bytes);
  renameSync(temporaryPath, finalPath);
}

// The repository-relative posix path of a `file:` URL inside the run's root,
// or `undefined` for everything the hook leaves alone: builtins, `data:`
// URLs, dependencies under `node_modules`, and files outside the root.
function projectPath(url) {
  if (!url.startsWith("file:")) {
    return undefined;
  }

  const relativePath = path.relative(root, fileURLToPath(url));

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return undefined;
  }

  const posixPath = relativePath.split(path.sep).join("/");
  return posixPath.split("/").includes("node_modules") ? undefined : posixPath;
}

function refuse(modulePath, format, reason) {
  appendFileSync(refusalsPath, `${JSON.stringify({ path: modulePath, format, reason })}\n`);
  throw new Error(`coverage capture refused ${modulePath}: ${reason}`);
}

function expectedFormat(modulePath) {
  if (modulePath.endsWith(".ts") || modulePath.endsWith(".mts")) {
    return "module-typescript";
  }

  if (modulePath.endsWith(".js") || modulePath.endsWith(".mjs")) {
    return "module";
  }

  return undefined;
}

function sourceBytes(source) {
  if (typeof source === "string") {
    return Buffer.from(source, "utf8");
  }

  if (source instanceof Uint8Array) {
    return Buffer.from(source.buffer, source.byteOffset, source.byteLength);
  }

  if (source instanceof ArrayBuffer) {
    return Buffer.from(source);
  }

  return undefined;
}

function recordLoad(modulePath, url, loaded) {
  const format = loaded.format;
  const expected = expectedFormat(modulePath);

  if (expected === undefined) {
    refuse(modulePath, format, `unsupported module extension`);
  }

  if (format !== expected) {
    refuse(modulePath, format, `expected format ${expected}, loader supplied ${format}`);
  }

  const original = sourceBytes(loaded.source);

  if (original === undefined) {
    refuse(modulePath, format, "the loader supplied no source bytes");
  }

  if (format !== "module-typescript") {
    record(modulePath, format, original, original);
    return loaded;
  }

  // The same call Node's own `module-typescript` translator makes, including
  // the `//# sourceURL` trailer, so the executed text and its V8 offsets are
  // the ones the runner would have produced without this hook.
  const executedText = stripTypeScriptTypes(decoder.decode(original), {
    mode: "strip",
    sourceUrl: url,
  });
  record(modulePath, format, original, Buffer.from(executedText, "utf8"));
  return { ...loaded, format: "module", source: executedText };
}

function record(modulePath, format, original, executed) {
  const sourceDigest = sha256(original);
  const executedDigest = sha256(executed);
  storeContent(sourcesDirectory, sourceDigest, original);
  storeContent(executedDirectory, executedDigest, executed);
  appendFileSync(
    loadsPath,
    `${JSON.stringify({ path: modulePath, format, source: sourceDigest, executed: executedDigest })}\n`,
  );
}

registerHooks({
  load(url, context, nextLoad) {
    const loaded = nextLoad(url, context);
    const modulePath = projectPath(url);
    return modulePath === undefined ? loaded : recordLoad(modulePath, url, loaded);
  },
});
