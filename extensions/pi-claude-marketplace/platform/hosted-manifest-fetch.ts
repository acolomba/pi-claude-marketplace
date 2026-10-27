// platform/hosted-manifest-fetch.ts
//
// D-PL5-07: downloads a hosted marketplace catalog, one `marketplace.json`
// served at an https URL, with the limits and the redirect policy Claude Code
// applies to the same download. Besides the Device Flow, this is the only
// module that calls `fetch`.
//
// It sends no credential and no header of its own, because Claude Code's add
// sends none. The Node network modules are banned in the extension, so the
// host checks below read the hostname as text. They refuse an address
// literal, including an IPv6 form that embeds a refused IPv4 address, and
// the names in the list below. They cannot see where a DNS name resolves: a
// name whose record points at a loopback, link-local, or metadata address
// passes. Closing that gap needs a resolver, which `no-network-modules` bans.

import { HostedManifestFetchError, HostedManifestHttpError } from "../shared/errors.ts";

const DOWNLOAD_TIMEOUT_MS = 10_000;
const MAX_CATALOG_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 5;

// Claude Code's set of host names that name this machine or a cloud metadata
// service.
const LOCAL_OR_METADATA_HOSTS = new Set([
  "",
  "localhost",
  "metadata.google.internal",
  "metadata.goog",
  "metadata",
  "instance-data",
  "instance-data.ec2.internal",
  "ip6-localhost",
  "ip6-loopback",
  "localhost.localdomain",
  "localhost4",
  "localhost4.localdomain4",
  "localhost6",
  "localhost6.localdomain6",
  /* eslint-disable sonarjs/no-hardcoded-ip -- the cloud metadata addresses Claude Code refuses */
  "100.100.100.200",
  "168.63.129.16",
  "192.0.0.192",
  /* eslint-enable sonarjs/no-hardcoded-ip */
]);

const IPV4_ADDRESS = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

// The first 96 bits, as 24 hex digits, of each IPv6 range whose last 32 bits
// are an IPv4 address: IPv4-compatible (::/96, which holds :: and ::1),
// IPv4-mapped (::ffff:0:0/96), IPv4-translated (::ffff:0:0:0/96), and the
// NAT64 well-known prefix (64:ff9b::/96).
const IPV4_EMBEDDING_PREFIXES = [
  "000000000000000000000000",
  "00000000000000000000ffff",
  "0000000000000000ffff0000",
  "0064ff9b0000000000000000",
];

/**
 * Whether the dotted-quad IPv4 address `[a, b]` starts with is this machine
 * (0/8, 127/8), link-local (169.254/16), or private (10/8, 172.16/12,
 * 192.168/16).
 */
function isLocalIpv4(a: number, b: number): boolean {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

/** The first two octets of `host` when it is a dotted-quad IPv4 address. */
function ipv4Head(host: string): readonly [number, number] | undefined {
  const match = IPV4_ADDRESS.exec(host);
  return match === null ? undefined : [Number(match[1]), Number(match[2])];
}

/**
 * The 32 hex digits of the IPv6 address `host`, as the URL parser writes it:
 * lowercase groups without a dotted quad, with at most one `::`.
 */
function expandIpv6(host: string): string {
  const hex = (part: string): string =>
    part
      .split(":")
      .filter((group) => group !== "")
      .map((group) => group.padStart(4, "0"))
      .join("");
  const gap = host.indexOf("::");
  if (gap === -1) {
    return hex(host);
  }

  const head = hex(host.slice(0, gap));
  const tail = hex(host.slice(gap + 2));
  return head + "0".repeat(32 - head.length - tail.length) + tail;
}

/**
 * Whether the IPv6 address `host` (brackets removed) is link-local
 * (fe80::/10), unique-local (fc00::/7, which holds the EC2 metadata address
 * fd00:ec2::254), or embeds an IPv4 address `isLocalIpv4` refuses. The URL
 * parser writes `[::169.254.169.254]` as `[::a9fe:a9fe]`.
 */
function isLocalIpv6(host: string): boolean {
  const digits = expandIpv6(host);
  const octet = (start: number): number => Number.parseInt(digits.slice(start, start + 2), 16);
  if (IPV4_EMBEDDING_PREFIXES.some((prefix) => digits.startsWith(prefix))) {
    return isLocalIpv4(octet(24), octet(26));
  }

  const first = Number.parseInt(digits.slice(0, 4), 16);
  return (first & 0xffc0) === 0xfe80 || (first & 0xfe00) === 0xfc00;
}

/**
 * Claude Code's host rule for a cross-origin redirect: whether `hostname`
 * names this machine, a link-local or private address, or a cloud metadata
 * service. A trailing dot is ignored, as DNS ignores it.
 */
function isDisallowedHost(hostname: string): boolean {
  const host = hostname.endsWith(".") ? hostname.slice(0, -1) : hostname;
  if (host.startsWith("[")) {
    return isLocalIpv6(host.slice(1, -1));
  }

  const head = ipv4Head(host);
  return (
    LOCAL_OR_METADATA_HOSTS.has(host) ||
    host.endsWith(".localhost") ||
    (host.startsWith("instance-data.") && host.endsWith(".compute.internal")) ||
    (head !== undefined && isLocalIpv4(...head))
  );
}

/** Where a 3xx answer sends the download, or undefined for any other answer. */
function redirectTarget(response: Response, base: URL): URL | undefined {
  const location = response.headers.get("location");
  if (response.status < 300 || response.status >= 400 || location === null) {
    return undefined;
  }

  return URL.canParse(location, base) ? new URL(location, base) : undefined;
}

interface RedirectChain {
  readonly start: URL;
  readonly redirects: number;
  readonly signal: AbortSignal;
}

/**
 * Sends one GET and follows its redirect. A hop that stays on the start URL's
 * origin is always followed. A cross-origin hop must use https and must not
 * name a host `isDisallowedHost` refuses. The sixth redirect is refused.
 */
async function sendHop(target: URL, chain: RedirectChain): Promise<Response> {
  const response = await fetch(target.href, { redirect: "manual", signal: chain.signal });
  const next = redirectTarget(response, target);
  if (next === undefined) {
    return response;
  }

  await response.body?.cancel();
  if (chain.redirects === MAX_REDIRECTS) {
    throw new HostedManifestFetchError(
      "unreadable",
      `Too many redirects while downloading marketplace from ${chain.start.href}`,
    );
  }

  if (
    next.origin !== chain.start.origin &&
    (next.protocol !== "https:" || isDisallowedHost(next.hostname))
  ) {
    throw new HostedManifestFetchError(
      "unreadable",
      `Marketplace catalog redirected to a disallowed URL and was refused -- a server-chosen cross-origin redirect must use https:// and must not point at a loopback, link-local, or cloud-metadata host (only a hop that stays on the origin you started from is exempt): ${next.href}`,
    );
  }

  return sendHop(next, { ...chain, redirects: chain.redirects + 1 });
}

function catalogTooLarge(url: string): HostedManifestFetchError {
  return new HostedManifestFetchError(
    "unreadable",
    `Marketplace catalog at ${url} is larger than ${MAX_CATALOG_BYTES} bytes`,
  );
}

/**
 * Reads the body of a 2xx answer, refusing a declared or a streamed length
 * over the cap. Leaving the loop early cancels the stream.
 */
async function readCappedBody(response: Response, url: string): Promise<Uint8Array> {
  if (Number(response.headers.get("content-length")) > MAX_CATALOG_BYTES) {
    await response.body?.cancel();
    throw catalogTooLarge(url);
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of response.body ?? []) {
    total += chunk.byteLength;
    if (total > MAX_CATALOG_BYTES) {
      throw catalogTooLarge(url);
    }

    chunks.push(chunk);
  }

  return Buffer.concat(chunks, total);
}

/** The typed error of a download that failed for a reason this module did not raise. */
function downloadFailure(err: unknown, url: string): Error {
  if (err instanceof HostedManifestFetchError || err instanceof HostedManifestHttpError) {
    return err;
  }

  if (err instanceof Error && err.name === "TimeoutError") {
    return new HostedManifestFetchError(
      "network",
      `Request timed out while downloading marketplace from ${url}`,
      { cause: err },
    );
  }

  return new HostedManifestFetchError("network", `Could not connect to ${url}`, { cause: err });
}

/**
 * Downloads the catalog at `url` and returns its bytes. One GET, followed
 * through at most five redirects, within one 10 s timeout, with a 5 MiB body
 * cap. A URL the URL parser refuses, or one with a user name or password, is
 * refused before any request, and the message masks the user name and
 * password. A non-2xx final answer throws `HostedManifestHttpError`; every
 * other failure throws `HostedManifestFetchError`.
 */
export async function fetchHostedManifest(url: string): Promise<Uint8Array> {
  if (!URL.canParse(url)) {
    throw new HostedManifestFetchError("unreadable", `Marketplace URL is not a valid URL: ${url}`);
  }

  const start = new URL(url);
  if (start.username !== "" || start.password !== "") {
    const masked = new URL(start.href);
    masked.username = "***";
    masked.password = "";
    throw new HostedManifestFetchError(
      "unreadable",
      `Marketplace URL must not contain a user name or password: ${masked.href}`,
    );
  }

  try {
    const response = await sendHop(start, {
      start,
      redirects: 0,
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new HostedManifestHttpError(url, response.status);
    }

    return await readCappedBody(response, url);
  } catch (err) {
    throw downloadFailure(err, url);
  }
}
