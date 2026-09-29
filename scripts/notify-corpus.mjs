// fallow-ignore-file unused-file -- operator-run corpus tool (D-01, D-03): an engineer runs it from the command line, no npm script or module imports it, and it is deleted at milestone close.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Captures every `ctx.ui.notify` call the test suites make and diffs it against a baseline, so a
 * refactor of the presentation layer cannot change one byte of text output unnoticed (D-01..D-04).
 *
 * `capture` runs `node --test` under the `notify-corpus.hook.mjs` preload, which records each
 * call's `(message, severity, argc)` and the test file that made it. Messages are normalized so
 * two captures of an unchanged tree are identical. `diff` compares two corpora per test file as
 * multisets: a baseline entry missing from the same file's capture fails (D-02), and an entry
 * present only in the capture is listed for review.
 *
 * Its companion `.negative.mjs` plants a drift and proves the diff reports it.
 */

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const hookUrl = pathToFileURL(fileURLToPath(new URL("notify-corpus.hook.mjs", import.meta.url)));
const excerptLength = 120;
const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
// write-file-atomic names its temp file `<target>.<number>`.
const atomicSuffixPattern = /(\.json)\.\d{4,}/g;

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

// A root matches only where it starts a path: not inside a longer name, and not right after a
// placeholder an earlier, longer root left behind.
function rootPattern({ root, wholeToken }) {
  const tail = wholeToken ? String.raw`(?:/[^\s'")]*)?` : "";

  return new RegExp(String.raw`(?<![\w.$>-])${escapeRegExp(root)}(?![\w-])${tail}`, "g");
}

/**
 * The roots the capture maps to placeholders. The temp root replaces the whole path token,
 * because the directory names under it are random. The other roots replace only the prefix.
 */
function defaultRoots() {
  return [
    { root: os.tmpdir(), placeholder: "<TMPPATH>", wholeToken: true },
    { root: projectRoot, placeholder: "<CWD>", wholeToken: false },
    { root: os.homedir(), placeholder: "<HOME>", wholeToken: false },
  ];
}

/**
 * Replaces machine- and run-specific text in one message. Longer roots go first, so a root nested
 * in another (a checkout under the home directory) takes its own placeholder.
 */
export function normalizeMessage(text, roots) {
  const byLength = [...roots].sort((left, right) => right.root.length - left.root.length);
  let normalized = text;

  for (const root of byLength) {
    normalized = normalized.replace(rootPattern(root), root.placeholder);
  }

  return normalized.replace(uuidPattern, "<UUID>").replace(atomicSuffixPattern, "$1.<N>");
}

function entryKey(entry) {
  return JSON.stringify([entry.message, entry.severity, entry.argc]);
}

function compareText(left, right) {
  if (left < right) {
    return -1;
  }

  return left > right ? 1 : 0;
}

// Every non-ASCII UTF-16 unit becomes `\uXXXX`, so the text-fixing commit hooks never touch it.
function escapeNonAscii(text) {
  return text.replace(
    /[\u0080-￿]/g,
    (unit) => `\\u${unit.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

/** One JSON line per entry, sorted by file and then by entry, ASCII only. */
export function serializeCorpus(entries) {
  const sorted = [...entries].sort(
    (left, right) =>
      compareText(left.file, right.file) || compareText(entryKey(left), entryKey(right)),
  );

  return sorted
    .map(({ file, message, severity, argc }) =>
      escapeNonAscii(JSON.stringify({ file, message, severity, argc })),
    )
    .map((line) => `${line}\n`)
    .join("");
}

export function parseCorpus(text) {
  return text
    .split("\n")
    .filter((line) => line !== "")
    .map((line, index) => {
      const entry = JSON.parse(line);

      if (typeof entry.file !== "string" || typeof entry.argc !== "number") {
        throw new Error(
          `Corpus line ${index + 1} is not a { file, message, severity, argc } entry`,
        );
      }

      return entry;
    });
}

// file -> entry key -> { entry, count }
function multisetsByFile(entries) {
  const files = new Map();

  for (const entry of entries) {
    const keys = files.get(entry.file) ?? new Map();
    const key = entryKey(entry);
    const slot = keys.get(key) ?? { entry, count: 0 };

    slot.count += 1;
    keys.set(key, slot);
    files.set(entry.file, keys);
  }

  return files;
}

// The entries `left` holds more often than `right` for the same file, with the surplus count.
function surplus(left, right) {
  const result = [];

  for (const [file, keys] of left) {
    for (const [key, { entry, count }] of keys) {
      const otherCount = right.get(file)?.get(key)?.count ?? 0;

      if (count > otherCount) {
        const { message, severity, argc } = entry;

        result.push({ file, message, severity, argc, count: count - otherCount });
      }
    }
  }

  return result;
}

/**
 * Per-file multiset diff (D-02). `missing` holds baseline entries the capture lacks, `extra`
 * holds capture entries the baseline lacks, each with the count by which it falls short.
 */
export function diffCorpus(baseline, capture) {
  const baselineSets = multisetsByFile(baseline);
  const captureSets = multisetsByFile(capture);

  return {
    missing: surplus(baselineSets, captureSets),
    extra: surplus(captureSets, baselineSets),
    totals: { baseline: baseline.length, capture: capture.length },
  };
}

function captureCorpus(outPath, testPaths) {
  const outputDirectory = mkdtempSync(path.join(os.tmpdir(), "notify-corpus-"));

  try {
    const testRun = spawnSync(
      process.execPath,
      ["--import", hookUrl.href, "--test", ...testPaths],
      {
        cwd: projectRoot,
        env: { ...process.env, NOTIFY_CORPUS_OUT: outputDirectory },
        stdio: "inherit",
      },
    );

    if (testRun.status !== 0) {
      throw new Error(
        `The test run exited ${testRun.status ?? testRun.signal}, so its corpus is incomplete`,
      );
    }

    const roots = defaultRoots();
    const entries = readdirSync(outputDirectory)
      .filter((name) => name.endsWith(".jsonl"))
      .flatMap((name) => parseCorpus(readFileSync(path.join(outputDirectory, name), "utf8")))
      .map((entry) =>
        typeof entry.message === "string"
          ? { ...entry, message: normalizeMessage(entry.message, roots) }
          : entry,
      );

    mkdirSync(path.dirname(outPath), { recursive: true });
    writeFileSync(outPath, serializeCorpus(entries));

    return entries;
  } finally {
    rmSync(outputDirectory, { force: true, recursive: true });
  }
}

function describeEntry({ file, message, severity, argc, count }) {
  const text = String(message);
  const excerpt = text.length > excerptLength ? `${text.slice(0, excerptLength)}...` : text;

  return `${file}: ${JSON.stringify(excerpt)} (argc ${argc}, severity ${severity}) x${count}`;
}

// Prints the diff and answers whether it passes.
function reportDiff(result) {
  for (const entry of result.extra) {
    process.stdout.write(`extra in ${describeEntry(entry)}\n`);
  }

  for (const entry of result.missing) {
    process.stderr.write(`missing in ${describeEntry(entry)}\n`);
  }

  return result.missing.length === 0;
}

function readCorpus(corpusPath) {
  return parseCorpus(readFileSync(corpusPath, "utf8"));
}

// `capture --out <file> --files <path> ...`
function parseCaptureArgs(args) {
  const outIndex = args.indexOf("--out");
  const filesIndex = args.indexOf("--files");
  const outPath = outIndex === -1 ? undefined : args[outIndex + 1];
  const files =
    filesIndex === -1 ? [] : args.slice(filesIndex + 1).filter((arg) => !arg.startsWith("--"));

  if (outPath === undefined || outPath.startsWith("--")) {
    throw new Error("capture needs --out <file>");
  }

  if (files.length === 0) {
    throw new Error("capture needs --files <path> ...");
  }

  return { outPath: path.resolve(outPath), files: files.map((file) => path.resolve(file)) };
}

function runDiff(args) {
  if (args.length !== 2) {
    throw new Error("diff needs <baseline> <capture>");
  }

  const [baselinePath, capturePath] = args;

  if (!reportDiff(diffCorpus(readCorpus(baselinePath), readCorpus(capturePath)))) {
    process.exitCode = 1;
  }
}

function main() {
  const [verb, ...args] = process.argv.slice(2);

  if (verb === "capture") {
    const { outPath, files } = parseCaptureArgs(args);
    const entries = captureCorpus(outPath, files);

    process.stdout.write(`Captured ${entries.length} notify entries into ${outPath}.\n`);
    return;
  }

  if (verb === "diff") {
    runDiff(args);
    return;
  }

  throw new Error(
    "Usage: notify-corpus.mjs capture --out <file> --files <path> ... | diff <a> <b>",
  );
}

const invokedPath = process.argv[1] === undefined ? undefined : path.resolve(process.argv[1]);

if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
