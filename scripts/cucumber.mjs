// Runs cucumber-js with one worker per available CPU, at most 8. Each worker
// starts Pi processes, so more workers than CPUs make deadline-bound scenarios
// time out: CI's 4-CPU runner ran 8 workers. The other arguments pass through.
import { spawn } from "node:child_process";
import { once } from "node:events";
import { availableParallelism } from "node:os";

const MAX_WORKERS = 8;

const workers = Math.min(MAX_WORKERS, availableParallelism());
const child = spawn("cucumber-js", ["--parallel", String(workers), ...process.argv.slice(2)], {
  stdio: "inherit",
});
const [code, signal] = await once(child, "close");
process.exitCode = signal === null ? code : 1;
