import type { TestContext } from "node:test";

/**
 * Captures what `hookDebugLog` emits for the duration of one case.
 *
 * `hookDebugLog` writes to `console.error` only while
 * `PI_CLAUDE_MARKETPLACE_DEBUG` is set, so the variable is set here and
 * restored to its prior value (including absence) afterwards.
 */
export function captureDebugLog(t: TestContext): string[] {
  const previousDebug = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  const logged: string[] = [];
  t.after(() => {
    if (previousDebug === undefined) {
      delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    } else {
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = previousDebug;
    }
  });
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  t.mock.method(console, "error", (...args: unknown[]) => {
    logged.push(args.map(String).join(" "));
  });
  return logged;
}
