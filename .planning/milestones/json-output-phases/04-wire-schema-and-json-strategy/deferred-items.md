## Deferred Items

- LLM plugin tool error text is outside the redacted notification model
  status: resolved
  **What:** `edge/handlers/tools.ts` returns `Failed to load plugin list: ${errorMessage(err)}` as tool `content` text when the payload load throws. This text goes to the LLM, not through a presentation, so `redactCredentials` does not see it. The thrown value is a `state.json` read error, which names a file, not a credential. Found during the 04-04 thrown-message inventory; out of PMOD-04 scope (the plan redacts at resolve and presentation, never in a producer).
  **Resolved by:** `09/`, commits bebad4e4 and 6e1f282c. Both LLM tools in `edge/handlers/tools.ts` pass every `content` string through `redactCredentials`, and they return a redacted error result for every load failure instead of throwing (PMOD-04; milestone audit Verdict item 1).
