import type { TestContext } from "node:test";

const restoringContexts = new WeakSet<TestContext>();

/**
 * Sets PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL for one test, or clears it when
 * `value` is undefined.
 *
 * The first call in a test saves the value the test started with and
 * registers its restore with `t.after()` before anything changes, so a failing
 * assertion cannot leave the variable set for the next case. Later calls in
 * the same test register nothing: `after` hooks run in the order they were
 * added, so a second restore would put back the first call's value. A
 * variable that was absent is deleted on restore, because `process.env`
 * stringifies every assignment and an absent variable restored by assignment
 * would come back as the text `undefined`.
 */
export function setGitHubBaseUrl(t: TestContext, value: string | undefined): void {
  if (!restoringContexts.has(t)) {
    restoringContexts.add(t);
    const previous = process.env.PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL;
    t.after(() => {
      if (previous === undefined) {
        delete process.env.PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL;
      } else {
        process.env.PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL = previous;
      }
    });
  }

  if (value === undefined) {
    delete process.env.PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL;
  } else {
    process.env.PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL = value;
  }
}
