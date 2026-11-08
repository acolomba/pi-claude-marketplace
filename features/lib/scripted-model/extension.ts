/**
 * @fileoverview The scripted model: a Pi extension that registers Pi's faux
 * provider and answers each model call with the next step of the scenario's
 * script (D-CF1-17, HAR-02).
 *
 * A profile Pi loads this file with `--extension`. Each call reads the script
 * from the harness directory of `$HOME`, takes the step whose index is the
 * line count of the call log, and appends the call to the log whole: the
 * system prompt, the tools, and every message. The model keeps no count in
 * memory, so a child agent's Pi, which shares the sandbox home, plays the
 * same script. A call past the end of the script is logged with
 * `overflow: true` and fails: there is no fallback reply. Two processes that
 * call at the same moment would read the same count and take the same step,
 * so a scenario must not make concurrent model calls.
 *
 * An error step ends its call with stop reason `error` and the step's message,
 * which the faux core streams as an error event (D-BG-06). A profile Pi turns
 * auto retry off, so one error step is one call. Pi reads some messages as a
 * context overflow (such as one that starts `prompt is too long`) or as
 * retryable, and starts its own recovery for them, which makes more calls; a
 * seed uses a message that is neither, such as `Authentication failed (401)`.
 * A reply step with stop reason `length` ends its call with that stop reason.
 *
 * A reply step with context tokens reports them as the usage of its own call
 * (D-BG-07). The faux core replaces the usage of every scripted message with
 * its own estimate, so the player carries the value on the message it returns,
 * a plain field the faux core's copies keep, and the provider's stream wraps
 * the faux stream: it removes the field from every event, and on the `done`
 * event it sets the usage to that many input tokens. The value rides on the
 * call's own message, so no state outlives the call and a child agent's Pi
 * cannot inherit it. Pi compacts on its own, with reason `threshold`, when the
 * context tokens of a reply exceed the context window minus `reserveTokens`:
 * 128000 - 16384 = 111616 for `faux-1`. Pi reads input above the context
 * window as an overflow instead.
 */

import { appendFile } from "node:fs/promises";

import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import {
  fauxAssistantMessage,
  createFauxCore,
  fauxText,
  fauxToolCall,
} from "@earendil-works/pi-ai/providers/faux";

import { harnessDirectory } from "../turn-records.ts";

import { modelCallsPath, readModelCalls, readModelScript } from "./script.ts";

import type { ModelCall } from "./script.ts";
import type {
  AssistantMessage,
  AssistantMessageEvent,
  AssistantMessageEventStream,
  Message,
  Tool,
  Usage,
} from "@earendil-works/pi-ai";
import type { FauxResponseFactory } from "@earendil-works/pi-ai/providers/faux";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// The text of a system message's content: a string, or text parts. Pi lays
// out its system messages itself, so content of any other shape fails the
// call loudly rather than log a prompt with a part missing.
function textOf(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    throw new TypeError(
      `scripted model: unreadable system message content ${JSON.stringify(content)}`,
    );
  }

  return content
    .map((part: unknown) => {
      if (
        typeof part !== "object" ||
        part === null ||
        !("text" in part) ||
        typeof part.text !== "string"
      ) {
        throw new TypeError(
          `scripted model: unreadable system message part ${JSON.stringify(part)}`,
        );
      }

      return part.text;
    })
    .join("");
}

// Pi carries the system prompt in system messages: the leading one holds the
// base prompt and its named sections, and a later one adds instructions or
// replaces or removes a section by name. The logged prompt replays them in
// order: every instruction text, then each section that is still present, in
// the order Pi set them, each part separated by a blank line. A section that
// is neither text nor removed fails the call, as above.
function systemPromptOf(messages: readonly Message[]): string {
  const systemMessages = messages.filter((message) => message.role === "system");
  if (systemMessages.length === 0) {
    return "";
  }

  const instructions: string[] = [];
  const sections = new Map<string, string>();
  for (const [index, message] of systemMessages.entries()) {
    const text = textOf(message.content);
    if (index === 0 || text !== "") {
      instructions.push(text);
    }

    const declared: [string, unknown][] = Object.entries(message.sections ?? {});
    for (const [name, section] of declared) {
      if (section === null) {
        sections.delete(name);
      } else if (typeof section === "string") {
        sections.set(name, section);
      } else {
        throw new TypeError(`scripted model: unreadable system prompt section ${name}`);
      }
    }
  }

  return [...instructions, ...sections.values()].join("\n\n");
}

function toolsOf(messages: readonly Message[]): ModelCall["tools"] {
  const tools = new Map<string, Tool>();
  for (const message of messages) {
    if (message.role !== "system") {
      continue;
    }

    for (const tool of message.toolsAdded ?? []) {
      tools.set(tool.name, tool);
    }

    for (const removed of message.toolsRemoved ?? []) {
      tools.delete(removed.name);
    }
  }

  return [...tools.values()].map(({ name, description, parameters }) => ({
    name,
    description,
    parameters,
  }));
}

// The field that carries a reply step's context tokens from the player to the
// provider's stream, on the message of that call only.
const CONTEXT_TOKENS_FIELD = "scriptedContextTokens";

function withContextTokens(message: AssistantMessage, tokens: number): AssistantMessage {
  const carried: AssistantMessage & Record<typeof CONTEXT_TOKENS_FIELD, number> = {
    ...message,
    [CONTEXT_TOKENS_FIELD]: tokens,
  };
  return carried;
}

// The message without the carrier field, and the context tokens it carried.
function takeContextTokens(message: AssistantMessage): [AssistantMessage, number | undefined] {
  if (!(CONTEXT_TOKENS_FIELD in message)) {
    return [message, undefined];
  }

  const { [CONTEXT_TOKENS_FIELD]: tokens, ...rest } = message;
  return [rest, typeof tokens === "number" ? tokens : undefined];
}

function contextUsage(tokens: number): Usage {
  return {
    input: tokens,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: tokens,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}

// The final message as Pi receives it: without the carrier, and with the
// usage of the context tokens it carried.
function settledMessage(message: AssistantMessage): AssistantMessage {
  const [rest, tokens] = takeContextTokens(message);
  return tokens === undefined ? rest : { ...rest, usage: contextUsage(tokens) };
}

function forwardedEvent(event: AssistantMessageEvent): AssistantMessageEvent {
  if (event.type === "done") {
    return { ...event, message: settledMessage(event.message) };
  }

  if (event.type === "error") {
    return { ...event, error: takeContextTokens(event.error)[0] };
  }

  return { ...event, partial: takeContextTokens(event.partial)[0] };
}

async function forwardEvents(
  inner: AssistantMessageEventStream,
  outer: AssistantMessageEventStream,
): Promise<void> {
  for await (const event of inner) {
    outer.push(forwardedEvent(event));
  }

  outer.end(settledMessage(await inner.result()));
}

// The faux stream of one call, with the usage its reply step reports.
function withContextUsage(inner: AssistantMessageEventStream): AssistantMessageEventStream {
  const outer = createAssistantMessageEventStream();
  void forwardEvents(inner, outer);
  return outer;
}

async function playNextStep(messages: readonly Message[]): Promise<AssistantMessage> {
  const harness = harnessDirectory(process.env.HOME ?? "");
  const [script, calls] = await Promise.all([readModelScript(harness), readModelCalls(harness)]);
  const index = calls.length;
  const step = script[index];
  const call: ModelCall = {
    index,
    overflow: step === undefined,
    systemPrompt: systemPromptOf(messages),
    tools: toolsOf(messages),
    messages: [...messages],
  };
  await appendFile(modelCallsPath(harness), `${JSON.stringify(call)}\n`);
  if (step === undefined) {
    throw new Error(
      `scripted model: call ${index + 1} has no step; the script has ${script.length}`,
    );
  }

  if ("error" in step) {
    return fauxAssistantMessage([], { stopReason: "error", errorMessage: step.error });
  }

  if ("reply" in step) {
    const message = fauxAssistantMessage([fauxText(step.reply)], {
      stopReason: step.stopReason ?? "stop",
    });
    return step.contextTokens === undefined
      ? message
      : withContextTokens(message, step.contextTokens);
  }

  // The script validator admits only JSON values, so the arguments are a JSON object.
  const toolArguments = step.arguments as Parameters<typeof fauxToolCall>[1];
  return fauxAssistantMessage([fauxToolCall(step.tool, toolArguments)], {
    stopReason: "toolUse",
  });
}

export default function scriptedModel(pi: ExtensionAPI): void {
  const faux = createFauxCore({});
  // The faux provider takes one queued response per call. The player queues
  // itself again on every call, so the queue never runs dry and the script
  // alone decides what the model answers.
  const player: FauxResponseFactory = (context) => {
    faux.appendResponses([player]);
    return playNextStep(context.messages);
  };

  faux.setResponses([player]);
  // A new session keeps the selected model only when Pi already counts its
  // provider as configured. A provider registered with a literal key counts
  // at once; one whose key only resolves at request time counts only after an
  // availability pass that runs in the background, so a prompt right after a
  // new session could find no model. The key reaches no service.
  pi.registerProvider(faux.provider, {
    baseUrl: "http://localhost:0",
    apiKey: "scripted-model",
    api: faux.api,
    streamSimple: (model, context, options) =>
      withContextUsage(faux.streamSimple(model, context, options)),
    models: faux.models.map((model) => ({
      id: model.id,
      name: model.name,
      input: model.input,
      reasoning: model.reasoning,
      cost: model.cost,
      contextWindow: model.contextWindow,
      maxTokens: model.maxTokens,
    })),
  });
}
