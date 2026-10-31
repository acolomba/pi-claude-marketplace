/**
 * @fileoverview Checks the CGI bridge of the https git host: the parser of the
 * `git http-backend` output and the CGI environment it runs with (HOST-01).
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { cgiEnvironment, parseCgiResponse } from "../../features/lib/https-git-host/cgi.ts";

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

describe("cgiEnvironment", () => {
  test("builds the environment from scratch, without an inherited git variable", (t) => {
    // arrange
    for (const [name, planted] of [
      ["GIT_DIR", "/worker/repo/.git"],
      ["GIT_INDEX_FILE", "/worker/repo/.git/index"],
      ["GIT_CONFIG_SYSTEM", "/worker/gitconfig"],
      ["GIT_CONFIG_GLOBAL", "/worker/home/.gitconfig"],
      ["GIT_ASKPASS", "/worker/askpass"],
    ] as const) {
      const previous = process.env[name];
      t.after(() => {
        if (previous === undefined) {
          Reflect.deleteProperty(process.env, name);
        } else {
          process.env[name] = previous;
        }
      });
      process.env[name] = planted;
    }

    const request = {
      method: "GET",
      url: new URL("https://127.0.0.1:4443/acme/tools.git/info/refs?service=git-upload-pack"),
      headers: {},
      body: Buffer.alloc(0),
    } satisfies CgiRequest;

    // act
    const environment = cgiEnvironment(request, "/run/repositories", "/run/cgi-home");

    // assert
    assert.deepStrictEqual(environment, {
      ...serverEnvironment(),
      PATH_INFO: "/acme/tools.git/info/refs",
      QUERY_STRING: "service=git-upload-pack",
      REQUEST_METHOD: "GET",
      CONTENT_TYPE: "",
      CONTENT_LENGTH: "0",
    });
  });

  test("passes the Git-Protocol header and the length of the buffered body", () => {
    // arrange
    const request = {
      method: "POST",
      url: new URL("https://127.0.0.1:4443/acme/tools.git/git-upload-pack"),
      headers: {
        "content-type": "application/x-git-upload-pack-request",
        "git-protocol": "version=2",
      },
      body: Buffer.alloc(146),
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
      CONTENT_LENGTH: "146",
      GIT_PROTOCOL: "version=2",
    });
  });

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
