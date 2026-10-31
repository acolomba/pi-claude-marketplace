// Spike 028 harness: install kit@fixtures in a model-free RPC Pi with every
// companion loaded, reload, and dump what each host surface reports.
// Usage: node run.ts [--no-companions]   -> writes results[-nocomp].json
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { outputs, startPi } from "./driver.ts";
import { writeMarketplace } from "./fixture.ts";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.resolve(HERE, "../../..");
const PEERS = path.join(REPO, "node_modules/.cache/optional-peers/node_modules");
const ENGINE = process.env.SPIKE_ENGINE ?? "";
const noComp = process.argv.includes("--no-companions");
const extras = [path.join(HERE, "probe-extension.ts")];
if (!noComp) {
  extras.push(path.join(PEERS, "pi-subagents/index.js"), path.join(PEERS, "pi-mcp-adapter/index.ts"));
  if (ENGINE) extras.push(ENGINE);
}

const base = await mkdtemp(path.join(tmpdir(), "spike028-"));
const sandbox = { home: path.join(base, "home"), agentDir: path.join(base, "home/.pi/agent"), cwd: path.join(base, "project") };
const { mkdir } = await import("node:fs/promises");
for (const d of Object.values(sandbox)) await mkdir(d, { recursive: true });
const market = path.join(base, "market");
await writeMarketplace(market);
const env = { SPIKE_PROBE_CHANNELS: process.env.SPIKE_PROBE_CHANNELS ?? "" };

const report: Record<string, unknown> = { base, extras };
const cmd = async (pi: ReturnType<typeof startPi>, message: string) => {
  const { response, between } = await pi.request({ type: "prompt", message }, 120_000);
  return { response: { success: response.success, error: response.error }, ...outputs(between) };
};
const readMaybe = async (f: string) => readFile(f, "utf8").catch((e) => `<${e.code}>`);
async function tree(dir: string, depth = 4): Promise<string[]> {
  const out: string[] = [];
  async function walk(d: string, n: number) {
    if (n < 0) return;
    for (const e of await readdir(d, { withFileTypes: true }).catch(() => [])) {
      const p = path.join(d, e.name);
      if (e.name === "node_modules" || e.name === ".git") continue;
      out.push(path.relative(sandbox.home, p) + (e.isDirectory() ? "/" : ""));
      if (e.isDirectory()) await walk(p, n - 1);
    }
  }
  await walk(dir, depth);
  return out;
}

// Pi #1: install
let pi = startPi(sandbox, extras, env);
report.commandsBefore = (await pi.request({ type: "get_commands" })).response.data?.commands?.map((c: any) => `${c.source}:${c.name}`);
report.mpAdd = await cmd(pi, `/claude:plugin marketplace add ${market} --scope user`);
report.install = await cmd(pi, `/claude:plugin install kit@fixtures --scope user`);
// in-process reload candidate: new_session
const ns = await pi.request({ type: "new_session" });
report.newSession = { success: ns.response.success, ...outputs(ns.between) };
report.commandsAfterNewSession = (await pi.request({ type: "get_commands" })).response.data?.commands?.filter((c: any) => c.source !== "extension" || /kit|greet|demo|reviewer/.test(c.name)).map((c: any) => `${c.source}:${c.name}`);
report.stderr1 = pi.stderr().slice(-3000);
await pi.stop();

// Pi #2: fresh process == /reload
pi = startPi(sandbox, extras, env);
await new Promise((r) => setTimeout(r, 1500));
report.startupOutputs = outputs(pi.records);
const gc = await pi.request({ type: "get_commands" });
report.commandsAfterRestart = gc.response.data?.commands?.map((c: any) => ({ source: c.source, name: c.name, description: c.description, path: c.sourceInfo?.path }));
const probe = await pi.request({ type: "prompt", message: "/spike-probe" });
report.probe = outputs(probe.between).entries;
report.info = await cmd(pi, "/claude:plugin info kit@fixtures");
const prompt = await pi.request({ type: "prompt", message: "hello there" }, 30_000).catch((e) => ({ response: { error: String(e) }, between: [] as any[] }));
report.plainPrompt = { response: prompt.response, ...outputs(prompt.between) };
await new Promise((r) => setTimeout(r, 1500));
report.stderr2 = pi.stderr().slice(-3000);
await pi.stop();
await new Promise((r) => setTimeout(r, 1000));

report.hookMarks = (await readMaybe(path.join(sandbox.home, "hook-marks.log"))).split("\n").filter(Boolean);
report.mcpStubLog = (await readMaybe(path.join(sandbox.home, "mcp-stub.log"))).split("\n").filter(Boolean);
report.mcpAdapterJson = await readMaybe(path.join(sandbox.agentDir, "mcp-adapter.json"));
report.homeTree = await tree(sandbox.home, 6);
const out = path.join(HERE, noComp ? "results-nocomp.json" : "results.json");
await writeFile(out, JSON.stringify(report, null, 2));
console.log("wrote", out, "sandbox", base);
