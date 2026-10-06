// The static checks are independent, so running them at once takes about as long as the slowest one.
// A passing step prints only its status line, except in CI (`CI` not empty), where its output follows.
import { spawn } from "node:child_process";
import { once } from "node:events";

async function runScript(script) {
  const startedAt = process.hrtime.bigint();
  const chunks = [];
  const child = spawn("npm", ["run", "--silent", script], { stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", (chunk) => chunks.push(chunk));
  child.stderr.on("data", (chunk) => chunks.push(chunk));
  const [code, signal] = await once(child, "close");

  return {
    script,
    passed: code === 0 && signal === null,
    seconds: Number(process.hrtime.bigint() - startedAt) / 1e9,
    output: Buffer.concat(chunks).toString("utf8"),
  };
}

async function main() {
  const scripts = process.argv.slice(2);

  if (scripts.length === 0) {
    process.stderr.write("Pass one or more npm script names.\n");
    process.exitCode = 1;
    return;
  }

  const results = await Promise.all(scripts.map((script) => runScript(script)));

  for (const result of results) {
    const status = result.passed ? "passed" : "failed";
    process.stdout.write(`${status} ${result.script} (${result.seconds.toFixed(1)} s)\n`);

    if (!result.passed || (process.env.CI && result.output !== "")) {
      process.stdout.write(result.output.endsWith("\n") ? result.output : `${result.output}\n`);
    }

    if (!result.passed) {
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
