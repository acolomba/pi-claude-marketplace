// Bounded closeout evidence. No imports from the three retiring tools.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readlinkSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
process.chdir(ROOT);
const PHASE = ".planning/phases/07-mode-refusals-real-pi-verification-and-docs/";
const BASE = ".planning/phases/01-presentation-model/notify-corpus/";
const ORIGINAL = "64bcfa027530b55319446ea781facab229df92cd";
const TOOLS = ["scripts/notify-corpus.mjs", "scripts/notify-corpus.hook.mjs", "scripts/notify-corpus.negative.mjs"];
const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const read = (path) => readFileSync(path, "utf8");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const parse = (text) => text.trimEnd().split("\n").map(JSON.parse);
const key = ({ file, message, severity, argc }) => JSON.stringify([file, message, severity, argc]);
const tuple = { file: "tests/edge/handlers/plugin/browse.test.ts", message: "Browse is unavailable in print mode. Use /claude:plugin list instead.", severity: "error", argc: 2 };
const testName = "refuses browse in print with only the error and remedy before state or picker access";

function multiset(entries) {
  const counts = new Map();
  for (const entry of entries) counts.set(key(entry), (counts.get(key(entry)) ?? 0) + 1);
  return [...counts].sort(([a], [b]) => a.localeCompare(b));
}

function assertAmendment(original, candidate, additions) {
  assert.deepStrictEqual(additions, [{ tuple, count: 1, test: testName,
    path: "makeBrowseHandler -> notifyUsageError -> emitPresentation -> deliver -> ctx.ui.notify",
    justification: "D-01/D-14: the new print browse refusal, emitted once by its exact owner test." }]);
  const expected = [...original, ...additions.flatMap((item) => Array(item.count).fill(item.tuple))];
  assert.deepStrictEqual(multiset(candidate), multiset(expected), "candidate must equal original plus exact authorized additions");
}

function catalog() {
  const fences = (text) => [...text.matchAll(/^```[^\n]*\n[\s\S]*?^```[^\n]*(?:\n|$)/gm)].map(([block]) => block);
  const current = read("docs/output-catalog.md");
  const old = git("show", "26cb0056:docs/output-catalog.md");
  assert.deepStrictEqual(fences(current), fences(old), "complete catalog fences changed");
  assert.equal(fences(current).length, 264);
  const owner = "tests/architecture/catalog-uat/catalog-contract.test.ts";
  assert.equal(read(owner), git("show", `${ORIGINAL}:${owner}`), "catalog owner/locks changed");
  assert.match(read(owner), /const EXPECTED_STATE_COUNT = 260;/);
  assert.match(read(owner), /const EXPECTED_UTF8_BYTES = 39_143;/);
}

// Hash actual file bytes, including every tracked non-planning input and all
// untracked nonignored files outside planning. Evidence paths never hash themselves.
function fingerprint(retired = false) {
  const paths = [...new Set(git("ls-files", "-z", "--cached", "--others", "--exclude-standard").split("\0").filter(Boolean))]
    .filter((path) => !path.startsWith(".planning/") && !(retired && TOOLS.includes(path))).sort();
  const files = Object.fromEntries(paths.map((path) => [path, hash(lstatSync(path).isSymbolicLink()
    ? `symlink:${readlinkSync(path)}` : readFileSync(path))]));
  const installed = ["node_modules/.package-lock.json", "tests/e2e/pi-peer-floor/node_modules/.package-lock.json",
    "node_modules/@earendil-works/pi-coding-agent/package.json", "node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js",
    "tests/e2e/pi-peer-floor/node_modules/@earendil-works/pi-coding-agent/package.json",
    "tests/e2e/pi-peer-floor/node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js"];
  for (const path of installed) files[path] = hash(readFileSync(path));
  return { node: process.version, nodeSha256: hash(readFileSync(process.execPath)), files };
}

function assertFingerprint(expected, retired = false) {
  const adjusted = structuredClone(expected);
  if (retired) for (const path of TOOLS) delete adjusted.files[path];
  assert.deepStrictEqual(fingerprint(retired), adjusted, "stale concrete input fingerprint");
}

function completion(report) {
  const count = (name) => {
    const matches = [...report.matchAll(new RegExp(`^(?:ℹ |# )${name} (\\d+)$`, "gm"))];
    assert.equal(matches.length, 1, `one ${name} completion count required`);
    return Number(matches[0][1]);
  };
  const tests = count("tests");
  assert.ok(tests > 0);
  assert.equal(count("pass") + count("skipped"), tests);
  for (const name of ["fail", "cancelled", "todo"]) assert.equal(count(name), 0);
  // Existing optional companion integration case, not a refusal/runtime case.
  assert.equal(count("skipped"), 1);
  const skipped = report.split("\n").filter((line) => line.startsWith("﹣"));
  assert.equal(skipped.length, 1);
  assert.match(skipped[0], /^﹣ SC-2 \/ AGSK-06: emitted skillPath resolves the staged skill via pi-subagents' resolveSkillsWithFallback and stays out of the global catalog \([\d.]+ms\) # pi-subagents resolver module not reachable in this environment$/);
  return tests;
}

function ledger(retired = false) {
  const document = read(`${PHASE}07-CORPUS-ADDITIONS.md`);
  const blocks = [...document.matchAll(/```json\n([\s\S]*?)\n```/g)];
  assert.equal(blocks.length, 1);
  const record = JSON.parse(blocks[0][1]);
  assert.equal(record.originalCommit, ORIGINAL);
  const originalText = git("show", `${ORIGINAL}:${BASE}baseline.jsonl`);
  const original = parse(originalText);
  assert.equal(original.length, 3149);
  const candidateText = read(`${PHASE}07-CORPUS-CAPTURE.jsonl`);
  const candidate = parse(candidateText);
  assertAmendment(original, candidate, record.additions);
  assert.equal(record.originalSha256, hash(originalText));
  assert.equal(record.captureSha256, hash(candidateText));
  assert.equal(record.oldTotal, original.length);
  assert.equal(record.newTotal, candidate.length);
  assert.equal(record.node, process.version);
  assert.deepStrictEqual(record.perFile, [{ file: tuple.file, before: 3, added: 1, after: 4 }]);
  const evidence = JSON.parse(read(`${PHASE}07-CORPUS-CAPTURE-EVIDENCE.json`));
  assert.equal(evidence.exitStatus, 0);
  assert.equal(evidence.command, `TEST_CONCURRENCY=4 node scripts/notify-corpus.mjs capture --out ${PHASE}07-CORPUS-CAPTURE.jsonl`);
  assert.equal(evidence.head, record.head);
  assert.equal(evidence.node, process.version);
  assert.equal(evidence.reportSha256, hash(evidence.report));
  assert.equal(evidence.captureSha256, hash(candidateText));
  completion(evidence.report);
  assert.match(evidence.report, /\nCaptured 3150 notify entries into .*\/07-CORPUS-CAPTURE\.jsonl\.\n$/);
  assertFingerprint(evidence.inputs, retired);
  const packageScripts = JSON.parse(read("package.json")).scripts;
  assert.deepStrictEqual(evidence.selection, [packageScripts.test, packageScripts["test:integration"]]);
  assert.ok(read(tuple.file).includes(testName));
  assert.ok(read(tuple.file).includes(tuple.message));
  catalog();
  return { originalText, original, record, expected: [...original, ...record.additions.flatMap((item) => Array(item.count).fill(item.tuple))] };
}

function final(retired = false) {
  const { originalText, record, expected } = ledger(retired);
  const amendedText = read(`${BASE}baseline.jsonl`);
  const appended = record.additions.flatMap((item) => Array(item.count).fill(JSON.stringify(item.tuple))).join("\n") + "\n";
  assert.equal(amendedText, originalText + appended, "original serialized lines/order must survive byte-for-byte");
  assert.deepStrictEqual(multiset(parse(amendedText)), multiset(expected));
  const oldMeta = JSON.parse(git("show", `${ORIGINAL}:${BASE}meta.json`));
  assert.deepStrictEqual(JSON.parse(read(`${BASE}meta.json`)), { ...oldMeta, entries: expected.length,
    files: new Set(expected.map((entry) => entry.file)).size,
    argcOne: expected.filter((entry) => entry.argc === 1).length,
    argcTwo: expected.filter((entry) => entry.argc === 2).length });
  const proof = JSON.parse(read(`${PHASE}07-CORPUS-FINAL.json`));
  assert.equal(proof.command, "TEST_CONCURRENCY=4 node scripts/notify-corpus.mjs check");
  assert.equal(proof.exitStatus, 0);
  assert.equal(proof.node, process.version);
  git("merge-base", "--is-ancestor", proof.head, "HEAD");
  assert.equal(proof.baselineSha256, hash(amendedText));
  assert.equal(proof.reportSha256, hash(proof.report));
  if (existsSync(`${PHASE}07-CORPUS-FINAL.log`)) assert.equal(read(`${PHASE}07-CORPUS-FINAL.log`), proof.report);
  assert.equal(completion(proof.report), completion(JSON.parse(read(`${PHASE}07-CORPUS-CAPTURE-EVIDENCE.json`)).report));
  assert.ok(proof.report.endsWith(`Notify corpus check passed: ${expected.length} baseline entries present, 0 extra.\n`));
  assert.doesNotMatch(proof.report, /^(?:missing in |extra in |refused: |Notify corpus check failed)/m);
  assertFingerprint(proof.inputs, retired);
}

function selfTest() {
  const original = [{ file: "tests/old.test.ts", message: "old", severity: null, argc: 1 }];
  const additions = [{ tuple, count: 1, test: testName,
    path: "makeBrowseHandler -> notifyUsageError -> emitPresentation -> deliver -> ctx.ui.notify",
    justification: "D-01/D-14: the new print browse refusal, emitted once by its exact owner test." }];
  const good = [...original, tuple];
  assertAmendment(original, good, additions);
  const bad = [
    [tuple], [{ ...original[0], message: "replacement" }, tuple],
    [original[0], { ...tuple, argc: 1 }], [original[0], { ...tuple, severity: "warning" }],
    [...good, { ...tuple, file: "tests/unrelated.test.ts" }], [...good, tuple],
  ];
  for (const candidate of bad) assert.throws(() => assertAmendment(original, candidate, additions));
  assert.throws(() => assertAmendment(original, [...good, tuple], [{ ...additions[0], count: 2 }]));
  console.log("PASS: positive amendment and seven negative controls");
}

const mode = process.argv[2];
if (mode === "--self-test") selfTest();
else if (mode === "--fingerprint") console.log(JSON.stringify(fingerprint()));
else if (mode === "--ledger") { ledger(); console.log("PASS: exact original plus authorized ledger; catalog fences and locks"); }
else if (mode === "--final") { final(); console.log("PASS: fresh strict zero-extra comparison and concrete input identity"); }
else if (mode === "--retired") {
  for (const path of TOOLS) assert.equal(existsSync(path), false, `${path} survives`);
  final(true);
  let checked = 0;
  for (const path of git("ls-files", "-z").split("\0").filter(Boolean)) {
    if (path.startsWith(".planning/") || TOOLS.includes(path)) continue;
    if (lstatSync(path).isSymbolicLink() && !statSync(path).isFile()) continue;
    assert.doesNotMatch(read(path), /notify-corpus(?:\.hook|\.negative)?\.mjs/, `retired reference in ${path}`);
    checked++;
  }
  console.log(`PASS: exactly three tools retired; ${checked} remaining tracked files read; behavior inputs unchanged`);
} else throw new Error("Expected --self-test, --ledger, --final, --retired, or --fingerprint");
