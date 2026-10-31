// Interactive RPC driver for the spike: one Pi child, one request at a time,
// every stdout record kept. Reuses the e2e allowlist environment and argv.
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

import { killProcessGroup, piArguments, rpcChildEnvironment } from "../../../test/e2e/_rpc.ts";

import type { RpcSandbox } from "../../../test/e2e/_rpc.ts";

export type Rec = Record<string, any>;

export interface Pi {
  request(body: Rec, timeoutMs?: number): Promise<{ response: Rec; between: Rec[] }>;
  records: Rec[];
  stderr(): string;
  stop(): Promise<void>;
}

export function startPi(sandbox: RpcSandbox, extra: string[], env: Rec = {}): Pi {
  const child = spawn(process.execPath, piArguments("rpc", extra), {
    cwd: sandbox.cwd,
    env: { ...rpcChildEnvironment(sandbox), ...env },
    detached: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.setEncoding("utf8").on("data", (c: string) => (stderr += c));
  const records: Rec[] = [];
  const waiters = new Map<string, (r: Rec) => void>();
  createInterface({ input: child.stdout }).on("line", (line) => {
    let r: Rec;
    try {
      r = JSON.parse(line);
    } catch {
      return;
    }
    records.push(r);
    if (r.type === "extension_ui_request" && ["select", "confirm", "input", "editor"].includes(r.method)) {
      child.stdin.write(JSON.stringify({ type: "extension_ui_response", id: r.id, cancelled: true }) + "\n");
    }
    if (r.type === "response" && typeof r.id === "string") waiters.get(r.id)?.(r);
  });
  let n = 0;
  return {
    records,
    stderr: () => stderr,
    request(body, timeoutMs = 60_000) {
      const id = `s${++n}`;
      const start = records.length;
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`timeout on ${JSON.stringify(body)}\n${stderr}`)), timeoutMs);
        waiters.set(id, (response) => {
          clearTimeout(t);
          resolve({ response, between: records.slice(start) });
        });
        child.stdin.write(JSON.stringify({ ...body, id }) + "\n");
      });
    },
    async stop() {
      child.stdin.end();
      await new Promise((r) => setTimeout(r, 300));
      killProcessGroup(child);
    },
  };
}

/** Custom entries and notifies inside a slice of records. */
export function outputs(between: Rec[]): { entries: Rec[]; notifies: string[]; errors: string[] } {
  return {
    entries: between.filter((r) => r.type === "entry_appended" && r.entry?.type === "custom").map((r) => ({ customType: r.entry.customType, data: r.entry.data })),
    notifies: between.filter((r) => r.type === "extension_ui_request" && r.method === "notify").map((r) => r.message),
    errors: between.filter((r) => r.type === "extension_error").map((r) => r.error),
  };
}
