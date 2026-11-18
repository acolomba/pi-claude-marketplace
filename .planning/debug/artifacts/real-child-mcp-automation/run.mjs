import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { closeSync, openSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(artifactDir, "../../../..");
const root = await mkdtemp(path.join(tmpdir(), "pg1-live-companion-"));
const companion = process.env.PG_COMPANION_INDEX ?? path.join(repoDir, "node_modules/.cache/optional-peers/node_modules/pi-subagents/index.js");
const shortTool = "mcp__plugin_demo_stub__echo";
const longTool = "mcp__plugin_demo_a-server-whose-name-runs-well-past-the_a4df039c";
const cases = {
  "demo:runner": { expectedTools: [shortTool], echo: "pg1-live-short" },
  "demo:control": { requiredTools: [shortTool, longTool], echo: "pg1-live-long-control" },
  "demo:restricted": { requiredTools: [shortTool], forbiddenTools: [longTool], echo: "pg1-live-restricted" },
};
const selected = process.env.PG_AGENT ? [process.env.PG_AGENT] : Object.keys(cases);
for (const agent of selected) assert.ok(cases[agent], `Unknown PG_AGENT: ${agent}`);

await cp(path.join(artifactDir, "fixture/marketplace"), path.join(root, "marketplace"), { recursive: true });
await mkdir(path.join(root, "project"));
await mkdir(path.join(root, "server-home/harness"), { recursive: true });
await cp(path.join(artifactDir, "openai-stub-server.mjs"), path.join(root, "openai-stub-server.mjs"));

const mcpFile = path.join(root, "marketplace/plugins/demo/.mcp.json");
const mcp = (await readFile(mcpFile, "utf8"))
  .replaceAll("/tmp/pg1-live-fixed-local", root)
  .replaceAll("/home/acolomba/src/pi-claude-marketplace-gaps", repoDir)
  .replaceAll("/home/linuxbrew/.linuxbrew/bin/node", process.execPath);
await writeFile(mcpFile, mcp);

const driver = (await readFile(path.join(artifactDir, "driver.template.mjs"), "utf8"))
  .replaceAll("/tmp/pg1-live-fixed-local", root)
  .replaceAll("/home/acolomba/src/pi-claude-marketplace-gaps", repoDir)
  .replaceAll("/tmp/pi-subagents-mcp-fix/dist-pkg/index.js", companion);
const driverFile = path.join(root, "drive.mjs");
await writeFile(driverFile, driver);

const driverLog = path.join(root, "drive.out");
const logFd = openSync(driverLog, "w");
const child = spawn(process.execPath, [driverFile], {
  cwd: repoDir,
  env: { ...process.env, ...(process.env.PG_AGENT ? { PG_AGENT: process.env.PG_AGENT } : {}) },
  stdio: ["ignore", logFd, logFd],
});
const exitCode = await new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("exit", (code) => resolve(code));
});
closeSync(logFd);
console.log(`Fixture: ${root}`);
console.log(`Companion: ${companion}`);
console.log(`Driver log: ${driverLog}`);
assert.equal(exitCode, 0, "Detached-child driver failed");

const records = (await readFile(driverLog, "utf8")).split("\n").flatMap((line) => {
  const split = line.indexOf(" ");
  if (split < 0) return [];
  const tag = line.slice(0, split);
  if (tag !== "child_status" && tag !== "calls") return [];
  return [{ tag, ...JSON.parse(line.slice(split + 1)) }];
});
const requestLog = path.join(root, "server-home/harness/mcp-stub-requests.jsonl");
const serverCalls = (await readFile(requestLog, "utf8")).trim().split("\n").map(JSON.parse).filter((entry) => entry.method === "tools/call");
const summary = [];
for (const agent of selected) {
  const expected = cases[agent];
  const status = records.find((entry) => entry.tag === "child_status" && entry.agent === agent);
  const calls = records.find((entry) => entry.tag === "calls" && entry.agent === agent)?.calls ?? [];
  assert.equal(status?.state, "complete", `${agent} did not complete`);
  assert.ok(calls.length > 0, `${agent} had no provider request`);
  assert.ok(status.output?.includes(`echo:${expected.echo}`), `${agent} did not receive the echo`);
  for (const call of calls) {
    if (expected.expectedTools) assert.deepEqual(call.tools, expected.expectedTools, `${agent} exact tool inventory`);
    for (const name of expected.requiredTools ?? []) assert.ok(call.tools.includes(name), `${agent} missing ${name}`);
    for (const name of expected.forbiddenTools ?? []) assert.ok(!call.tools.includes(name), `${agent} exposed ${name}`);
  }
  assert.equal(serverCalls.filter((entry) => entry.params?.arguments?.text === expected.echo).length, 1, `${agent} MCP echo call count`);
  summary.push({ agent, pid: status.pid, asyncDir: status.asyncDir, inventories: calls.map((call) => call.tools), echo: expected.echo });
}
await writeFile(path.join(root, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
