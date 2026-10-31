// Spike: run a scripted faux-model turn in an installed spike028 sandbox.
// Usage: node faux.ts <sandbox-base> <out.json> <script.json> <prompt>
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { outputs, startPi } from "./driver.ts";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.resolve(HERE, "../../..");
const PEERS = path.join(REPO, "node_modules/.cache/optional-peers/node_modules");
const [base, outFile, script, ...prompts] = process.argv.slice(2);
const sandbox = { home: path.join(base, "home"), agentDir: path.join(base, "home/.pi/agent"), cwd: path.join(base, "project") };
const extras = [path.join(HERE, "faux-extension.ts"), path.join(HERE, "probe-extension.ts"), path.join(PEERS, "pi-subagents/index.js"), path.join(PEERS, "pi-mcp-adapter/index.ts")];
if (process.env.SPIKE_ENGINE) extras.push(process.env.SPIKE_ENGINE);
for (const f of ["faux-calls.log", "hook-marks.log", "mcp-stub.log"]) await writeFile(path.join(sandbox.home, f), "");
const pi = startPi(sandbox, extras, { SPIKE_FAUX_SCRIPT: path.resolve(HERE, script) });
await new Promise((r) => setTimeout(r, 1500));
const report: Record<string, unknown> = {};
report.setModel = (await pi.request({ type: "set_model", provider: "faux", modelId: "faux-1" })).response;
for (const p of prompts) {
  const start = pi.records.length;
  const { response } = await pi.request({ type: "prompt", message: p }, 90_000).catch((e) => ({ response: { error: String(e) } as any }));
  // wait for agent_end
  const t0 = Date.now();
  while (Date.now() - t0 < Number(process.env.SPIKE_WAIT_MS ?? 20_000) && !pi.records.slice(start).some((r) => r.type === "agent_end")) await new Promise((r) => setTimeout(r, 200));
  await new Promise((r) => setTimeout(r, Number(process.env.SPIKE_SETTLE_MS ?? 1500)));
  const slice = pi.records.slice(start);
  report[p] = {
    response: { success: response.success, error: response.error },
    ...outputs(slice),
    toolEvents: slice.filter((r) => r.type?.startsWith("tool_execution")).map((r) => ({ type: r.type, tool: r.toolName, args: r.args, result: r.result ? JSON.stringify(r.result).slice(0, 1500) : undefined, isError: r.isError })),
    types: [...new Set(slice.map((r) => r.type))],
  };
}
report.stderr = pi.stderr().slice(-3000);
await pi.stop();
await new Promise((r) => setTimeout(r, 800));
const lines = async (f: string) => (await readFile(path.join(sandbox.home, f), "utf8").catch(() => "")).split("\n").filter(Boolean).map((l) => JSON.parse(l));
report.fauxCalls = await lines("faux-calls.log");
report.hookMarks = (await lines("hook-marks.log")).map((h: any) => ({ event: h.event, tool: h.stdin?.tool_name, input: h.stdin?.tool_input, response: h.stdin?.tool_response ? JSON.stringify(h.stdin.tool_response).slice(0, 300) : undefined, prompt: h.stdin?.prompt }));
report.mcpStubLog = await lines("mcp-stub.log");
await writeFile(path.join(HERE, outFile), JSON.stringify(report, null, 2));
console.log("wrote", outFile);
