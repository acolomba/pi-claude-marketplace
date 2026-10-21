/**
 * @fileoverview The bridge to `git http-backend`: the CGI environment, the
 * spawn, and the response parser.
 *
 * The host buffers each request body before it runs the CGI, so a chunked
 * request still gets a `CONTENT_LENGTH`. The CGI runs with the suite's
 * hermetic git environment and nothing from the worker's own (DRV-03).
 */

import { spawn } from "node:child_process";

import { hermeticGitEnvironment } from "../hermetic-git.ts";

import type { ChildProcess } from "node:child_process";
import type { IncomingHttpHeaders } from "node:http";

/** One buffered request to the git host. */
export interface CgiRequest {
  readonly method: string;
  readonly url: URL;
  readonly headers: IncomingHttpHeaders;
  readonly body: Buffer;
}

/** The parsed output of `git http-backend`. */
export interface CgiResponse {
  readonly status: number;
  readonly headers: ReadonlyArray<readonly [string, string]>;
  readonly body: Buffer;
}

function optionalHeader(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name];
  return value === undefined ? undefined : String(value);
}

/**
 * Returns the CGI environment of `request` for a backend that serves the
 * repositories under `projectRoot` and runs with the HOME `home`.
 */
export function cgiEnvironment(
  request: CgiRequest,
  projectRoot: string,
  home: string,
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    ...hermeticGitEnvironment(home),
    GIT_PROJECT_ROOT: projectRoot,
    // Without it the backend refuses every repository that lacks an export marker.
    GIT_HTTP_EXPORT_ALL: "1",
    PATH_INFO: decodeURIComponent(request.url.pathname),
    QUERY_STRING: request.url.search.slice(1),
    REQUEST_METHOD: request.method,
    CONTENT_TYPE: optionalHeader(request.headers, "content-type") ?? "",
    CONTENT_LENGTH: String(request.body.length),
  };
  const protocol = optionalHeader(request.headers, "git-protocol");
  if (protocol !== undefined) {
    environment.GIT_PROTOCOL = protocol;
  }

  const encoding = optionalHeader(request.headers, "content-encoding");
  if (encoding !== undefined) {
    environment.HTTP_CONTENT_ENCODING = encoding;
  }

  return environment;
}

function headerBlockEnd(output: Buffer): { readonly end: number; readonly gap: number } {
  const crlf = output.indexOf("\r\n\r\n");
  const lf = output.indexOf("\n\n");
  if (crlf !== -1 && (lf === -1 || crlf < lf)) {
    return { end: crlf, gap: 4 };
  }

  if (lf === -1) {
    throw new Error("the CGI response has no blank line after its headers");
  }

  return { end: lf, gap: 2 };
}

function headerLine(line: string): readonly [string, string] {
  const colon = line.indexOf(":");
  if (colon === -1) {
    throw new Error(`the CGI response header "${line}" has no colon`);
  }

  return [line.slice(0, colon), line.slice(colon + 1).trim()];
}

// Node refuses to send a status outside 100-999.
function statusCode(value: string): number {
  const status = Number.parseInt(value, 10);
  if (!Number.isInteger(status) || status < 100 || status > 999) {
    throw new Error(`the CGI response status "${value}" is not an HTTP status`);
  }

  return status;
}

/**
 * Parses the output of `git http-backend`: the status from its `Status`
 * header, 200 when absent, the other headers, and the bytes after the first
 * blank line as the body, never decoded. Throws on a status that is not a
 * number from 100 to 999.
 */
export function parseCgiResponse(output: Buffer): CgiResponse {
  const { end, gap } = headerBlockEnd(output);
  const lines = output
    .subarray(0, end)
    .toString("latin1")
    .split(/\r?\n/)
    .filter((line) => line !== "");
  let status = 200;
  const headers: Array<readonly [string, string]> = [];
  for (const [name, value] of lines.map((line) => headerLine(line))) {
    if (name.toLowerCase() === "status") {
      status = statusCode(value);
    } else {
      headers.push([name, value]);
    }
  }

  return { status, headers, body: output.subarray(end + gap) };
}

/**
 * Runs `git http-backend` with `env`, writes `body` to it, and resolves with
 * everything it prints. Hands the child to `track` first, so the host can
 * kill it. Rejects with the exit code and stderr when it fails.
 */
export function runHttpBackend(
  env: NodeJS.ProcessEnv,
  body: Buffer,
  track: (child: ChildProcess) => void,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", ["http-backend"], { env, stdio: ["pipe", "pipe", "pipe"] });
    track(child);
    const chunks: Buffer[] = [];
    let stderr = "";
    child.on("error", reject);
    // A backend that needs no body may exit before it reads stdin; its exit code decides.
    child.stdin.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code !== "EPIPE") {
        reject(error);
      }
    });
    child.stdout.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(`git http-backend exited ${code ?? "on a signal"}: ${stderr}`));
      }
    });
    child.stdin.end(body);
  });
}
