/**
 * @fileoverview The routing rule of the GitHub redirect, kept apart from the
 * extension that patches Node's request functions, so a unit test can pin it
 * without patching any global (D-BG-01).
 */

const GITHUB_HOST = "github.com";
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(["127.0.0.1", "localhost", "[::1]"]);

/**
 * The `127.0.0.1:<port>` address of the run's git host, which the redirect
 * sends every `github.com` request to.
 */
export interface RedirectConfig {
  readonly gitHost: string;
}

/** The stand-in a routed request goes to. */
export type RouteTarget = "git host";

/** What the redirect does with one request. */
export type Route =
  | { readonly decision: "passed" }
  | { readonly decision: "routed"; readonly target: RouteTarget; readonly url: string }
  | { readonly decision: "refused"; readonly host: string };

/**
 * Returns what the redirect does with a request for `url` under `config`:
 * a loopback host passes; an https request for `github.com` is routed to the
 * git host, with its path and query kept; anything else is refused, and so is
 * `github.com` with no config.
 */
export function routeRequest(url: URL, config: RedirectConfig | undefined): Route {
  if (LOOPBACK_HOSTS.has(url.hostname)) {
    return { decision: "passed" };
  }

  if (config === undefined || url.protocol !== "https:" || url.hostname !== GITHUB_HOST) {
    return { decision: "refused", host: url.hostname };
  }

  return {
    decision: "routed",
    target: "git host",
    url: `https://${config.gitHost}${url.pathname}${url.search}`,
  };
}
