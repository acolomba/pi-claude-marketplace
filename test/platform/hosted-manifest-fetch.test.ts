import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import { fetchHostedManifest } from "../../extensions/pi-claude-marketplace/platform/hosted-manifest-fetch.ts";
import {
  HostedManifestFetchError,
  HostedManifestHttpError,
} from "../../extensions/pi-claude-marketplace/shared/errors.ts";

const CATALOG_URL = "https://catalog.example/acme/marketplace.json";
const CATALOG = '{"name":"tools","owner":{"name":"acme"},"plugins":[]}';
const MAX_CATALOG_BYTES = 5 * 1024 * 1024;

interface RecordedRequest {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

function requestUrl(input: string | URL | Request): string {
  if (typeof input === "string") {
    return input;
  }

  return input instanceof URL ? input.href : input.url;
}

/**
 * Replaces `fetch` with a host that gives the answers in order, one fresh
 * `Response` per call, and records each request.
 */
function serveAnswers(
  t: TestContext,
  answers: readonly (() => Response)[],
): readonly RecordedRequest[] {
  const requests: RecordedRequest[] = [];
  const pending = [...answers];
  t.mock.method(
    globalThis,
    "fetch",
    (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      requests.push({ url: requestUrl(input), init });
      const answer = pending.shift();
      return answer === undefined
        ? Promise.reject(new Error(`unexpected request for ${requestUrl(input)}`))
        : Promise.resolve(answer());
    },
  );
  return requests;
}

function ok(body: BodyInit | null = CATALOG): () => Response {
  return () => new Response(body, { status: 200 });
}

function redirect(location: string, status = 302, body: string | null = null): () => Response {
  return () => new Response(body, { status, headers: { location } });
}

function urls(requests: readonly RecordedRequest[]): readonly string[] {
  return requests.map((request) => request.url);
}

function assertRefused(message: string): (error: unknown) => boolean {
  return (error: unknown) => {
    assert.ok(error instanceof HostedManifestFetchError);
    assert.deepStrictEqual(
      { failure: error.failure, message: error.message },
      { failure: "unreadable", message },
    );
    return true;
  };
}

function refusedRedirect(target: string): string {
  return `Marketplace catalog redirected to a disallowed URL and was refused -- a server-chosen cross-origin redirect must use https:// and must not point at a loopback, link-local, or cloud-metadata host (only a hop that stays on the origin you started from is exempt): ${target}`;
}

test("downloads the catalog bytes with one GET that sends no header or credential", async (t) => {
  // arrange
  const requests = serveAnswers(t, [ok()]);

  // act
  const bytes = await fetchHostedManifest(CATALOG_URL);

  // assert
  assert.deepStrictEqual(Buffer.from(bytes), Buffer.from(CATALOG));
  assert.deepStrictEqual(urls(requests), [CATALOG_URL]);
  const init = requests[0]?.init;
  assert.deepStrictEqual(Object.keys(init ?? {}).sort(), ["redirect", "signal"]);
  assert.strictEqual(init?.redirect, "manual");
  assert.ok(init.signal instanceof AbortSignal);
});

test("returns no bytes for an answer without a body", async (t) => {
  // arrange
  serveAnswers(t, [ok(null)]);

  // act
  const bytes = await fetchHostedManifest(CATALOG_URL);

  // assert
  assert.deepStrictEqual(Buffer.from(bytes), Buffer.alloc(0));
});

test("follows a redirect that stays on the start origin", async (t) => {
  // arrange
  const requests = serveAnswers(t, [redirect("/acme/v2/marketplace.json", 301, "moved"), ok()]);

  // act
  const bytes = await fetchHostedManifest(CATALOG_URL);

  // assert
  assert.deepStrictEqual(Buffer.from(bytes), Buffer.from(CATALOG));
  assert.deepStrictEqual(urls(requests), [
    CATALOG_URL,
    "https://catalog.example/acme/v2/marketplace.json",
  ]);
});

test("follows a cross-origin https redirect to a public host", async (t) => {
  // arrange
  const requests = serveAnswers(t, [redirect("https://cdn.example/tools.json"), ok()]);

  // act
  const bytes = await fetchHostedManifest(CATALOG_URL);

  // assert
  assert.deepStrictEqual(Buffer.from(bytes), Buffer.from(CATALOG));
  assert.deepStrictEqual(urls(requests), [CATALOG_URL, "https://cdn.example/tools.json"]);
});

test("refuses a cross-origin redirect to http", async (t) => {
  // arrange
  const requests = serveAnswers(t, [redirect("http://cdn.example/tools.json")]);

  // act & assert
  await assert.rejects(
    fetchHostedManifest(CATALOG_URL),
    assertRefused(refusedRedirect("http://cdn.example/tools.json")),
  );
  assert.deepStrictEqual(urls(requests), [CATALOG_URL]);
});

for (const target of [
  "https://127.0.0.1/tools.json",
  "https://0.0.0.0/tools.json",
  "https://[::1]/tools.json",
  "https://[::]/tools.json",
  "https://169.254.169.254/latest/meta-data",
  "https://10.0.0.1/tools.json",
  "https://172.16.0.1/tools.json",
  "https://192.168.1.1/tools.json",
  "https://metadata.google.internal/computeMetadata",
  "https://100.100.100.200/latest",
  "https://localhost/tools.json",
  "https://localhost./tools.json",
  "https://catalog.localhost/tools.json",
  "https://instance-data.us-east-1.compute.internal/latest",
  "https://[fe80::1]/tools.json",
  "https://[fd00:ec2::254]/latest",
  "https://[::ffff:7f00:1]/tools.json",
  "https://[::ffff:a9fe:a9fe]/latest",
  "https://[::a9fe:a9fe]/latest",
  "https://[::ffff:0:7f00:1]/tools.json",
  "https://[64:ff9b::a9fe:a9fe]/latest",
  "https://[fe80:1:2:3:4:5:6:7]/tools.json",
]) {
  test(`refuses a cross-origin redirect to ${target}`, async (t) => {
    // arrange
    const requests = serveAnswers(t, [redirect(target)]);

    // act & assert
    await assert.rejects(fetchHostedManifest(CATALOG_URL), assertRefused(refusedRedirect(target)));
    assert.deepStrictEqual(urls(requests), [CATALOG_URL]);
  });
}

for (const target of [
  "https://93.184.216.34/tools.json",
  "https://172.32.0.1/tools.json",
  "https://169.255.0.1/tools.json",
  "https://192.169.0.1/tools.json",
  "https://[2001:db8::1]/tools.json",
  "https://[::ffff:5db8:d822]/tools.json",
  "https://[::5db8:d822]/tools.json",
  "https://[64:ff9b::5db8:d822]/tools.json",
  "https://[2001:db8:1:2:3:4:5:6]/tools.json",
  "https://instance-data.example/tools.json",
]) {
  test(`follows a cross-origin redirect to the public host of ${target}`, async (t) => {
    // arrange
    const requests = serveAnswers(t, [redirect(target), ok()]);

    // act
    const bytes = await fetchHostedManifest(CATALOG_URL);

    // assert
    assert.deepStrictEqual(Buffer.from(bytes), Buffer.from(CATALOG));
    assert.deepStrictEqual(urls(requests), [CATALOG_URL, target]);
  });
}

for (const target of [
  "https://user:secret@catalog.example/acme/v2/marketplace.json",
  "https://user:secret@cdn.example/tools.json",
]) {
  test(`refuses a redirect to ${target} and masks its user name and password`, async (t) => {
    // arrange
    const requests = serveAnswers(t, [redirect(target)]);

    // act & assert
    await assert.rejects(
      fetchHostedManifest(CATALOG_URL),
      assertRefused(
        `Marketplace catalog redirected to a URL with a user name or password and was refused: ${target.replace("user:secret", "***")}`,
      ),
    );
    assert.deepStrictEqual(urls(requests), [CATALOG_URL]);
  });
}

test("follows a same-origin redirect on a loopback start URL", async (t) => {
  // arrange
  const start = "https://127.0.0.1:8443/acme/marketplace.json";
  const requests = serveAnswers(t, [redirect("/acme/v2/marketplace.json"), ok()]);

  // act
  const bytes = await fetchHostedManifest(start);

  // assert
  assert.deepStrictEqual(Buffer.from(bytes), Buffer.from(CATALOG));
  assert.deepStrictEqual(urls(requests), [
    start,
    "https://127.0.0.1:8443/acme/v2/marketplace.json",
  ]);
});

test("follows five redirects", async (t) => {
  // arrange
  const hops = [1, 2, 3, 4, 5].map((hop) => redirect(`/hop-${hop}.json`));
  const requests = serveAnswers(t, [...hops, ok()]);

  // act
  const bytes = await fetchHostedManifest(CATALOG_URL);

  // assert
  assert.deepStrictEqual(Buffer.from(bytes), Buffer.from(CATALOG));
  assert.strictEqual(requests.length, 6);
});

test("refuses a sixth redirect", async (t) => {
  // arrange
  const hops = [1, 2, 3, 4, 5, 6].map((hop) => redirect(`/hop-${hop}.json`));
  const requests = serveAnswers(t, hops);

  // act & assert
  await assert.rejects(
    fetchHostedManifest(CATALOG_URL),
    assertRefused(`Too many redirects while downloading marketplace from ${CATALOG_URL}`),
  );
  assert.strictEqual(requests.length, 6);
});

for (const statusCode of [404, 500]) {
  test(`throws the HTTP status of a ${statusCode} answer`, async (t) => {
    // arrange
    serveAnswers(t, [() => new Response("gone", { status: statusCode })]);

    // act & assert
    await assert.rejects(fetchHostedManifest(CATALOG_URL), (error: unknown) => {
      assert.ok(error instanceof HostedManifestHttpError);
      assert.deepStrictEqual(error.data, { statusCode });
      return true;
    });
  });
}

for (const location of [undefined, "https://["]) {
  test(`throws the HTTP status of a redirect whose location is ${String(location)}`, async (t) => {
    // arrange
    const requests = serveAnswers(t, [
      () =>
        new Response(null, {
          status: 302,
          headers: location === undefined ? {} : { location },
        }),
    ]);

    // act & assert
    await assert.rejects(fetchHostedManifest(CATALOG_URL), (error: unknown) => {
      assert.ok(error instanceof HostedManifestHttpError);
      assert.deepStrictEqual(error.data, { statusCode: 302 });
      return true;
    });
    assert.strictEqual(requests.length, 1);
  });
}

test("refuses an answer that declares a length over the cap", async (t) => {
  // arrange
  serveAnswers(t, [
    () =>
      new Response(CATALOG, {
        status: 200,
        headers: { "content-length": String(MAX_CATALOG_BYTES + 1) },
      }),
  ]);

  // act & assert
  await assert.rejects(
    fetchHostedManifest(CATALOG_URL),
    assertRefused(
      `Marketplace catalog at ${CATALOG_URL} is larger than ${MAX_CATALOG_BYTES} bytes`,
    ),
  );
});

test("downloads a catalog of exactly the cap", async (t) => {
  // arrange
  const catalog = Buffer.alloc(MAX_CATALOG_BYTES, 0x20);
  serveAnswers(t, [ok(catalog)]);

  // act
  const bytes = await fetchHostedManifest(CATALOG_URL);

  // assert
  assert.deepStrictEqual(Buffer.from(bytes), catalog);
});

test("stops reading and cancels a streamed body once it passes the cap", async (t) => {
  // arrange
  const chunk = new Uint8Array(1024 * 1024);
  let pulls = 0;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls += 1;
      controller.enqueue(chunk);
    },
    cancel() {
      cancelled = true;
    },
  });
  serveAnswers(t, [ok(body)]);

  // act & assert
  await assert.rejects(
    fetchHostedManifest(CATALOG_URL),
    assertRefused(
      `Marketplace catalog at ${CATALOG_URL} is larger than ${MAX_CATALOG_BYTES} bytes`,
    ),
  );
  assert.deepStrictEqual(
    { cancelled, pullsBelowEight: pulls < 8 },
    { cancelled: true, pullsBelowEight: true },
  );
});

test("reads a refused connection as a network failure", async (t) => {
  // arrange
  const refused = new TypeError("fetch failed", {
    cause: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
  });
  t.mock.method(globalThis, "fetch", () => Promise.reject(refused));

  // act & assert
  await assert.rejects(fetchHostedManifest(CATALOG_URL), (error: unknown) => {
    assert.ok(error instanceof HostedManifestFetchError);
    assert.deepStrictEqual(
      { failure: error.failure, message: error.message, cause: error.cause },
      { failure: "network", message: `Could not connect to ${CATALOG_URL}`, cause: refused },
    );
    return true;
  });
});

test("reads a timeout as a network failure", async (t) => {
  // arrange
  const timeout = new DOMException("The operation was aborted due to timeout", "TimeoutError");
  t.mock.method(globalThis, "fetch", () => Promise.reject(timeout));

  // act & assert
  await assert.rejects(fetchHostedManifest(CATALOG_URL), (error: unknown) => {
    assert.ok(error instanceof HostedManifestFetchError);
    assert.deepStrictEqual(
      { failure: error.failure, message: error.message, cause: error.cause },
      {
        failure: "network",
        message: `Request timed out while downloading marketplace from ${CATALOG_URL}`,
        cause: timeout,
      },
    );
    return true;
  });
});

test("refuses a URL the URL parser refuses before any request", async (t) => {
  // arrange
  const requests = serveAnswers(t, []);

  // act & assert
  await assert.rejects(
    fetchHostedManifest("https://catalog.example:99999/marketplace.json"),
    assertRefused(
      "Marketplace URL is not a valid URL: https://catalog.example:99999/marketplace.json",
    ),
  );
  assert.deepStrictEqual(requests, []);
});

test("refuses a URL with a user name and password before any request and masks them", async (t) => {
  // arrange
  const requests = serveAnswers(t, []);

  // act & assert
  await assert.rejects(
    fetchHostedManifest("https://user:secret@catalog.example/acme/marketplace.json"),
    assertRefused(
      "Marketplace URL must not contain a user name or password: https://***@catalog.example/acme/marketplace.json",
    ),
  );
  assert.deepStrictEqual(requests, []);
});
