/**
 * @fileoverview Checks the CGI bridge of the https git host: the parser of the
 * `git http-backend` output, the CGI environment it runs with (HOST-01), the
 * arguments that carry each SHA-want policy, and which backend exits it
 * forwards (SG-HRN-02). The CGI
 * environment's exact key set under the runner's planted git and ssh
 * variables is checked in `hermetic-git-environment.test.ts` (SG-HRN-04).
 */

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import { hermeticGitEnvironment } from "../../features/lib/hermetic-git.ts";
import {
  cgiEnvironment,
  httpBackendArguments,
  parseCgiResponse,
  runHttpBackend,
} from "../../features/lib/https-git-host/cgi.ts";

import type { CgiRequest, CgiResponse } from "../../features/lib/https-git-host/cgi.ts";

describe("parseCgiResponse", () => {
  for (const { title, output, expectedResponse } of [
    {
      title: "reads a header block without Status as 200",
      output: Buffer.from("Content-Type: text/plain\r\n\r\nok"),
      expectedResponse: {
        status: 200,
        headers: [["Content-Type", "text/plain"]],
        body: Buffer.from("ok"),
      },
    },
    {
      title: "reads Status 404 as 404 and does not forward it as a header",
      output: Buffer.from("Status: 404 Not Found\r\nContent-Type: text/plain\r\n\r\nmissing"),
      expectedResponse: {
        status: 404,
        headers: [["Content-Type", "text/plain"]],
        body: Buffer.from("missing"),
      },
    },
    {
      title: "reads a header block that ends its lines with LF only",
      output: Buffer.from("Cache-Control: no-cache\nContent-Type: text/plain\n\nok"),
      expectedResponse: {
        status: 200,
        headers: [
          ["Cache-Control", "no-cache"],
          ["Content-Type", "text/plain"],
        ],
        body: Buffer.from("ok"),
      },
    },
    {
      title: "returns a binary body that holds blank lines byte for byte",
      output: Buffer.concat([
        Buffer.from("Content-Type: application/x-git-upload-pack-result\r\n\r\n"),
        Buffer.from([0x30, 0x0d, 0x0a, 0x0d, 0x0a, 0x0a, 0x0a, 0xff, 0xfe, 0x00]),
      ]),
      expectedResponse: {
        status: 200,
        headers: [["Content-Type", "application/x-git-upload-pack-result"]],
        body: Buffer.from([0x30, 0x0d, 0x0a, 0x0d, 0x0a, 0x0a, 0x0a, 0xff, 0xfe, 0x00]),
      },
    },
    {
      title: "keeps everything after the first colon of a header",
      output: Buffer.from("Expires: Fri, 01 Jan 1980 00:00:00 GMT\r\n\r\n"),
      expectedResponse: {
        status: 200,
        headers: [["Expires", "Fri, 01 Jan 1980 00:00:00 GMT"]],
        body: Buffer.alloc(0),
      },
    },
  ] satisfies ReadonlyArray<{
    title: string;
    output: Buffer;
    expectedResponse: CgiResponse;
  }>) {
    test(title, () => {
      // arrange
      const backendOutput = output;

      // act
      const response = parseCgiResponse(backendOutput);

      // assert
      assert.deepStrictEqual(response, expectedResponse);
    });
  }

  test("throws on output with no blank line after its headers", () => {
    // arrange
    const backendOutput = Buffer.from("Content-Type: text/plain\r\nok");

    // act & assert
    assert.throws(() => parseCgiResponse(backendOutput), {
      name: "Error",
      message: "the CGI response has no blank line after its headers",
    });
  });

  test("throws on a header with no colon", () => {
    // arrange
    const backendOutput = Buffer.from("NoColon\r\n\r\n");

    // act & assert
    assert.throws(() => parseCgiResponse(backendOutput), {
      name: "Error",
      message: 'the CGI response header "NoColon" has no colon',
    });
  });

  for (const { status, expectedMessage } of [
    {
      status: "Not Found",
      expectedMessage: 'the CGI response status "Not Found" is not an HTTP status',
    },
    { status: "99 Low", expectedMessage: 'the CGI response status "99 Low" is not an HTTP status' },
    {
      status: "1000 High",
      expectedMessage: 'the CGI response status "1000 High" is not an HTTP status',
    },
  ]) {
    test(`throws on the status "${status}", which Node cannot send`, () => {
      // arrange
      const backendOutput = Buffer.from(`Status: ${status}\r\nContent-Type: text/plain\r\n\r\nok`);

      // act & assert
      assert.throws(() => parseCgiResponse(backendOutput), {
        name: "Error",
        message: expectedMessage,
      });
    });
  }

  for (const { status, expectedStatus } of [
    { status: "100 Continue", expectedStatus: 100 },
    { status: "999 Last", expectedStatus: 999 },
  ]) {
    test(`reads the status "${status}" at the edge of the HTTP range as ${expectedStatus}`, () => {
      // arrange
      const backendOutput = Buffer.from(`Status: ${status}\r\n\r\n`);

      // act
      const response = parseCgiResponse(backendOutput);

      // assert
      assert.deepStrictEqual(response, {
        status: expectedStatus,
        headers: [],
        body: Buffer.alloc(0),
      });
    });
  }
});

/** The keys every CGI environment of the host at `/run/repositories` holds. */
function serverEnvironment(): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH ?? "",
    HOME: "/run/cgi-home",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_AUTHOR_NAME: "features",
    GIT_AUTHOR_EMAIL: "features@example.test",
    GIT_COMMITTER_NAME: "features",
    GIT_COMMITTER_EMAIL: "features@example.test",
    GIT_PROJECT_ROOT: "/run/repositories",
    GIT_HTTP_EXPORT_ALL: "1",
  };
}

/** A protocol v2 upload-pack POST with a 146-byte buffered body. */
function protocolV2Post(): CgiRequest {
  return {
    method: "POST",
    url: new URL("https://127.0.0.1:4443/acme/tools.git/git-upload-pack"),
    headers: {
      "content-type": "application/x-git-upload-pack-request",
      "git-protocol": "version=2",
    },
    body: Buffer.alloc(146),
  };
}

/** The CGI environment of `protocolV2Post()` without its `GIT_PROTOCOL`. */
function protocolV2PostEnvironment(): NodeJS.ProcessEnv {
  return {
    ...serverEnvironment(),
    PATH_INFO: "/acme/tools.git/git-upload-pack",
    QUERY_STRING: "",
    REQUEST_METHOD: "POST",
    CONTENT_TYPE: "application/x-git-upload-pack-request",
    CONTENT_LENGTH: "146",
  };
}

describe("cgiEnvironment", () => {
  test("passes the Git-Protocol header and the length of the buffered body", () => {
    // arrange
    const request = protocolV2Post();

    // act
    const environment = cgiEnvironment(request, "/run/repositories", "/run/cgi-home");

    // assert
    assert.deepStrictEqual(environment, {
      ...protocolV2PostEnvironment(),
      GIT_PROTOCOL: "version=2",
    });
  });

  for (const { title, policy, expectedProtocol } of [
    {
      title: "passes the Git-Protocol header under the allow-reachable policy",
      policy: "allow-reachable",
      expectedProtocol: { GIT_PROTOCOL: "version=2" },
    },
    {
      title: "drops the Git-Protocol header under the refuse policy, so the backend answers v0",
      policy: "refuse",
      expectedProtocol: {},
    },
  ] as const) {
    test(title, () => {
      // arrange
      const request = protocolV2Post();

      // act
      const environment = cgiEnvironment(request, "/run/repositories", "/run/cgi-home", policy);

      // assert
      assert.deepStrictEqual(environment, {
        ...protocolV2PostEnvironment(),
        ...expectedProtocol,
      });
    });
  }

  test("passes the Content-Encoding header of a compressed request", () => {
    // arrange
    const request = {
      method: "POST",
      url: new URL("https://127.0.0.1:4443/acme/tools.git/git-upload-pack"),
      headers: {
        "content-type": "application/x-git-upload-pack-request",
        "content-encoding": "gzip",
      },
      body: Buffer.alloc(20),
    } satisfies CgiRequest;

    // act
    const environment = cgiEnvironment(request, "/run/repositories", "/run/cgi-home");

    // assert
    assert.deepStrictEqual(environment, {
      ...serverEnvironment(),
      PATH_INFO: "/acme/tools.git/git-upload-pack",
      QUERY_STRING: "",
      REQUEST_METHOD: "POST",
      CONTENT_TYPE: "application/x-git-upload-pack-request",
      CONTENT_LENGTH: "20",
      HTTP_CONTENT_ENCODING: "gzip",
    });
  });
});

/**
 * Returns the arguments of a git that runs `script` through `sh` as the alias
 * `backend`, a stand-in for `git http-backend` with a chosen output and exit.
 */
function scriptedBackend(script: string): string[] {
  return ["-c", `alias.backend=!${script}`, "backend"];
}

describe("runHttpBackend", () => {
  test("resolves with the output of a backend that printed its header block and then exited non-zero (SG-HRN-02)", async (t) => {
    // arrange
    const home = await mkdtemp(path.join(tmpdir(), "cgi-backend-"));
    t.after(() => rm(home, { recursive: true, force: true }));
    const args = scriptedBackend(
      String.raw`printf 'Content-Type: text/plain\r\n\r\nnot our ref'; exit 128`,
    );

    // act
    const output = await runHttpBackend(
      args,
      hermeticGitEnvironment(home),
      Buffer.alloc(0),
      () => {},
    );

    // assert
    assert.strictEqual(output.toString("latin1"), "Content-Type: text/plain\r\n\r\nnot our ref");
  });

  for (const { title, script, expectedMessage } of [
    {
      title:
        "rejects a backend that exited non-zero without a header block, with its code and stderr",
      script: "echo backend failed >&2; exit 3",
      expectedMessage: "git http-backend exited 3: backend failed\n",
    },
    {
      title: "rejects a backend that exited non-zero before it ended its header block",
      script: String.raw`printf 'Content-Type: text/plain\r\n'; exit 1`,
      expectedMessage: "git http-backend exited 1: ",
    },
  ]) {
    test(title, async (t) => {
      // arrange
      const home = await mkdtemp(path.join(tmpdir(), "cgi-backend-"));
      t.after(() => rm(home, { recursive: true, force: true }));
      const args = scriptedBackend(script);

      // act & assert
      await assert.rejects(
        runHttpBackend(args, hermeticGitEnvironment(home), Buffer.alloc(0), () => {}),
        { name: "Error", message: expectedMessage },
      );
    });
  }
});

describe("httpBackendArguments", () => {
  for (const { title, policy, expectedArguments } of [
    {
      title: "allows a want of a reachable commit under the allow-reachable policy",
      policy: "allow-reachable",
      expectedArguments: ["-c", "uploadpack.allowReachableSHA1InWant=true", "http-backend"],
    },
    {
      title: "turns off both SHA-want allow keys under the refuse policy",
      policy: "refuse",
      expectedArguments: [
        "-c",
        "uploadpack.allowReachableSHA1InWant=false",
        "-c",
        "uploadpack.allowAnySHA1InWant=false",
        "http-backend",
      ],
    },
  ] as const) {
    test(title, () => {
      // act
      const args = httpBackendArguments(policy);

      // assert
      assert.deepStrictEqual(args, expectedArguments);
    });
  }
});
