/**
 * @fileoverview The `git repository` parameter type: a repository of the git
 * host, which a step names by the marketplace it serves, as in
 * `marketplace "tools"`.
 */

import { defineParameterType } from "@cucumber/cucumber";

/** A repository of the git host, named by what it serves. */
export interface GitRepositoryReference {
  readonly subject: "marketplace";
  readonly name: string;
}

defineParameterType({
  name: "git repository",
  regexp: /marketplace "([^"]*)"/,
  transformer: (name: string): GitRepositoryReference => ({ subject: "marketplace", name }),
});
