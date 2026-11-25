import type { TestContext } from "node:test";

const BASE_URL_VARIABLE = "PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL";

const PREFER_HTTPS_VARIABLE = "CLAUDE_CODE_PLUGIN_PREFER_HTTPS";

/** The variables each test has registered a restore for. */
const restoringContexts = new WeakMap<TestContext, Set<string>>();

/**
 * Sets the variable `name` for one test, or clears it when `value` is
 * undefined.
 *
 * The first call for a variable in a test saves the value the test started
 * with and registers its restore with `t.after()` before anything changes, so
 * a failing assertion cannot leave the variable set for the next case. Later
 * calls for that variable in the same test register nothing: `after` hooks
 * run in the order they were added, so a second restore would put back the
 * first call's value. A variable that was absent is deleted on restore,
 * because `process.env` stringifies every assignment and an absent variable
 * restored by assignment would come back as the text `undefined`.
 */
function setVariable(t: TestContext, name: string, value: string | undefined): void {
  const restoring = restoringContexts.get(t) ?? new Set<string>();
  restoringContexts.set(t, restoring);
  if (!restoring.has(name)) {
    restoring.add(name);
    const previous = process.env[name];
    t.after(() => {
      if (previous === undefined) {
        Reflect.deleteProperty(process.env, name);
      } else {
        process.env[name] = previous;
      }
    });
  }

  if (value === undefined) {
    Reflect.deleteProperty(process.env, name);
  } else {
    process.env[name] = value;
  }
}

/**
 * Sets PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL for one test, or clears it when
 * `value` is undefined, and restores it after the test.
 */
export function setGitHubBaseUrl(t: TestContext, value: string | undefined): void {
  setVariable(t, BASE_URL_VARIABLE, value);
}

/**
 * D-SG-24: sets CLAUDE_CODE_PLUGIN_PREFER_HTTPS for one test, or clears it
 * when `value` is undefined, and restores it after the test.
 */
export function setPreferHttps(t: TestContext, value: string | undefined): void {
  setVariable(t, PREFER_HTTPS_VARIABLE, value);
}
