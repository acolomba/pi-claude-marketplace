// Re-open an installed spike028 sandbox and drive companion commands model-free.
// Usage: node probe2.ts <sandbox-base> <out.json> <cmd>...
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { outputs, startPi } from "./driver.ts";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.resolve(HERE, "../../..");
const PEERS = path.join(REPO, "node_modules/.cache/optional-peers/node_modules");
const [base, outFile, ...cmds] = process.argv.slice(2);
const sandbox = { home: path.join(base, "home"), agentDir: path.join(base, "home/.pi/agent"), cwd: path.join(base, "project") };
const extras = [path.join(HERE, "probe-extension.ts"), path.join(PEERS, "pi-subagents/index.js"), path.join(PEERS, "pi-mcp-adapter/index.ts")];
if (process.env.SPIKE_ENGINE) extras.push(process.env.SPIKE_ENGINE);
const pi = startPi(sandbox, extras, { SPIKE_PROBE_CHANNELS: process.env.SPIKE_PROBE_CHANNELS ?? "" });
await new Promise((r) => setTimeout(r, 1500));
const report: Record<string, unknown> = { startup: outputs(pi.records) };
for (const c of cmds) {
  const body = c.startsWith("bash:") ? { type: "bash", command: c.slice(5) } : c.startsWith("rpc:") ? JSON.parse(c.slice(4)) : { type: "prompt", message: c };
  const { response, between } = await pi.request(body, 60_000).catch((e) => ({ response: { error: String(e) }, between: [] as any[] }));
  await new Promise((r) => setTimeout(r, Number(process.env.SPIKE_SETTLE_MS ?? 800)));
  const o = outputs(pi.records.slice(pi.records.indexOf(between[0] ?? response)));
  report[c] = { response: { success: response.success, error: response.error, data: response.data }, ...o, messages: pi.records.slice(pi.records.indexOf(between[0] ?? response)).filter((r) => r.type === "message_end" || r.type === "message_start").map((r) => r.message).filter(Boolean).map((m: any) => ({ role: m.role, customType: m.customType, content: typeof m.content === "string" ? m.content.slice(0, 1500) : m.content })) };
}
report.stderr = pi.stderr().slice(-3000);
await pi.stop();
await new Promise((r) => setTimeout(r, 800));
report.hookMarks = (await readFile(path.join(sandbox.home, "hook-marks.log"), "utf8").catch(() => "")).split("\n").filter(Boolean).map((l) => JSON.parse(l).event);
report.mcpStubLog = (await readFile(path.join(sandbox.home, "mcp-stub.log"), "utf8").catch(() => "")).split("\n").filter(Boolean);
await writeFile(path.join(HERE, outFile), JSON.stringify(report, null, 2));
console.log("wrote", outFile);
