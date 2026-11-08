/**
 * @fileoverview The GitHub redirect: a harness Pi extension that keeps every
 * request of a Pi without the GitHub base override on this machine (D-BG-01).
 *
 * Such a Pi signs in through Device Flow at `https://github.com/login/...`
 * and clones from `https://github.com/...`, because GHB-02 runs Device Flow
 * only when the override is unset. When Pi loads this module, it reads
 * `<home>/github-redirect.json`, which a step writes before Pi starts, and
 * replaces `request` and `get` of `node:https` and `node:http` and
 * `globalThis.fetch` in Pi's process. isomorphic-git reaches the network
 * through `simple-get`, which reads `https.request` when it sends, and the
 * product's Device Flow calls the global `fetch`, so both go through the
 * replacements. An https request for `github.com` goes to the Device Flow
 * stand-in when its path starts with `/login/`, and to the run's git host
 * otherwise, with its path kept. Its host becomes `127.0.0.1`, so TLS checks
 * the git host's certificate, which both stand-ins serve. A request to a
 * loopback host passes unchanged. Any other request is refused with an error
 * that names its host, and so is every non-loopback request when the config
 * is missing. At load it appends one `loaded` line with its process id, and it
 * appends one line per routed or refused request, synchronously, to
 * `<harness dir>/github-redirect.jsonl`, so a scenario can state that nothing
 * left the machine.
 */

import { appendFileSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath, urlToHttpOptions } from "node:url";

import { harnessDirectory } from "../turn-records.ts";

import type { ClientRequest, IncomingMessage, OutgoingHttpHeaders } from "node:http";
import type { RequestOptions } from "node:https";

/** The absolute path of this file, which a profile Pi loads as an extension. */
export const GITHUB_REDIRECT_EXTENSION = fileURLToPath(import.meta.url);

const CONFIG_FILE = "github-redirect.json";
const LOG_FILE = "github-redirect.jsonl";
const GITHUB_HOST = "github.com";
const SIGN_IN_PREFIX = "/login/";
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

/** The `127.0.0.1:<port>` addresses the redirect sends `github.com` requests to. */
export interface RedirectConfig {
  readonly gitHost: string;
  readonly signIn: string;
}

/** The stand-in a routed request goes to. */
export type RouteTarget = "git host" | "sign-in";

/** What the redirect does with one request. */
type Route =
  | { readonly decision: "passed" }
  | { readonly decision: "routed"; readonly target: RouteTarget; readonly url: string }
  | { readonly decision: "refused"; readonly host: string };

/** One line of the redirect's log. */
export type RedirectLogLine =
  | { readonly decision: "loaded"; readonly pid: number; readonly configured: boolean }
  | {
      readonly decision: "routed";
      readonly method: string;
      readonly url: string;
      readonly target: RouteTarget;
    }
  | { readonly decision: "refused"; readonly method: string; readonly url: string };

// `request` of `node:http` or `node:https`, called with one options object.
type RequestFunction = (
  options: RequestOptions,
  callback?: (res: IncomingMessage) => void,
) => ClientRequest;

// A replacement `request` or `get`, which takes every argument form Node's do.
type PatchedRequest = (...args: unknown[]) => ClientRequest;

function routeRequest(url: URL, config: RedirectConfig | undefined): Route {
  if (LOOPBACK_HOSTS.has(url.hostname)) {
    return { decision: "passed" };
  }

  if (config === undefined || url.protocol !== "https:" || url.hostname !== GITHUB_HOST) {
    return { decision: "refused", host: url.hostname };
  }

  const target: RouteTarget = url.pathname.startsWith(SIGN_IN_PREFIX) ? "sign-in" : "git host";
  const address = target === "sign-in" ? config.signIn : config.gitHost;
  return { decision: "routed", target, url: `https://${address}${url.pathname}${url.search}` };
}

/**
 * Writes the redirect's config to the sandbox home `home`, which must not
 * hold one yet, so the next Pi that loads the redirect routes to `config`.
 */
export async function writeRedirectConfig(home: string, config: RedirectConfig): Promise<void> {
  await mkdir(home, { recursive: true });
  await writeFile(path.join(home, CONFIG_FILE), `${JSON.stringify(config)}\n`, { flag: "wx" });
}

/** Returns every line of the redirect's log in the harness directory `harness`, in append order. */
export async function readRedirectLog(harness: string): Promise<RedirectLogLine[]> {
  const text = await readFile(path.join(harness, LOG_FILE), "utf8");
  return text
    .split("\n")
    .flatMap((line) => (line === "" ? [] : [JSON.parse(line) as RedirectLogLine]));
}

function isRedirectConfig(value: unknown): value is RedirectConfig {
  return (
    typeof value === "object" &&
    value !== null &&
    "gitHost" in value &&
    typeof value.gitHost === "string" &&
    "signIn" in value &&
    typeof value.signIn === "string"
  );
}

// A missing or unreadable config routes nothing, so every non-loopback request is refused.
function readConfig(home: string): RedirectConfig | undefined {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path.join(home, CONFIG_FILE), "utf8"));
    return isRedirectConfig(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isRequestOptions(value: unknown): value is RequestOptions {
  return typeof value === "object" && value !== null && !(value instanceof URL);
}

function isResponseListener(value: unknown): value is (res: IncomingMessage) => void {
  return typeof value === "function";
}

// Node's `request(url, options?, callback?)` and `request(options, callback?)` as one options object.
function requestArguments(args: readonly unknown[]): {
  readonly options: RequestOptions;
  readonly callback: unknown;
} {
  const [first, second, third] = args;
  if (typeof first === "string" || first instanceof URL) {
    const fromUrl = urlToHttpOptions(new URL(first));
    return isRequestOptions(second)
      ? { options: { ...fromUrl, ...second }, callback: third }
      : { options: fromUrl, callback: second };
  }

  return { options: isRequestOptions(first) ? first : {}, callback: second };
}

function requestUrl(options: RequestOptions, defaultProtocol: string): URL {
  const host = options.hostname ?? options.host ?? "localhost";
  const hostText = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
  const port = options.port === undefined || options.port === null ? "" : `:${options.port}`;
  return new URL(
    `${options.protocol ?? defaultProtocol}//${hostText}${port}${options.path ?? "/"}`,
  );
}

function withoutHostHeader(
  headers: RequestOptions["headers"],
): OutgoingHttpHeaders | readonly string[] | undefined {
  if (headers === undefined || Array.isArray(headers)) {
    return headers;
  }

  return Object.fromEntries(
    Object.entries(headers).filter(([name]) => name.toLowerCase() !== "host"),
  );
}

class GitHubRedirect {
  private readonly config: RedirectConfig | undefined;
  private readonly log: string;

  constructor(config: RedirectConfig | undefined, log: string) {
    this.config = config;
    this.log = log;
  }

  // Returns where `url` goes, after logging a routed or refused request.
  route(url: URL, method: string): Route {
    const route = routeRequest(url, this.config);
    const original = url.href;
    if (route.decision === "routed") {
      this.append({ decision: "routed", method, url: original, target: route.target });
    } else if (route.decision === "refused") {
      this.append({ decision: "refused", method, url: original });
    }

    return route;
  }

  append(line: RedirectLogLine): void {
    try {
      appendFileSync(this.log, `${JSON.stringify(line)}\n`);
    } catch {
      // D-BG-01: the redirect never throws into Pi for its log. A line it
      // cannot write leaves the scenario to fail on the log it states.
    }
  }

  // Wraps `original`, a `request` of `node:http` or `node:https`.
  request(original: RequestFunction, defaultProtocol: string): PatchedRequest {
    return (...args) => {
      const { options, callback } = requestArguments(args);
      const listener = isResponseListener(callback) ? callback : undefined;
      const route = this.route(requestUrl(options, defaultProtocol), options.method ?? "GET");
      if (route.decision === "passed") {
        return original(options, listener);
      }

      if (route.decision === "refused") {
        throw new Error(`the GitHub redirect refuses a request to ${route.host}`);
      }

      const target = new URL(route.url);
      const { host: _host, servername: _servername, ...kept } = options;
      const headers = withoutHostHeader(options.headers);
      const routed: RequestOptions = {
        ...kept,
        protocol: target.protocol,
        hostname: target.hostname,
        port: Number(target.port),
        ...(headers === undefined ? {} : { headers }),
      };
      return original(routed, listener);
    };
  }

  // Node's `get` calls its module's own `request`, not the exported one, so it gets its own wrapper.
  get(request: PatchedRequest): PatchedRequest {
    return (...args) => {
      const req = request(...args);
      req.end();
      return req;
    };
  }

  fetch(original: typeof fetch): typeof fetch {
    return async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input);
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      const route = this.route(url, method);
      if (route.decision === "passed") {
        return original(input, init);
      }

      if (route.decision === "refused") {
        throw new TypeError(`the GitHub redirect refuses a request to ${route.host}`);
      }

      return original(input instanceof Request ? new Request(route.url, input) : route.url, init);
    };
  }
}

// fallow-ignore-next-line unused-export -- Pi's --extension loader reads this default.
export default function githubRedirect(): void {
  const home = process.env.HOME ?? "";
  const config = readConfig(home);
  const redirect = new GitHubRedirect(config, path.join(harnessDirectory(home), LOG_FILE));
  const httpsRequest = redirect.request(https.request, "https:");
  const httpRequest = redirect.request(http.request, "http:");
  Object.assign(https, { request: httpsRequest, get: redirect.get(httpsRequest) });
  Object.assign(http, { request: httpRequest, get: redirect.get(httpRequest) });
  globalThis.fetch = redirect.fetch(globalThis.fetch.bind(globalThis));
  redirect.append({ decision: "loaded", pid: process.pid, configured: config !== undefined });
}
