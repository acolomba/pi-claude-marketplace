// tests/live-uat/openai-stub-server.mjs
//
// Standalone operator-run UAT driver: an engineer invokes it from the command
// line and no module ever imports it, so being unreachable from the import
// graph is its intended shape, not a defect.
// fallow-ignore-file unused-file -- standalone operator-run UAT driver: an engineer invokes it from the command line and no module ever imports it, so being unreachable from the import graph is its intended shape, not a defect.
//
// Keyless OpenAI-compatible chat-completions stub for `stop-canary.mjs`
// (PIFL-07) and `mcp-adapter-canary.mjs` (ADOC-02). Without a script, every
// request gets the assistant text `ready`, streaming or not, so a Pi turn
// needs no real provider and no key. Pi reaches it through a
// sandbox `models.json` provider whose `baseUrl` is
// `http://127.0.0.1:<STUB_PORT>/v1`; tests/live-uat/README.md shows both
// sandbox files.
//
// It listens on the loopback address only. Each request appends one JSON line
// to `STUB_HTTP_LOG`: time, URL, the `stream` flag and the requested tool
// names. Headers are never logged, so no key or token reaches the log.
//
// Env: `STUB_PORT` (default 18787), `STUB_HTTP_LOG` (default /dev/null),
// `STUB_SCRIPT` (unset by default). `STUB_PORT=0` binds a free port, and the
// startup line names the port it bound.
//
// `STUB_SCRIPT` names a JSON file that maps a marker string to an ordered list
// of `{ "tool": <name>, "arguments": <object> }` steps. For each request the
// stub takes the text of the last `role: "user"` message (a string `content`,
// or the `text` parts of an array `content` joined) and picks the first
// script whose marker that text contains. The step it replays is the one whose
// index is the number of `role: "tool"` messages after that user message. A
// step present means one tool call. No script, or a step past its end, means
// the text `ready` as above. An unreadable or malformed file stops the stub.

import { appendFileSync, readFileSync } from "node:fs";
import { createServer } from "node:http";

const LOG = process.env.STUB_HTTP_LOG ?? "/dev/null";
const PORT = Number(process.env.STUB_PORT ?? 18787);
const HOST = "127.0.0.1";
const TEXT = "ready";
const USAGE = { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 };
const SCRIPTS = loadScripts(process.env.STUB_SCRIPT);

/** Reads `STUB_SCRIPT` once; a file that does not parse to marker -> steps exits non-zero. */
function loadScripts(file) {
  if (file === undefined || file === "") {
    return {};
  }

  try {
    const scripts = JSON.parse(readFileSync(file, "utf8"));
    const valid =
      typeof scripts === "object" &&
      scripts !== null &&
      Object.values(scripts).every((steps) => Array.isArray(steps));
    if (!valid) {
      throw new Error("expected an object that maps each marker to a list of steps");
    }

    return scripts;
  } catch (error) {
    console.error(`openai-stub: STUB_SCRIPT ${file} is unusable: ${error.message}`);
    process.exit(1);
  }
}

function userText(content) {
  if (typeof content === "string") {
    return content;
  }

  const parts = Array.isArray(content) ? content : [];
  return parts
    .filter((part) => part?.type === "text")
    .map((part) => part.text)
    .join("\n");
}

/** The scripted step for this request, or undefined for the default `ready` reply. */
function scriptedStep(messages) {
  const userAt = messages.findLastIndex((message) => message?.role === "user");
  if (userAt === -1) {
    return undefined;
  }

  const text = userText(messages[userAt].content);
  const marker = Object.keys(SCRIPTS).find((key) => text.includes(key));
  if (marker === undefined) {
    return undefined;
  }

  const index = messages.slice(userAt + 1).filter((message) => message?.role === "tool").length;
  const step = SCRIPTS[marker][index];
  return step === undefined ? undefined : { ...step, index };
}

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

/** Answers with one call to `step.tool` and `finish_reason: "tool_calls"`. */
function sendToolCall(res, model, step, streaming) {
  const call = {
    id: `call_${step.index}`,
    type: "function",
    function: { name: step.tool, arguments: JSON.stringify(step.arguments ?? {}) },
  };
  if (!streaming) {
    const message = { role: "assistant", content: null, tool_calls: [call] };
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        id: "stub",
        object: "chat.completion",
        created: 0,
        model,
        choices: [{ index: 0, message, finish_reason: "tool_calls" }],
        usage: USAGE,
      }),
    );
    return;
  }

  const event = (choice, extra) =>
    `data: ${JSON.stringify({ id: "stub", object: "chat.completion.chunk", created: 0, model, choices: [choice], ...extra })}\n\n`;
  const delta = { role: "assistant", tool_calls: [{ index: 0, ...call }] };
  res.writeHead(200, { "content-type": "text/event-stream" });
  res.write(event({ index: 0, delta, finish_reason: null }));
  res.write(event({ index: 0, delta: {}, finish_reason: "tool_calls" }, { usage: USAGE }));
  res.end("data: [DONE]\n\n");
}

const server = createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", () => {
    const parsed = parseBody(body);
    logRequest(req, parsed);
    const model = parsed.model ?? "stub";
    const step = scriptedStep(Array.isArray(parsed.messages) ? parsed.messages : []);
    if (step !== undefined) {
      sendToolCall(res, model, step, Boolean(parsed.stream));
      return;
    }

    if (parsed.stream) {
      sendStream(res, model);
      return;
    }
    sendCompletion(res, model);
  });
});
server.listen(PORT, HOST, () => {
  console.log(`openai-stub listening on http://${HOST}:${server.address().port}/v1`);
});
