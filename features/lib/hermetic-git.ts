/**
 * @fileoverview The environment of every git the suite runs besides Pi's.
 *
 * The git host's CGI and the fixture commands run git with a scratch HOME, no
 * system config, and an empty global config, and inherit nothing else. So the
 * credential files a scenario writes for Pi never change how the server or a
 * fixture behaves, and a git variable of the shell that runs the suite never
 * points a fixture at this repository (DRV-03).
 */

/** Returns the environment of a suite git whose HOME is `home`. */
export function hermeticGitEnvironment(home: string): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH ?? "",
    HOME: home,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_AUTHOR_NAME: "features",
    GIT_AUTHOR_EMAIL: "features@example.test",
    GIT_COMMITTER_NAME: "features",
    GIT_COMMITTER_EMAIL: "features@example.test",
  };
}
