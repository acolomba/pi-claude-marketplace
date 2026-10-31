/**
 * @fileoverview The `git repository` parameter type: a repository of the git
 * host, which a step names by the marketplace or the plugin it serves, as in
 * `marketplace "tools"` or `plugin "ghp"`.
 */

import { defineParameterType } from "@cucumber/cucumber";

/** A repository of the git host, named by what it serves. */
export interface GitRepositoryReference {
  readonly subject: "marketplace" | "plugin";
  readonly name: string;
}

defineParameterType({
  name: "git repository",
  regexp: /(marketplace|plugin) "([^"]*)"/,
  // The regexp admits only the two subjects.
  transformer: (subject: string, name: string): GitRepositoryReference => ({
    subject: subject === "plugin" ? "plugin" : "marketplace",
    name,
  }),
});
