// fallow-ignore-file unused-file -- operator-run negative controls for notify-corpus.mjs (D-04): an engineer runs it from the command line and no npm script or module imports it.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { diffCorpus, parseCorpus, serializeCorpus } from "./notify-corpus.mjs";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const toolPath = fileURLToPath(new URL("notify-corpus.mjs", import.meta.url));
const hookUrl = new URL("notify-corpus.hook.mjs", import.meta.url).href;
const fixtureRoot = await mkdtemp(path.join(tmpdir(), "notify-corpus-negative-"));
const baselinePath = path.join(fixtureRoot, "baseline.jsonl");
const scratchPath = path.join(fixtureRoot, "scratch.jsonl");
const endToEndTest = "tests/edge/handlers/plugin/help.test.ts";

// Listed in the order serializeCorpus writes, so a round trip compares equal.
const plantedCorpus = [
  { file: "tests/a.test.ts", message: "Error: beta failed", severity: "error", argc: 2 },
  { file: "tests/a.test.ts", message: "● alpha [user] (installed)", severity: null, argc: 1 },
  { file: "tests/a.test.ts", message: "● alpha [user] (installed)", severity: null, argc: 1 },
  { file: "tests/b.test.ts", message: "delta", severity: "info", argc: 2 },
  { file: "tests/b.test.ts", message: "gamma", severity: "warning", argc: 2 },
];

function runTool(args) {
  return spawnSync(process.execPath, [toolPath, ...args], {
    cwd: projectRoot,
    encoding: "utf8",
  });
}

function jsonLines(entries) {
  return entries.map((entry) => `${JSON.stringify(entry)}\n`).join("");
}

try {
  const serialized = serializeCorpus(plantedCorpus);

  // The committed form is printable ASCII lines only and parses back to the same entries.
  assert.equal(/[^ -~\n]/.test(serialized), false);
  assert.deepStrictEqual(parseCorpus(serialized), plantedCorpus);
  await writeFile(baselinePath, serialized);

  const baseline = parseCorpus(await readFile(baselinePath, "utf8"));

  // Control 1: a one-byte drift in one message is a missing entry, named by its file.
  const drifted = baseline.map((entry) =>
    entry.message === "Error: beta failed" ? { ...entry, message: "Error: beta failet" } : entry,
  );

  assert.deepStrictEqual(diffCorpus(baseline, drifted).missing, [
    {
      file: "tests/a.test.ts",
      message: "Error: beta failed",
      severity: "error",
      argc: 2,
      count: 1,
    },
  ]);
  await writeFile(scratchPath, jsonLines(drifted));

  const driftRun = runTool(["diff", baselinePath, scratchPath]);

  assert.equal(driftRun.status, 1);
  assert.match(driftRun.stderr, /^missing in tests\/a\.test\.ts: /m);

  // Control 2: a capture with fewer entries than the baseline is refused.
  await writeFile(
    scratchPath,
    jsonLines(baseline.filter((entry) => entry.file !== "tests/b.test.ts")),
  );

  const shrunkRun = runTool(["diff", baselinePath, scratchPath]);

  assert.equal(shrunkRun.status, 1);
  assert.match(shrunkRun.stderr, /^refused: capture holds 3 entries, baseline holds 5$/m);

  // Control 3: reordering and one added entry pass, and the added entry is listed as extra.
  const added = { file: "tests/b.test.ts", message: "epsilon", severity: null, argc: 1 };
  const extended = [...baseline].reverse().concat(added);
  const extendedResult = diffCorpus(baseline, extended);

  assert.deepStrictEqual(extendedResult.missing, []);
  assert.deepStrictEqual(extendedResult.extra, [{ ...added, count: 1 }]);
  await writeFile(scratchPath, jsonLines(extended));

  const extendedRun = runTool(["diff", baselinePath, scratchPath]);

  assert.equal(extendedRun.status, 0, extendedRun.stderr);
  assert.match(extendedRun.stdout, /^extra in tests\/b\.test\.ts: "epsilon"/m);

  // Control 4: a real capture records at least one entry, so a hook that stops matching fails.
  const capturePath = path.join(fixtureRoot, "capture.jsonl");
  const captureRun = runTool(["capture", "--out", capturePath, "--files", endToEndTest]);

  assert.equal(captureRun.status, 0, captureRun.stderr);

  const captured = parseCorpus(await readFile(capturePath, "utf8"));

  assert.ok(captured.length >= 1, "the capture recorded no notify call");
  assert.ok(captured.every((entry) => entry.file === endToEndTest));

  // Control 5: `--files` ends at the next flag, so an existing `--out` file after it is
  // overwritten rather than run as a test file.
  const reorderedRun = runTool(["capture", "--files", endToEndTest, "--out", capturePath]);

  assert.equal(reorderedRun.status, 0, reorderedRun.stderr);
  assert.deepStrictEqual(parseCorpus(await readFile(capturePath, "utf8")), captured);

  // Control 6: the hook loads a bare `X.ui.notify(` receiver and refuses any other spelling.
  const plantedRoot = path.join(fixtureRoot, "extensions/pi-claude-marketplace");

  await mkdir(plantedRoot, { recursive: true });

  for (const { name, body, refused } of [
    { name: "bare", body: 'ctx.ui.notify("x");', refused: false },
    { name: "member", body: 'opts.ctx.ui.notify("x");', refused: true },
    { name: "destructured", body: 'const { ui } = ctx;\n  ui.notify("x");', refused: true },
  ]) {
    const plantedPath = path.join(plantedRoot, `${name}.ts`);

    await writeFile(plantedPath, `function emit(ctx, opts) {\n  ${body}\n}\n`);

    const loadRun = spawnSync(process.execPath, ["--import", hookUrl, plantedPath], {
      cwd: projectRoot,
      encoding: "utf8",
      env: { ...process.env, NOTIFY_CORPUS_OUT: fixtureRoot },
    });

    assert.equal(loadRun.status === 0, !refused, `${name}: ${loadRun.stderr}`);
    assert.equal(/notify-corpus: .* spells 1 ui\.notify\( calls/.test(loadRun.stderr), refused);
  }

  process.stdout.write("Notify corpus negative controls passed.\n");
} finally {
  await rm(fixtureRoot, { force: true, recursive: true });
}
