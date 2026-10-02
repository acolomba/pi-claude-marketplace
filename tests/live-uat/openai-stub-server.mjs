// tests/live-uat/openai-stub-server.mjs
//
// Standalone operator-run UAT driver: an engineer invokes it from the command
// line and no module ever imports it, so being unreachable from the import
// graph is its intended shape, not a defect.
// fallow-ignore-file unused-file -- standalone operator-run UAT driver: an engineer invokes it from the command line and no module ever imports it, so being unreachable from the import graph is its intended shape, not a defect.
//
// Keyless OpenAI-compatible chat-completions stub for `stop-canary.mjs`
// (PIFL-07). Every request gets the assistant text `ready`, streaming or not,
// so a Pi turn needs no real provider and no key. Pi reaches it through a
// sandbox `models.json` provider whose `baseUrl` is
// `http://127.0.0.1:<STUB_PORT>/v1`; tests/live-uat/README.md shows both
// sandbox files.
//
// It listens on the loopback address only. Each request appends one JSON line
// to `STUB_HTTP_LOG`: time, URL, the `stream` flag and the requested tool
// names. Headers are never logged, so no key or token reaches the log.
//
// Env: `STUB_PORT` (default 18787), `STUB_HTTP_LOG` (default /dev/null).

import { appendFileSync } from "node:fs";
import { createServer } from "node:http";

const LOG = process.env.STUB_HTTP_LOG ?? "/dev/null";
const PORT = Number(process.env.STUB_PORT ?? 18787);
const HOST = "127.0.0.1";
const TEXT = "ready";
const USAGE = { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 };

function parseBody(body) {
  try {
    return JSON.parse(body || "{}");
  } catch {
    return {};
  }
}

function logRequest(req, parsed) {
  const tools = Array.isArray(parsed.tools) ? parsed.tools.map((t) => t?.function?.name) : [];
  const entry = { t: Date.now(), url: req.url, stream: parsed.stream, tools };
  appendFileSync(LOG, `${JSON.stringify(entry)}\n`);
}

function sendStream(res, model) {
  const base = { id: "stub", object: "chat.completion.chunk", created: 0, model };
  const content = {
    ...base,
    choices: [{ index: 0, delta: { role: "assistant", content: TEXT }, finish_reason: null }],
  };
  const stop = {
    ...base,
    choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
    usage: USAGE,
  };
  res.writeHead(200, { "content-type": "text/event-stream" });
  res.write(`data: ${JSON.stringify(content)}\n\n`);
  res.write(`data: ${JSON.stringify(stop)}\n\n`);
  res.end("data: [DONE]\n\n");
}

function sendCompletion(res, model) {
  const completion = {
    id: "stub",
    object: "chat.completion",
    created: 0,
    model,
    choices: [{ index: 0, message: { role: "assistant", content: TEXT }, finish_reason: "stop" }],
    usage: USAGE,
  };
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(completion));
}

createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", () => {
    const parsed = parseBody(body);
    logRequest(req, parsed);
    const model = parsed.model ?? "stub";
    if (parsed.stream) {
      sendStream(res, model);
      return;
    }
    sendCompletion(res, model);
  });
}).listen(PORT, HOST, () => {
  console.log(`openai-stub listening on http://${HOST}:${PORT}/v1`);
});
